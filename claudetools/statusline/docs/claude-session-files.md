# Claude Code Session Files (.jsonl)

## Location
```
~/.claude/projects/<path-with-dashes>/*.jsonl
```
Example: `/Users/dylan/Desktop/projects/foo` → `~/.claude/projects/-Users-dylan-Desktop-projects-foo/`

## Directory Structure - Important!

**Sessions are stored per EXACT directory path. They do NOT bubble up to parent directories.**

If you have:
```
/Users/dylan/Desktop/projects/
├── workflow-tools/
├── datafeeds/
└── greppy/
```

Opening Claude Code in each creates SEPARATE session directories:
```
~/.claude/projects/-Users-dylan-Desktop-projects-workflow-tools/
~/.claude/projects/-Users-dylan-Desktop-projects-datafeeds/
~/.claude/projects/-Users-dylan-Desktop-projects-greppy/
~/.claude/projects/-Users-dylan-Desktop-projects/          ← only if opened in projects/ directly
```

**Implication:** To track costs across multiple projects, you must either:
1. Read from all `~/.claude/projects/*/` directories
2. Use a path prefix pattern (e.g., `-Users-dylan-Desktop-projects*`)
3. Use the status line JSON's `total_input_tokens`/`total_output_tokens` with session tracking (current approach)

## File Types
- `<uuid>.jsonl` - Main conversation sessions
- `agent-<id>.jsonl` - Subagent/Task tool sessions

## Token Usage Structure

Each assistant message contains a `usage` object:

```json
{
  "type": "assistant",
  "message": {
    "usage": {
      "input_tokens": 10,
      "cache_creation_input_tokens": 5370,
      "cache_read_input_tokens": 12942,
      "output_tokens": 245,
      "service_tier": "standard"
    }
  }
}
```

### Token Types and Pricing

| Field | Description | Opus 4.5 Price | Sonnet 4 Price |
|-------|-------------|----------------|----------------|
| `input_tokens` | Non-cached input tokens | $5.00/1M | $3.00/1M |
| `cache_creation_input_tokens` | Tokens written to cache | $6.25/1M (+25%) | $3.75/1M (+25%) |
| `cache_read_input_tokens` | Tokens read from cache | $0.50/1M (-90%) | $0.30/1M (-90%) |
| `output_tokens` | Output tokens | $25.00/1M | $15.00/1M |

### Important Notes

1. **Most input is cached** - Claude Code heavily uses prompt caching, so `input_tokens` is often tiny (single digits) while `cache_read_input_tokens` is large.

2. **All three input fields must be counted** - If you only count `input_tokens`, you'll massively undercount actual usage.

3. **Different pricing applies** - Cache reads are 90% cheaper, cache writes are 25% more expensive than base input rate.

## Two Approaches for Cost Tracking

### Approach 1: Read from .jsonl files directly (ABANDONED)

**Pros:**
- Simple - just read and sum
- No persistent state needed
- Includes subagent tokens

**Cons:**
- Only tracks current project directory (not global)
- Files may be cleaned up by Claude Code (unknown retention policy)
- Requires Python for parsing

### Approach 2: Track via status line JSON (CURRENT)

The status line receives JSON input from Claude Code with:
```json
{
  "context_window": {
    "total_input_tokens": 12345,
    "total_output_tokens": 6789
  },
  "session_id": "uuid-here"
}
```

**Pros:**
- Tracks globally across all projects/sessions
- Uses high-water mark per session to accumulate without double-counting
- Persists in `cost-tally.json`

**Cons:**
- `total_input_tokens` doesn't break down cache types (can't apply different rates)
- Requires maintaining session state
- More complex logic

## Gotchas We Hit

1. **Missing cache tokens**: Originally only counted `input_tokens`, missing `cache_creation_input_tokens` and `cache_read_input_tokens`. This showed ~$1.52 for what was actually ~$20+ of usage.

2. **Per-directory isolation**: Thought we could read `.jsonl` files from one project and get global costs. Wrong - each project has its own directory.

3. **CWD ordering bug**: Called `get_session_tokens("$CWD")` before defining `$CWD`, causing empty path lookups.

## Correct Cost Calculation (if reading .jsonl directly)

```python
# Opus 4.5 rates (per 1M tokens)
INPUT_RATE = 5.00
CACHE_WRITE_RATE = 6.25      # INPUT_RATE * 1.25
CACHE_READ_RATE = 0.50       # INPUT_RATE * 0.10
OUTPUT_RATE = 25.00

cost = (
    input_tokens * INPUT_RATE / 1_000_000 +
    cache_creation_input_tokens * CACHE_WRITE_RATE / 1_000_000 +
    cache_read_input_tokens * CACHE_READ_RATE / 1_000_000 +
    output_tokens * OUTPUT_RATE / 1_000_000
)
```

## File Retention

Unknown. Files appear to persist for at least several days, but Claude Code may clean up old sessions. Do not rely on these files for permanent historical tracking.

## Future Improvements

To properly track global costs with accurate cache pricing:
1. Add config option for tracking path prefix (e.g., `/Users/dylan/Desktop/projects`)
2. Read all matching `.jsonl` directories
3. Apply correct cache pricing rates
4. Optionally persist running totals to survive file cleanup
