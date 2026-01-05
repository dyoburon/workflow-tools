---
allowed-tools: Bash, Read
description: List all saved conversation checkpoints
---

# List Checkpoints

Show all available conversation checkpoints.

## Your Task

1. List all checkpoint files:
```bash
ls -la ~/.claude/checkpoints/*.md 2>/dev/null || echo "No checkpoints found"
```

2. For each checkpoint, show:
   - Name (filename without .md)
   - Created date
   - First few lines (the summary)

3. Format as a clean table:
```
Available Checkpoints:
----------------------
Name                 | Created           | Summary
---------------------|-------------------|------------------
feature-auth         | 2024-01-04 10:30  | Working on auth...
bug-fix-123          | 2024-01-03 15:45  | Fixing issue...
```

4. Remind user: `Resume with: /cc-resume <name>`
