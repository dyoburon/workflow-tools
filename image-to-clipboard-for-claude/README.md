# Image to Clipboard for Claude

**macOS only** — Hammerspoon script that takes an interactive screenshot and copies the **file path** to your clipboard, ready to paste into Claude Code or any tool that accepts file paths.

## Requirements

- [Hammerspoon](https://www.hammerspoon.org/) (`brew install --cask hammerspoon`)

## Install

Add to your Hammerspoon config:

```bash
# From the workflow-tools repo
cat image-to-clipboard-for-claude/init.lua >> ~/.hammerspoon/init.lua
```

Or if you use Spoons/require, copy `init.lua` into your Hammerspoon config and `require` it.

Then reload Hammerspoon (`Cmd+Option+R` or click Reload Config).

## Usage

| Hotkey | Action |
|--------|--------|
| `Cmd+Option+S` | Take interactive screenshot, copy file path to clipboard |

1. Press `Cmd+Option+S`
2. Select a region on screen (or press Space to capture a full window)
3. The screenshot is saved to `~/Documents/Screenshots/`
4. The file path is copied to your clipboard
5. Paste the path into Claude Code or any other tool

## How it works

- Uses the built-in macOS `screencapture` utility in interactive mode
- Saves screenshots as `screenshot_YYYY-MM-DD_HH-MM-SS.png`
- Copies the full file path (not the image) to the clipboard
