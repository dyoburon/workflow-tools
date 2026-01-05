#!/bin/bash
# Dynamic Hook Dispatcher
#
# This single hook is registered in settings.json once.
# It dynamically loads and runs all hooks from ~/.claude/hooks/enabled/
#
# Benefits:
# - Add/remove hooks without restarting Claude Code
# - Changes to hook scripts take effect immediately
# - Single registration in settings.json
#
# Setup:
# 1. Add to settings.json (once):
#    "hooks": {
#      "UserPromptSubmit": [{
#        "hooks": [{"type": "command", "command": "$HOME/.claude/hooks/dispatcher-hook.sh"}]
#      }]
#    }
#
# 2. Create enabled hooks directory:
#    mkdir -p ~/.claude/hooks/enabled
#
# 3. Symlink or copy hooks you want active:
#    ln -s ~/.claude/hooks/cc-hook.sh ~/.claude/hooks/enabled/
#
# To disable a hook: rm ~/.claude/hooks/enabled/hook-name.sh
# To add a hook: ln -s /path/to/new-hook.sh ~/.claude/hooks/enabled/

HOOKS_DIR="$HOME/.claude/hooks/enabled"
input=$(cat)

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Run each enabled hook in alphabetical order
for hook in "$HOOKS_DIR"/*.sh; do
    [ -f "$hook" ] || continue
    [ -x "$hook" ] || chmod +x "$hook"

    # Run hook and capture output
    result=$(echo "$input" | "$hook" 2>/dev/null)

    # If hook returned a decision, use it
    if [ -n "$result" ]; then
        # Check if it's a block or context injection
        if echo "$result" | jq -e '.decision == "block"' >/dev/null 2>&1; then
            echo "$result"
            exit 0
        elif echo "$result" | jq -e '.hookSpecificOutput' >/dev/null 2>&1; then
            echo "$result"
            exit 0
        fi
    fi
done

# No hook matched, let prompt through
exit 0
