# Workflow Tools

A collection of productivity tools for developers.

## Install

```bash
git clone https://github.com/YOUR_USERNAME/workflow-tools
cd workflow-tools
```

**Claude Code Tools** (hooks, statusline, checkpoints):
```bash
./claudetools/install.sh
```

**Hammerspoon Tools** (macOS only - window management):
```bash
./hammerspoon-install.sh
```

Or run `./install.sh` for an interactive menu.

## Tools Included

### 1. Claude Code Tools (`claudetools/`)

Hooks and extensions for Claude Code CLI.

| Command | Description |
|---------|-------------|
| `$cc <name>` | Save conversation checkpoint |
| `$cc-resume <name>` | Resume from checkpoint |
| `$cc-list` | List all checkpoints |
| `$pending <name> <prompt>` | Save prompt for later |
| `$send <name>` | Execute saved prompt |
| `$queue <name> <prompt>` | Add to prompt queue |
| `$sendqueue` | Execute next queued prompt |

Plus a statusline showing context usage, cost, and duration.

[Full documentation →](claudetools/README.md)

### 2. Force Alt-Tab (`force-alt-tab/`)

**macOS only** - Hammerspoon script that fixes Cmd+Tab behavior. Apps always unhide when you switch to them.

[Full documentation →](force-alt-tab/README.md)

### 3. Window Recorder (`window-recorder/`)

**macOS only** - Record and replay window positions with hotkeys.

| Hotkey | Action |
|--------|--------|
| `Cmd+Option+R` | Record window position |
| `Cmd+Option+2-9` | Restore saved position |
[Full documentation →](window-recorder/README.md)

### 4. Image to Clipboard (`image-to-clipboard-for-claude/`)

**macOS only** - Hammerspoon script that takes an interactive screenshot and copies the file path to your clipboard for pasting into Claude.

| Hotkey | Action |
|--------|--------|
| `Cmd+Option+S` | Screenshot → path to clipboard |

[Full documentation →](image-to-clipboard-for-claude/README.md)

### 5. DOM Extractor (`dom-for-llm-extractor/`)

JavaScript tool to extract page structure for LLM analysis.

## Requirements

| Tool | Dependencies |
|------|--------------|
| Claude Code Tools | `jq`, `bc` |
| Hammerspoon Tools | [Hammerspoon](https://www.hammerspoon.org/) (macOS) |
| Bookmarklets | Modern browser |

## Platform Support

| Tool | macOS | Linux | Windows (WSL) |
|------|-------|-------|---------------|
| Claude Code Tools | ✓ | ✓ | ✓ |
| Hammerspoon Tools | ✓ | - | - |
| Bookmarklets | ✓ | ✓ | ✓ |

## License

MIT
