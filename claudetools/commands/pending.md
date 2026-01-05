---
allowed-tools: Bash, Write, Read
argument-hint: <name> <prompt>
description: Save a prompt to execute later
---

# Save Pending Prompt

Save a prompt with a name/ID so it can be executed later with `/send`.

## Your Task

1. **Parse the arguments**:
   - First word of `$ARGUMENTS` is the name/ID
   - Everything after the first word is the prompt content

2. **Create the pending prompts directory** if it doesn't exist:
```bash
mkdir -p ~/.claude/pending-prompts
```

3. **Save the prompt** to `~/.claude/pending-prompts/<name>.txt`:
   - Just the raw prompt text, nothing else

4. **Confirm** with:
```
Saved pending prompt: <name>

Execute with: /send <name>
```

If no arguments provided, show usage:
```
Usage: /pending <name> <prompt>

Example: /pending refactor Refactor the authentication module to use JWT tokens
```
