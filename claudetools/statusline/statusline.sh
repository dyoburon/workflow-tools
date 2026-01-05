#!/bin/bash
# Claude Code Status Line
# Shows: [Model] Context% (tokens) | Git Branch | Cost | Duration
#
# Install: Add to ~/.claude/settings.json:
# {
#   "statusLine": {
#     "type": "command",
#     "command": "/Users/dylan/Desktop/projects/claudetools/statusline/statusline.sh"
#   }
# }

input=$(cat)

# Parse JSON input
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
USAGE=$(echo "$input" | jq '.context_window.current_usage // empty')

# Session tracking file (per-session cost tracking)
SESSION_ID=$(echo "$input" | jq -r '.session_id // "default"')
TRACKING_FILE="/tmp/claude_session_${SESSION_ID}.json"

# Calculate context usage
if [ -n "$USAGE" ] && [ "$USAGE" != "null" ]; then
    INPUT_TOKENS=$(echo "$USAGE" | jq -r '.input_tokens // 0')
    OUTPUT_TOKENS=$(echo "$USAGE" | jq -r '.output_tokens // 0')
    CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
    CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')

    CURRENT_TOKENS=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))
    PERCENT=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))

    # Format token count (e.g., 84K/200K)
    CURRENT_K=$((CURRENT_TOKENS / 1000))
    MAX_K=$((CONTEXT_SIZE / 1000))
    TOKEN_DISPLAY="${CURRENT_K}K/${MAX_K}K"
else
    PERCENT=0
    TOKEN_DISPLAY="0K"
    INPUT_TOKENS=0
    OUTPUT_TOKENS=0
fi

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
# Pricing (per 1M tokens): Opus $15 in/$75 out, Sonnet $3 in/$15 out
case "$MODEL" in
    *Opus*)
        INPUT_RATE=15
        OUTPUT_RATE=75
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

# Track cumulative cost for session
if [ -f "$TRACKING_FILE" ]; then
    PREV_INPUT=$(jq -r '.total_input // 0' "$TRACKING_FILE")
    PREV_OUTPUT=$(jq -r '.total_output // 0' "$TRACKING_FILE")
    START_TIME=$(jq -r '.start_time // 0' "$TRACKING_FILE")
else
    PREV_INPUT=0
    PREV_OUTPUT=0
    START_TIME=$(date +%s)
fi

# Update totals (use max to handle context resets)
TOTAL_INPUT=$((PREV_INPUT > INPUT_TOKENS ? PREV_INPUT : INPUT_TOKENS))
TOTAL_OUTPUT=$((PREV_OUTPUT > OUTPUT_TOKENS ? PREV_OUTPUT : OUTPUT_TOKENS))

# Save tracking data
echo "{\"total_input\": $TOTAL_INPUT, \"total_output\": $TOTAL_OUTPUT, \"start_time\": $START_TIME}" > "$TRACKING_FILE"

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
