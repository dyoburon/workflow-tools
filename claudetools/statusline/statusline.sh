#!/bin/bash
# Claude Code Status Line
# Shows: [Model] Context% (tokens) | Git Branch | Cost | Duration
#
# Install: Add to ~/.claude/settings.json:
# {
#   "statusLine": {
#     "type": "command",
#     "command": "$HOME/.claude/statusline/statusline.sh"
#   }
# }

input=$(cat)

# Parse JSON input
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
USAGE=$(echo "$input" | jq '.context_window.current_usage // empty')

# Global cost tracking file (persists across reboots, reset with /reset-money)
mkdir -p "$HOME/.claude"
TRACKING_FILE="$HOME/.claude/cost-tally.json"

# Calculate context usage (from current_usage - for context window %)
if [ -n "$USAGE" ] && [ "$USAGE" != "null" ]; then
    CONTEXT_INPUT=$(echo "$USAGE" | jq -r '.input_tokens // 0')
    CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
    CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')

    CURRENT_TOKENS=$((CONTEXT_INPUT + CACHE_CREATE + CACHE_READ))
    PERCENT=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))

    # Format token count (e.g., 84K/200K)
    CURRENT_K=$((CURRENT_TOKENS / 1000))
    MAX_K=$((CONTEXT_SIZE / 1000))
    TOKEN_DISPLAY="${CURRENT_K}K/${MAX_K}K"
else
    PERCENT=0
    TOKEN_DISPLAY="0K"
fi

