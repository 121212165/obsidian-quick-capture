# Quick Capture

Frictionless thought capture for Obsidian.

A hotkey (recommended `Ctrl+Shift+Q`, set it in keybindings) opens a single
input line. Type, hit Enter, done — the line lands in your inbox note or today's
daily note with a timestamp, a link back to the note you were in, and your
current selection quoted.

## Features

- **Two capture targets**: a fixed inbox note, or per-day daily notes
  (auto-created with their folder)
- **Rich line format** via template placeholders: `{time}` `{content}`
  `{source}` (note link + quoted selection) `{selection}`
- **Continuous capture mode** — keep the modal open to jot several thoughts in
  a row
- Source-note attribution is automatic when triggered from an open note
- Missing inbox/daily files and folders are created on the fly

## Usage

1. Set a hotkey: Settings → Hotkeys → "捕捉一条想法" (suggested Ctrl+Shift+Q).
2. Anywhere in Obsidian: hotkey → type → Enter.

## Notes

- Plain JavaScript, no build step; runs entirely offline.
