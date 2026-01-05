# Statusline Design

## Overview

The statusline displays real-time session information at the bottom of Claude Code:

```
[Opus 4.5] 🟢 17% (35K/200K) | 📁 main | 💰 $1.2642 | ⏱️ 2h1m
```

## Components

| Component | Example | Description |
|-----------|---------|-------------|
| Model | `[Opus 4.5]` | Current model display name |
| Context | `🟢 17% (35K/200K)` | Context window usage with color indicator |
| Git Branch | `📁 main` | Current git branch (or `-` if not in repo) |
| Cost | `💰 $1.2642` | Cumulative cost across all sessions |
| Duration | `⏱️ 2h1m` | Time since tracking started |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code                               │
│                         │                                    │
│                         ▼                                    │
│    statusLine hook fires on each update                     │
│                         │                                    │
│                         ▼                                    │
│    ┌─────────────────────────────────────────┐              │
│    │         statusline.sh                    │              │
│    │  - Receives JSON via stdin               │              │
│    │  - Parses model, tokens, session_id      │              │
│    │  - Reads/updates cost tracking file      │              │
│    │  - Outputs formatted status string       │              │
│    └─────────────────────────────────────────┘              │
│                         │                                    │
│                         ▼                                    │
│    ┌─────────────────────────────────────────┐              │
│    │     ~/.claude/cost-tally.json           │              │
│    │  (persistent cost tracking)              │              │
│    └─────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### settings.json
```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/statusline.sh"
  }
}
```

## Input JSON

Claude Code sends this JSON to stdin on each status update:

```json
{
  "model": {
    "display_name": "Opus 4.5"
  },
  "context_window": {
    "context_window_size": 200000,
    "current_usage": {
      "input_tokens": 30000,
      "output_tokens": 5000,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0
    }
  },
  "session_id": "abc123-def456",
  "cwd": "/Users/dylan/project"
}
```

## Context Window Indicator

Color-coded based on usage percentage:

| Color | Condition | Meaning |
|-------|-----------|---------|
| 🟢 | < 60% | Plenty of context remaining |
| 🟡 | 60-79% | Context getting used up |
| 🔴 | ≥ 80% | Context nearly full |

Token count formula:
```
current_tokens = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
percent = current_tokens * 100 / context_window_size
```

## Cost Calculation

### Pricing (per 1M tokens)

| Model | Input | Output |
|-------|-------|--------|
| Opus 4.5 | $5 | $25 |
| Sonnet 4 | $3 | $15 |
| Haiku | $0.25 | $1.25 |

### Tracking Logic

Cost is tracked globally in `~/.claude/cost-tally.json`:

```json
{
  "sessions": {
    "session-id-1": { "input": 50000, "output": 10000 },
    "session-id-2": { "input": 30000, "output": 5000 }
  },
  "start_time": 1704412800
}
```

**Key design decisions:**
1. **Per-session high-water marks** - Each session tracks its own max token counts (tokens only go up during a session)
2. **Sum across sessions** - Total cost = sum of all session costs
3. **Persistent** - Survives reboots, can be reset manually

### Cost Formula
```
input_cost = total_input_tokens * input_rate / 1,000,000
output_cost = total_output_tokens * output_rate / 1,000,000
total_cost = input_cost + output_cost
```

## Duration Tracking

- Uses `start_time` from the tracking file
- Displays as `Xm` for < 60 minutes, `XhYm` for longer
- Reset when tracking file is cleared

## File Dependencies

| File | Purpose |
|------|---------|
| `statusline.sh` | Main script |
| `~/.claude/cost-tally.json` | Persistent cost tracking |
| `~/.claude/settings.json` | Configuration |

## Resetting Cost Tracking

Delete or modify the tracking file:
```bash
rm ~/.claude/cost-tally.json
```

Or reset to zero:
```bash
echo '{"sessions":{},"start_time":'$(date +%s)'}' > ~/.claude/cost-tally.json
```