# Get CUMULATIVE totals for cost tracking
# Read from ALL session files (main + agent) to include agent tokens
get_session_tokens() {
    local cwd="$1"
    local claude_path=$(echo "$cwd" | sed 's|/|-|g')
    local session_dir="$HOME/.claude/projects/$claude_path"

    if [ ! -d "$session_dir" ] || ! ls "$session_dir"/*.jsonl >/dev/null 2>&1; then
        echo "0 0"
        return
    fi

    python3 << PYEOF
import json
import glob
import os

session_dir = "$session_dir"
input_tokens = 0
output_tokens = 0

for filepath in glob.glob(os.path.join(session_dir, "*.jsonl")):
    try:
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("type") == "assistant":
                        msg = data.get("message", {})
                        usage = msg.get("usage", {})
                        if usage:
                            input_tokens += usage.get("input_tokens", 0)
                            output_tokens += usage.get("output_tokens", 0)
                except json.JSONDecodeError:
                    continue
    except (IOError, OSError):
        continue

print(f"{input_tokens} {output_tokens}")
PYEOF
}

SESSION_TOKENS=$(get_session_tokens "$CWD")
TOTAL_INPUT_TOKENS=$(echo "$SESSION_TOKENS" | cut -d' ' -f1)
TOTAL_OUTPUT_TOKENS=$(echo "$SESSION_TOKENS" | cut -d' ' -f2)

# Color-coded context indicator
if [ "$PERCENT" -ge 80 ]; then
    CONTEXT_ICON="🔴"
elif [ "$PERCENT" -ge 60 ]; then
    CONTEXT_ICON="🟡"
else
    CONTEXT_ICON="🟢"
fi

# Get git branch (if in a git repo)
CWD=$(echo "$input" | jq -r '.cwd // "."')
GIT_BRANCH=$(cd "$CWD" 2>/dev/null && git branch --show-current 2>/dev/null || echo "")
if [ -n "$GIT_BRANCH" ]; then
    GIT_DISPLAY="📁 $GIT_BRANCH"
else
    GIT_DISPLAY="📁 -"
fi

# Calculate would-be cost based on model
# Pricing (per 1M tokens): Opus 4.5 $5 in/$25 out, Sonnet 4 $3 in/$15 out
case "$MODEL" in
    *Opus*)
        INPUT_RATE=5
        OUTPUT_RATE=25
        ;;
    *Sonnet*)
        INPUT_RATE=3
        OUTPUT_RATE=15
        ;;
    *Haiku*)
        INPUT_RATE=0.25
        OUTPUT_RATE=1.25
        ;;
    *)
        INPUT_RATE=3
        OUTPUT_RATE=15
        ;;
esac

# Track cumulative cost across all sessions (global tally)
# Each session tracks its own high-water mark, total = sum of all sessions
SESSION_ID=$(echo "$input" | jq -r '.session_id // "default"')

if [ -f "$TRACKING_FILE" ] && jq -e . "$TRACKING_FILE" >/dev/null 2>&1; then
    START_TIME=$(jq -r '.start_time // empty' "$TRACKING_FILE")
    # Get this session's previous high-water mark
    PREV_SESSION_INPUT=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].input // 0' "$TRACKING_FILE")
    PREV_SESSION_OUTPUT=$(jq -r --arg sid "$SESSION_ID" '.sessions[$sid].output // 0' "$TRACKING_FILE")
    # Read existing sessions object
    SESSIONS_JSON=$(jq -c '.sessions // {}' "$TRACKING_FILE")
else
    PREV_SESSION_INPUT=0
    PREV_SESSION_OUTPUT=0
    SESSIONS_JSON="{}"
fi

# Ensure START_TIME is valid (set to now if empty/invalid)
if [ -z "$START_TIME" ] || [ "$START_TIME" = "null" ] || [ "$START_TIME" -le 0 ] 2>/dev/null; then
    START_TIME=$(date +%s)
fi

# Update this session's high-water mark (only goes up)
NEW_SESSION_INPUT=$((TOTAL_INPUT_TOKENS > PREV_SESSION_INPUT ? TOTAL_INPUT_TOKENS : PREV_SESSION_INPUT))
NEW_SESSION_OUTPUT=$((TOTAL_OUTPUT_TOKENS > PREV_SESSION_OUTPUT ? TOTAL_OUTPUT_TOKENS : PREV_SESSION_OUTPUT))

# Update sessions object with this session's new values
SESSIONS_JSON=$(echo "$SESSIONS_JSON" | jq -c --arg sid "$SESSION_ID" \
    --argjson input "$NEW_SESSION_INPUT" --argjson output "$NEW_SESSION_OUTPUT" \
    '.[$sid] = {input: $input, output: $output}')

# Calculate totals as sum of all sessions
TOTAL_INPUT=$(echo "$SESSIONS_JSON" | jq '[.[].input] | add // 0')
TOTAL_OUTPUT=$(echo "$SESSIONS_JSON" | jq '[.[].output] | add // 0')

# Save tracking data (atomic write)
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" << EOF
{
  "sessions": $SESSIONS_JSON,
  "start_time": $START_TIME
}
EOF
mv "$TEMP_FILE" "$TRACKING_FILE"

# Calculate cost in dollars
INPUT_COST=$(echo "scale=4; $TOTAL_INPUT * $INPUT_RATE / 1000000" | bc)
OUTPUT_COST=$(echo "scale=4; $TOTAL_OUTPUT * $OUTPUT_RATE / 1000000" | bc)
TOTAL_COST=$(echo "scale=2; $INPUT_COST + $OUTPUT_COST" | bc)
COST_DISPLAY="\$${TOTAL_COST}"

# Calculate session duration
CURRENT_TIME=$(date +%s)
DURATION=$((CURRENT_TIME - START_TIME))
MINUTES=$((DURATION / 60))
if [ "$MINUTES" -lt 60 ]; then
    TIME_DISPLAY="⏱️ ${MINUTES}m"
else
    HOURS=$((MINUTES / 60))
    REMAINING_MINS=$((MINUTES % 60))
    TIME_DISPLAY="⏱️ ${HOURS}h${REMAINING_MINS}m"
fi

# Build status line
echo "[$MODEL] $CONTEXT_ICON ${PERCENT}% ($TOKEN_DISPLAY) | $GIT_DISPLAY | 💰 $COST_DISPLAY | $TIME_DISPLAY"
