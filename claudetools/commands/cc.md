---
allowed-tools: Bash, Write, Read, Glob
argument-hint: <checkpoint-name>
description: Save conversation checkpoint to resume later
---

# Conversation Checkpoint

Save the current conversation context as a checkpoint file that can be resumed later.

## Step 1: Fast backup (instant)

First, run the fast backup script to copy the raw session data:

!`"$HOME/.claude/commands/cc-fast.sh" "$ARGUMENTS" "$(pwd)" 2>&1`

## Step 2: Create readable summary

Now create a human-readable summary alongside the raw data.

Current state:
- Timestamp: !`date '+%Y-%m-%d %H:%M:%S'`
- Working Directory: !`pwd`
- Git Branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

Write a summary to `~/.claude/checkpoints/$ARGUMENTS.md` with:

```markdown
# Checkpoint: $ARGUMENTS
Created: [timestamp]
Working Directory: [path]

## Summary
[2-3 sentence overview of what we're working on]

## Key Context
- Main goal/task
- Key decisions made
- Important files involved

## Current Progress
[What's done, what's in progress]

## Next Steps
[What was planned next]
```

## Step 3: Confirm

Output:
```
Checkpoint saved:
  - Raw data: ~/.claude/checkpoints/$ARGUMENTS.jsonl
  - Summary:  ~/.claude/checkpoints/$ARGUMENTS.md

Resume with: /cc-resume $ARGUMENTS
```
