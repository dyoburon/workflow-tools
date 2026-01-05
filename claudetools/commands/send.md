---
allowed-tools: Bash, Read, Glob
argument-hint: <name>
description: Execute a saved pending prompt
---

# Send Pending Prompt

Retrieve and execute a previously saved prompt.

## Your Task

1. **Load the pending prompt** from `~/.claude/pending-prompts/$ARGUMENTS.txt`

2. **If the file exists**:
   - Read the prompt content
   - Delete the file (it's been "sent")
   - Execute the prompt as if the user just typed it

3. **If the file doesn't exist**, list available prompts:
```bash
ls ~/.claude/pending-prompts/*.txt 2>/dev/null | sed 's/.*\///' | sed 's/\.txt$//' || echo "No pending prompts found"
```

And show:
```
Pending prompt '<name>' not found.

Available prompts:
- <list them>

Save new prompts with: /pending <name> <prompt>
```

If no argument provided, list all pending prompts with their content previews.
