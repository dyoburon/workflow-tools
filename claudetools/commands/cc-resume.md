---
allowed-tools: Read, Glob, Bash
argument-hint: <checkpoint-name>
description: Resume from a saved conversation checkpoint
---

# Resume from Checkpoint

Load a previously saved conversation checkpoint and continue from that context.

## Your Task

1. **Check for checkpoint files**:
   - Summary: `~/.claude/checkpoints/$ARGUMENTS.md`
   - Raw data: `~/.claude/checkpoints/$ARGUMENTS.jsonl` (optional, for reference)
   - Metadata: `~/.claude/checkpoints/$ARGUMENTS.meta.json` (optional)

2. **Load the summary file** and internalize the context

3. **If raw data exists**, you can reference it for detailed conversation history

4. **Acknowledge the checkpoint** by summarizing:
   - What we were working on
   - Current state/progress
   - What the next steps were

5. **Ask the user** how they'd like to proceed:
   - Continue with the planned next steps?
   - Take a different direction?
   - Review what was done?

If the checkpoint doesn't exist, list available checkpoints:
```bash
ls ~/.claude/checkpoints/*.md 2>/dev/null | sed 's/.*\///' | sed 's/\.md$//'
```
