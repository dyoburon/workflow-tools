# Claude Code Tools

Custom tools and extensions for Claude Code.

## Quick Start

```bash
# 1. Copy hooks
mkdir -p ~/.claude/hooks
cp hooks/*.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.sh

# 2. Copy commands
mkdir -p ~/.claude/commands
cp commands/*.md ~/.claude/commands/

# 3. Add configuration to ~/.claude/settings.json (see below)
```

## Configuration

Add the following to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/PATH/TO/claudetools/statusline/statusline.sh"
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USERNAME/.claude/hooks/pending-hook.sh"
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USERNAME/.claude/hooks/send-hook.sh"
          }
        ]
      }
    ]
  }
}
```

**Important:** Replace `/PATH/TO/` and `YOUR_USERNAME` with your actual paths.

**Note:** After modifying `settings.json`, you must restart Claude Code for hooks to take effect. Claude Code caches settings at startup.

---

## Components

### 1. Pending/Send Hooks

Queue prompts in one session, execute them in another.

#### Usage

```
$pending <name> <prompt>    # Save a prompt for later
$send <name>                # Execute the saved prompt
```

#### Example

```
# Session A: Save a prompt
$pending bugfix Fix the authentication timeout issue in auth.js

# Session B (or later in A): Execute it
$send bugfix
```

#### Setup

1. Copy hooks to `~/.claude/hooks/`:
```bash
mkdir -p ~/.claude/hooks
cp hooks/pending-hook.sh ~/.claude/hooks/
cp hooks/send-hook.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.sh
```

2. Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USERNAME/.claude/hooks/pending-hook.sh"
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USERNAME/.claude/hooks/send-hook.sh"
          }
        ]
      }
    ]
  }
}
```

3. Restart all Claude Code instances.

#### How It Works

- `$pending` saves the prompt to `~/.claude/pending-prompts/<name>.txt`
- `$send` reads the file, deletes it, and injects the content as context for Claude
- Uses `$` prefix (not `/`) to avoid slash command parsing
- Prompts persist across sessions via filesystem

See [docs/howthehookworks/implementation.md](docs/howthehookworks/implementation.md) for technical details.

---

### 2. Checkpoint Commands

Save and restore conversation context.

#### Usage

```
/cc <name>           # Save checkpoint
/cc-resume <name>    # Resume from checkpoint
/cc-list             # List all checkpoints
```

#### Example

```
# Save before context gets too full
/cc auth-refactor

# Later, in a new session
/cc-resume auth-refactor
```

#### Setup

1. Copy commands to `~/.claude/commands/`:
```bash
mkdir -p ~/.claude/commands
cp commands/cc.md ~/.claude/commands/
cp commands/cc-resume.md ~/.claude/commands/
cp commands/cc-list.md ~/.claude/commands/
cp commands/cc-fast.sh ~/.claude/commands/
chmod +x ~/.claude/commands/cc-fast.sh
```

2. **IMPORTANT:** Add bash permission for the script. Without this, you'll get a "permission check failed" error.

   In `~/.claude/settings.json`, add a `permissions` section (or merge with existing):
   ```json
   {
     "permissions": {
       "allow": [
         "Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"
       ]
     }
   }
   ```

   **Full example** combining with other settings:
   ```json
   {
     "permissions": {
       "allow": [
         "Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"
       ]
     },
     "statusLine": {
       "type": "command",
       "command": "/PATH/TO/claudetools/statusline/statusline.sh"
     },
     "hooks": { ... }
   }
   ```

3. Restart Claude Code (required - settings are cached at startup).

#### How It Works

`/cc` does two things:
1. **Fast backup (instant)**: Copies the raw session `.jsonl` file
2. **Summary (takes a moment)**: Claude writes a human-readable summary

Creates:
- `~/.claude/checkpoints/<name>.jsonl` - Complete raw conversation data
- `~/.claude/checkpoints/<name>.md` - Human-readable summary
- `~/.claude/checkpoints/<name>.meta.json` - Metadata

**Best practice**: Checkpoint before hitting ~60% context usage.

---

### 3. Statusline

Enhanced status line showing model, context usage, cost, and more.

#### Example Output

```
[Opus] 🟢 42% (84K/200K) | 📁 main | 💰 $3.47 | ⏱️ 23m
```

Shows:
- **Model name** (Opus, Sonnet, Haiku)
- **Context usage** with color indicator (🟢 <60%, 🟡 60-80%, 🔴 >80%)
- **Token counts** (e.g., 84K/200K)
- **Git branch**
- **Would-be API cost**
- **Session duration**

#### Setup

1. Add to `~/.claude/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "/FULL/PATH/TO/claudetools/statusline/statusline.sh"
  }
}
```

2. Restart Claude Code.

---

## Directory Structure

```
claudetools/
├── README.md
├── statusline/
│   └── statusline.sh           # Status line script
├── commands/
│   ├── cc.md                   # Create checkpoint
│   ├── cc-resume.md            # Resume checkpoint
│   ├── cc-list.md              # List checkpoints
│   └── cc-fast.sh              # Fast backup helper
├── hooks/
│   ├── pending-hook.sh         # $pending command hook
│   └── send-hook.sh            # $send command hook
└── docs/
    └── howthehookworks/
        └── implementation.md   # Technical documentation
```

---

## Troubleshooting

### `/cc` gives "Bash command permission check failed"

This is the most common issue. The `/cc` command needs explicit bash permission to run the helper script.

**Fix:** Add the permission to `~/.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"
    ]
  }
}
```

Then **restart Claude Code** (required).

**Verify the permission is set:**
```bash
cat ~/.claude/settings.json | jq '.permissions'
```

### Hooks not working

1. **Check settings loaded:**
```bash
grep "hook" ~/.claude/debug/latest
```
Should show `Found 2 hook matchers in settings`.

2. **Restart Claude Code** - hooks are cached at startup.

3. **Check JSON validity:**
```bash
cat ~/.claude/settings.json | jq .
```

### "Interrupted - What should Claude do instead?"

The hook failed. Check debug logs:
```bash
grep -i "error\|fail" ~/.claude/debug/latest
```

Common cause: Invalid JSON in hook output (special characters in saved prompts).

### Commands not found

Ensure files are in `~/.claude/commands/` and Claude Code was restarted.

### cc-fast.sh permission denied

If you see "permission denied" when running the script directly:
```bash
chmod +x ~/.claude/commands/cc-fast.sh
```

---

## Notes

- **Global vs Project settings**: Hooks in `~/.claude/settings.json` apply globally. You can also add them to project-level `.claude/settings.json`.
- **Hot reload**: Claude Code does NOT hot-reload settings. Always restart after changes.
- **Hook execution**: All `UserPromptSubmit` hooks run on every prompt. Each hook checks if the prompt matches its pattern.
