# Pending/Send Hook Implementation

## Overview

This hook system allows you to save prompts in one Claude Code session and execute them in another (or the same) session later.

- `$pending <name> <prompt>` - Save a prompt for later
- `$send <name>` - Execute a saved prompt

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Instance                         │
├─────────────────────────────────────────────────────────────────┤
│  User types: "$pending mytest Fix the auth bug"                 │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────┐                    │
│  │     UserPromptSubmit Hook Fires         │                    │
│  │  (before prompt goes to Claude LLM)     │                    │
│  └─────────────────────────────────────────┘                    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────┐                    │
│  │     pending-handler.sh executes         │                    │
│  │  - Receives JSON via stdin              │                    │
│  │  - Parses prompt with jq                │                    │
│  │  - Checks if starts with $pending/$send │                    │
│  └─────────────────────────────────────────┘                    │
│                           │                                      │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                        │
│    ┌─────────────────┐       ┌─────────────────┐               │
│    │ $pending match  │       │  $send match    │               │
│    │ Save to file    │       │  Read from file │               │
│    │ Return: block   │       │  Delete file    │               │
│    └─────────────────┘       │  Return: context│               │
│                              └─────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  ~/.claude/pending-prompts/   │
              │  ├── mytest.txt               │
              │  ├── bugfix.txt               │
              │  └── feature.txt              │
              │  (persistent file storage)    │
              └───────────────────────────────┘
```

## Configuration

### Settings Location
`~/.claude/settings.json` (global settings)

### Hook Configuration
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/dylan/.claude/hooks/pending-handler.sh"
          }
        ]
      }
    ]
  }
}
```

### Key Points:
- `UserPromptSubmit` fires BEFORE the prompt is sent to Claude
- The nested `"hooks"` array is REQUIRED by the schema
- No `matcher` field needed - fires on ALL prompt submissions
- The script must return valid JSON to control behavior

## Script Walkthrough

### File: `~/.claude/hooks/pending-handler.sh`

```bash
#!/bin/bash
# Hook to intercept $pending and $send commands

# 1. Read JSON input from Claude Code via stdin
input=$(cat)

# 2. Extract the prompt field using jq
#    Input looks like: {"prompt":"$pending test hello","session_id":"..."}
prompt=$(echo "$input" | jq -r '.prompt')
```

### Handling `$pending`

```bash
# 3. Check if prompt starts with "$pending " (note the space)
if [[ "$prompt" =~ ^\$pending[[:space:]] ]]; then
    # 4. Parse arguments: "$pending name content here"
    args="${prompt#\$pending }"      # Remove "$pending " prefix
    name="${args%% *}"               # First word = name
    content="${args#* }"             # Everything after = content

    # 5. Validate we have both name and content
    if [ -z "$name" ] || [ "$name" = "$content" ]; then
        echo '{"decision":"block","reason":"Usage: $pending <name> <prompt>"}'
        exit 0
    fi

    # 6. Save to persistent storage
    mkdir -p ~/.claude/pending-prompts
    echo "$content" > ~/.claude/pending-prompts/"$name".txt

    # 7. Return JSON to BLOCK the prompt (don't send to Claude)
    #    The "reason" is displayed to the user
    echo "{\"decision\":\"block\",\"reason\":\"Saved pending prompt: $name\\n\\nExecute with: \$send $name\"}"
    exit 0
fi
```

### Handling `$send`

```bash
# 8. Check if prompt starts with "$send "
if [[ "$prompt" =~ ^\$send[[:space:]] ]]; then
    name="${prompt#\$send }"         # Remove "$send " prefix
    name="${name%% *}"               # First word only
    file="$HOME/.claude/pending-prompts/$name.txt"

    # 9. Check if file exists
    if [ ! -f "$file" ]; then
        # List available prompts for user
        available=$(ls ~/.claude/pending-prompts/*.txt 2>/dev/null | xargs -I {} basename {} .txt | tr '\n' ', ' | sed 's/,$//')
        if [ -z "$available" ]; then
            available="none"
        fi
        echo "{\"decision\":\"block\",\"reason\":\"Pending prompt '$name' not found.\\n\\nAvailable: $available\"}"
        exit 0
    fi

    # 10. Read content and DELETE file (one-time use)
    content=$(cat "$file")
    rm "$file"

    # 11. Return JSON to INJECT the saved prompt as context
    #     This does NOT block - Claude will process the additionalContext
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"The user wants you to execute this saved prompt:\\n\\n$content\"}}"
    exit 0
fi

# 12. If neither $pending nor $send, let the prompt through unchanged
exit 0
```

## Hook Return Values

### Block a prompt (prevent it from reaching Claude)
```json
{
  "decision": "block",
  "reason": "Message shown to user"
}
```

### Add context (prompt still goes to Claude, with extra info)
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Extra context injected for Claude"
  }
}
```

### Let prompt through unchanged
Just `exit 0` with no output, or output plain text (treated as context).

## Storage

### Location
`~/.claude/pending-prompts/`

### File Format
- Filename: `<name>.txt`
- Contents: Raw prompt text (no JSON wrapper)

### Persistence
- Files persist across Claude Code sessions
- Files are DELETED after `$send` retrieves them (one-time use)

## Debugging

### Check if hooks are loading
Look in `~/.claude/debug/latest`:
```
grep -i "hook" ~/.claude/debug/latest
```

Should show:
```
Found 1 hook matchers in settings
Matched 1 unique hooks
```

If it shows `Found 0 hook matchers`, hooks aren't loading.

### Check hook output
```
grep -i "Hook output" ~/.claude/debug/latest
```

### Test hook manually
```bash
echo '{"prompt":"$pending test hello world"}' | ~/.claude/hooks/pending-handler.sh
```

Should output valid JSON starting with `{`.

## Known Issues

### Issue: Hooks don't work in some instances

**Root Cause:** Claude Code does NOT hot-reload hooks. Settings are cached at session startup.

**What happens:**
1. You start Claude Code instance A
2. You modify `~/.claude/settings.json` to add hooks
3. You start Claude Code instance B
4. Instance A: hooks don't work (started before modification)
5. Instance B: hooks work (started after modification)

**Fix:** Close ALL Claude Code instances and start fresh. Any session that was running when you added/modified hooks won't pick them up until restarted.

**Debug:** Check `~/.claude/debug/latest` for:
```
grep -A1 "UserPromptSubmit" ~/.claude/debug/latest
```
- "Found 0 hook matchers in settings" = session started before hooks were configured
- "Found 1 hook matchers in settings" = hooks loaded correctly

### Issue: "Interrupted - What should Claude do instead?"

**Symptom:** `$send` shows "Interrupted" prompt instead of executing.

**Cause:** The hook isn't firing. See above - the session likely started before hooks were configured.

**Fix:** Close that Claude instance and start a new one.
