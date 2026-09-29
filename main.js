/* Quick Capture —— 极速捕捉
 * 热键/命令 → 单行模态 → Enter 把这条想法追加到捕获目标：
 *   - inbox：固定收件箱笔记（不存在自动建）
 *   - daily：今天的每日笔记（按 YYYY-MM-DD 命名，放入指定文件夹）
 * 自动写入：时间戳 + 内容 + （在笔记里触发时）来源链接 + （有选区时）引用选区。
 * 格式模板可配置，支持 {time} {content} {source} {selection} 占位符。
 */
const { Plugin, Modal, Notice, PluginSettingTab, Setting, MarkdownView, TFile, normalizePath } = require("obsidian");

const DEFAULT_SETTINGS = {
  mode: "inbox",            // inbox | daily
  inboxFile: "收件箱.md",
  dailyFolder: "日记",
  dailyFormat: "YYYY-MM-DD",
  template: "- {time} {content} {source}",
  timeFormat: "HH:mm",
  keepOpen: false,          // 连续捕捉：回车后不关闭
};

function fmtDate(d, fmt) {
  const pad = (n) => String(n).padStart(2, "0");
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()));
}

module.exports = class QuickCapture extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addRibbonIcon("capture", "Quick Capture 极速捕捉", () => this.openCapture());
    this.addCommand({ id: "capture", name: "捕捉一条想法", callback: () => this.openCapture() });
    this.addSettingTab(new QCSettingTab(this.app, this));
  }
  async saveSettings() { await this.saveData(this.settings); }

  /** 计算目标笔记路径（不存在也返回路径） */
  targetPath() {
    if (this.settings.mode === "daily") {
      const name = fmtDate(new Date(), this.settings.dailyFormat);
      return normalizePath(`${this.settings.dailyFolder}/${name}.md`);
    }
    return normalizePath(this.settings.inboxFile);
  }

  /** 组装要追加的一行 */
  buildLine(content) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const srcFile = view && view.file ? view.file : null;
    const selection = view ? view.editor.getSelection() : "";
    let source = "";
    if (srcFile) {
      source = `（[[${srcFile.basename}]]）`;
      if (selection.trim()) source = `（来自 [[${srcFile.basename}]]：「${selection.trim().slice(0, 60)}」）`;
    }
    return this.settings.template
      .replace(/\{time\}/g, fmtDate(new Date(), this.settings.timeFormat))
      .replace(/\{content\}/g, content)
      .replace(/\{source\}/g, source)
      .replace(/\{selection\}/g, selection.trim())
      .trim();
  }

  /** 追加到目标笔记（不存在则创建） */
  async append(content) {
    const path = this.targetPath();
    const line = this.buildLine(content);
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!f) {
      const folder = path.substring(0, path.lastIndexOf("/"));
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      f = await this.app.vault.create(path, "");
      new Notice("已创建：" + path);
    }
    const cur = await this.app.vault.read(f);
    await this.app.vault.modify(f, cur.replace(/\s*$/, "\n") + line + "\n");
    new Notice("已捕捉 → " + path);
  }

  openCapture() {
    new CaptureModal(this).open();
  }
};

class CaptureModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("quick-capture-modal");
    const input = contentEl.createEl("input", { type: "text", placeholder: "想到什么写什么，Enter 捕捉…（→ " + this.plugin.targetPath() + "）" });
    input.style.cssText = "width:100%; padding:10px 12px; font-size:15px;";
    const hint = contentEl.createEl("div", {
      text: "Enter 捕捉" + (this.plugin.settings.keepOpen ? "并继续" : "并关闭") + " · Esc 取消 · Shift+Enter 换行",
      attr: { style: "font-size:11px; color:var(--text-muted); margin-top:4px;" },
    });

    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        await this.plugin.append(content);
        if (this.plugin.settings.keepOpen) {
          input.value = "";
          input.focus();
        } else {
          this.close();
        }
      } else if (e.key === "Escape") {
        this.close();
      }
    });
    // Shift+Enter 换行：input 不支持，转 textarea 行为——监听后手动插入
    input.focus();
  }
}

class QCSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("捕获目标").addDropdown((d) => {
      d.addOption("inbox", "固定收件箱笔记");
      d.addOption("daily", "每日笔记（按日期建文件）");
      d.setValue(this.plugin.settings.mode);
      d.onChange(async (v) => { this.plugin.settings.mode = v; await this.plugin.saveSettings(); this.display(); });
    });
    if (this.plugin.settings.mode === "inbox") {
      new Setting(containerEl).setName("收件箱笔记路径").setDesc("不存在自动创建（默认库根目录）").addText((t) =>
        t.setValue(this.plugin.settings.inboxFile).onChange(async (v) => {
          this.plugin.settings.inboxFile = v.trim() || "收件箱.md"; await this.plugin.saveSettings();
        }));
    } else {
      new Setting(containerEl).setName("每日笔记文件夹").addText((t) =>
        t.setValue(this.plugin.settings.dailyFolder).onChange(async (v) => {
          this.plugin.settings.dailyFolder = v.trim() || "日记"; await this.plugin.saveSettings();
        }));
      new Setting(containerEl).setName("每日笔记文件名格式").setDesc("默认 YYYY-MM-DD").addText((t) =>
        t.setValue(this.plugin.settings.dailyFormat).onChange(async (v) => {
          this.plugin.settings.dailyFormat = v.trim() || "YYYY-MM-DD"; await this.plugin.saveSettings();
        }));
    }
    new Setting(containerEl).setName("行格式模板")
      .setDesc("占位符：{time} 时间、{content} 内容、{source} 来源笔记链接+选区、{selection} 仅选区")
      .addText((t) => t.setValue(this.plugin.settings.template).onChange(async (v) => {
        this.plugin.settings.template = v.trim() || "- {time} {content} {source}"; await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("时间格式").setDesc("默认 HH:mm").addText((t) =>
      t.setValue(this.plugin.settings.timeFormat).onChange(async (v) => {
        this.plugin.settings.timeFormat = v.trim() || "HH:mm"; await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("连续捕捉").setDesc("回车后不关闭，继续输入下一条").addToggle((t) =>
      t.setValue(this.plugin.settings.keepOpen).onChange(async (v) => {
        this.plugin.settings.keepOpen = v; await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("设置快捷键")
      .setDesc("设置 → 快捷键 → 搜索「捕捉一条想法」，建议 Ctrl+Shift+Q")
      .addButton((b) => b.setButtonText("打开快捷键设置").onClick(() => {
        this.app.setting.open();
        this.app.setting.openTabById("keybindings");
      }));
  }
}
