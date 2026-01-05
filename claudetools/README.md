# Claude Code Tools

Custom tools and extensions for Claude Code.

## Installation

The tools are installed to `~/.claude/` automatically. To reinstall:

```bash
# Statusline
cp statusline/statusline.sh ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh

# Commands
cp commands/*.md ~/.claude/commands/
```

## Components

### Statusline (`statusline/statusline.sh`)

Enhanced status line showing:
- **Model name** (Opus, Sonnet, Haiku)
- **Context usage** with color-coded indicator (🟢 <60%, 🟡 60-80%, 🔴 >80%)
- **Token counts** (e.g., 84K/200K)
- **Git branch**
- **Would-be API cost** (what you'd pay without subscription)
- **Session duration**

Example output:
```
[Opus] 🟢 42% (84K/200K) | 📁 main | 💰 $3.47 | ⏱️ 23m
```

Configuration in `~/.claude/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/dylan/Desktop/projects/claudetools/statusline/statusline.sh"
  }
}
```

### Checkpoint Commands (`commands/`)

Save and restore conversation context.

#### `/cc <name>` - Create Checkpoint
Saves the current conversation context to a file for later resumption.

```
/cc auth-refactor
```

Creates: `~/.claude/checkpoints/auth-refactor.md`

#### `/cc-resume <name>` - Resume Checkpoint
Loads a checkpoint and continues from that context.

```
/cc-resume auth-refactor
```

#### `/cc-list` - List Checkpoints
Shows all available checkpoints.

```
/cc-list
```

## How Checkpoints Work

`/cc` does two things:

1. **Fast backup (instant)**: Copies the raw session `.jsonl` file from `~/.claude/projects/`
2. **Summary (takes a moment)**: Claude writes a human-readable summary

This gives you:
- `~/.claude/checkpoints/<name>.jsonl` - Complete raw conversation data
- `~/.claude/checkpoints/<name>.md` - Human-readable summary
- `~/.claude/checkpoints/<name>.meta.json` - Metadata (timestamp, source session)

`/cc-resume` loads the summary and continues from that context.

**Best practice**: Checkpoint early and often, especially before you hit ~60% context usage (watch your status line!).

## Directory Structure

```
claudetools/
├── README.md
├── statusline/
│   └── statusline.sh      # Status line script
└── commands/
    ├── cc.md              # Create checkpoint command
    ├── cc-resume.md       # Resume checkpoint command
    ├── cc-list.md         # List checkpoints command
    └── cc-fast.sh         # Fast backup script (called by cc.md)
```
