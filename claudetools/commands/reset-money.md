---
allowed-tools: Bash, Read
description: Reset the running cost tally to $0
---

# Reset Cost Tally

Reset the global cost tracking to zero.

## Your Task

1. **Show current tally** before reset:
```bash
cat ~/.claude/cost-tally.json 2>/dev/null || echo "No tally file found"
```

2. **Reset the tally** by removing the tracking file:
```bash
rm -f ~/.claude/cost-tally.json
```

3. **Confirm**:
```
Cost tally reset to $0.00

The status line will start fresh from your next message.
```
