# Claude Code Tools

Custom hooks and extensions for Claude Code CLI.

## Quick Install

```bash
# Clone and run install script
git clone https://github.com/YOUR_USERNAME/workflow-tools
cd workflow-tools/claudetools
./install.sh
```

Or manually:

```bash
# 1. Copy hooks
mkdir -p ~/.claude/hooks ~/.claude/commands
cp hooks/*.sh ~/.claude/hooks/
cp commands/*.sh ~/.claude/commands/
chmod +x ~/.claude/hooks/*.sh ~/.claude/commands/*.sh

# 2. Copy statusline (optional)
mkdir -p ~/.claude/statusline
cp statusline/statusline.sh ~/.claude/statusline/
chmod +x ~/.claude/statusline/statusline.sh

# 3. Add configuration (see below)
# 4. Restart Claude Code
```

## Configuration

Add to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "$HOME/.claude/statusline/statusline.sh"
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/cc-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/pending-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/send-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/queue-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/sendqueue-hook.sh" }] }
    ]
  }
}
```

**Then restart Claude Code** (settings are cached at startup).

---

## Commands

All commands use `$` prefix (not `/`) to work via hooks.

### Checkpoints

Save and restore conversation context across sessions.

| Command | Description |
|---------|-------------|
| `$cc <name>` | Save checkpoint |
| `$cc-resume <name>` | Resume from checkpoint (injects full context) |
| `$cc-list` | List all checkpoints |

```
# Save before context gets full
$cc auth-refactor

# Later, in a new session
$cc-resume auth-refactor
```

**Storage:** `~/.claude/checkpoints/`

### Pending Prompts

Save a prompt now, execute it later.

| Command | Description |
|---------|-------------|
| `$pending <name> <prompt>` | Save prompt for later |
| `$send <name>` | Execute saved prompt |

```
# Save a prompt
$pending bugfix Fix the timeout issue in auth.js

# Execute later (same or different session)
$send bugfix
```

**Storage:** `~/.claude/pending-prompts/`

### Queue

Save multiple prompts in order, execute sequentially.

| Command | Description |
|---------|-------------|
| `$queue <name> <prompt>` | Add prompt to queue |
| `$queue-list` | Show queue contents |
| `$sendqueue` | Execute next item in queue |

```
# Queue up tasks
$queue step1 "First do this"
$queue step2 "Then do this"
$queue step3 "Finally do this"

# Execute in order
$sendqueue  # runs step1
$sendqueue  # runs step2
$sendqueue  # runs step3
```

**Storage:** `~/.claude/queue-order.txt` + `~/.claude/pending-prompts/`

---

## Statusline

Enhanced status showing model, context, cost, and duration.

```
[Opus 4.5] 🟢 42% (84K/200K) | 📁 main | 💰 $1.47 | ⏱️ 23m
```

| Component | Description |
|-----------|-------------|
| `[Opus 4.5]` | Current model |
| `🟢 42%` | Context usage (🟢 <60%, 🟡 60-80%, 🔴 >80%) |
| `(84K/200K)` | Token count |
| `📁 main` | Git branch |
| `💰 $1.47` | Cumulative session cost |
| `⏱️ 23m` | Session duration |

**Pricing (per 1M tokens):**
- Opus 4.5: $5 in / $25 out
- Sonnet 4: $3 in / $15 out
- Haiku: $0.25 in / $1.25 out

**Reset cost tracking:**
```bash
rm ~/.claude/cost-tally.json
```

---

## Directory Structure

```
claudetools/
├── README.md
├── install.sh              # Installation script
├── settings.example.json   # Example settings
├── hooks/
│   ├── cc-hook.sh          # $cc, $cc-resume, $cc-list
│   ├── pending-hook.sh     # $pending
│   ├── send-hook.sh        # $send
│   ├── queue-hook.sh       # $queue, $queue-list
│   └── sendqueue-hook.sh   # $sendqueue
├── commands/
│   └── cc-fast.sh          # Checkpoint helper script
├── statusline/
│   └── statusline.sh       # Status line script
└── docs/
    ├── howthehookworks/
    │   └── implementation.md
    └── statusline/
        └── design.md
```

---

## How Hooks Work

Hooks intercept prompts BEFORE they reach Claude:

1. User types `$cc mywork`
2. `UserPromptSubmit` hook fires
3. `cc-hook.sh` receives the prompt as JSON
4. Script checks if prompt matches `$cc` pattern
5. If match: saves checkpoint, returns `{"decision":"block",...}`
6. Claude never sees the prompt - user sees confirmation message

For commands like `$send` and `$cc-resume`, the hook returns `additionalContext` which injects content into Claude's context.

See [docs/howthehookworks/implementation.md](docs/howthehookworks/implementation.md) for technical details.

---

## Troubleshooting

### Commands not working

1. **Restart Claude Code** - hooks are cached at startup
2. Check settings loaded: `grep "hook" ~/.claude/debug/latest`
3. Validate JSON: `cat ~/.claude/settings.json | jq .`

### "Permission check failed" for $cc

Add to settings.json:
```json
{
  "permissions": {
    "allow": ["Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"]
  }
}
```

### Hook output errors

Test hook manually:
```bash
echo '{"prompt":"$cc-list"}' | ~/.claude/hooks/cc-hook.sh
```

Should return valid JSON.

---

## Notes

- **Settings location:** `~/.claude/settings.json` (global) or `.claude/settings.json` (project)
- **Hot reload:** As of v1.0.90+, settings.json changes auto-reload. Hook script changes always take effect immediately.
- **Dependencies:** `jq` and `bc` required for hooks and statusline
- **Cross-platform:** Works on macOS and Linux (auto-detects OS for platform-specific commands)
