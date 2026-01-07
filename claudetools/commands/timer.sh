#!/bin/bash
# Timer/Stopwatch for profiling Claude Code sessions
# Tracks both time AND token usage
#
# Usage:
#   timer.sh start [name]     - Start a timer with optional name
#   timer.sh stop             - Stop current timer and show time + tokens
#   timer.sh status           - Show current running timer
#   timer.sh list             - List previous timer results
#   timer.sh clear            - Clear timer history

TIMER_DIR="$HOME/.claude/timers"
CURRENT_TIMER="$TIMER_DIR/current.json"
HISTORY_FILE="$TIMER_DIR/history.jsonl"

mkdir -p "$TIMER_DIR"

# Cross-platform timestamp in seconds
get_timestamp() {
    date +%s
}

# Format seconds to human readable
format_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(( (seconds % 3600) / 60 ))
    local secs=$((seconds % 60))

    if [ $hours -gt 0 ]; then
        printf "%dh %dm %ds" $hours $minutes $secs
    elif [ $minutes -gt 0 ]; then
        printf "%dm %ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

# Get current token counts from Claude session
# Returns: input_tokens output_tokens (space separated)
# NOTE: Includes tokens from both main session AND agent sub-sessions
get_token_counts() {
    local PROJECT_PATH="${1:-$(pwd)}"
    local CLAUDE_PROJECT_PATH=$(echo "$PROJECT_PATH" | sed 's|/|-|g')
    local SESSION_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_PATH"

    if [ ! -d "$SESSION_DIR" ]; then
        echo "0 0"
        return
    fi

    # Check if any session files exist
    if ! ls "$SESSION_DIR"/*.jsonl >/dev/null 2>&1; then
        echo "0 0"
        return
    fi

    # Sum tokens from ALL session files (main + agent files)
    python3 << EOF
import json
import glob
import os

session_dir = "$SESSION_DIR"
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
EOF
}

case "$1" in
    start)
        NAME="${2:-unnamed}"
        TIMESTAMP=$(get_timestamp)
        DATE=$(date -Iseconds 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z")
        CWD=$(pwd)

        # Get current token counts
        TOKENS=$(get_token_counts "$CWD")
        START_INPUT=$(echo $TOKENS | cut -d' ' -f1)
        START_OUTPUT=$(echo $TOKENS | cut -d' ' -f2)

        cat > "$CURRENT_TIMER" << EOF
{
    "name": "$NAME",
    "start_time": $TIMESTAMP,
    "start_date": "$DATE",
    "cwd": "$CWD",
    "start_input_tokens": $START_INPUT,
    "start_output_tokens": $START_OUTPUT
}
EOF
        echo "=================================================="
        echo "Timer started: $NAME"
        echo "=================================================="
        echo "Start time: $DATE"
        echo "Starting tokens - Input: $START_INPUT | Output: $START_OUTPUT"
        echo "=================================================="
        ;;

    stop)
        if [ ! -f "$CURRENT_TIMER" ]; then
            echo "Error: No timer running"
            exit 1
        fi

        END_TIMESTAMP=$(get_timestamp)
        END_DATE=$(date -Iseconds 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z")

        # Read current timer
        TIMER_DATA=$(cat "$CURRENT_TIMER")
        START_TIMESTAMP=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['start_time'])")
        NAME=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")
        START_DATE=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['start_date'])")
        CWD=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['cwd'])")
        START_INPUT=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('start_input_tokens', 0))")
        START_OUTPUT=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('start_output_tokens', 0))")

        # Get ending token counts
        TOKENS=$(get_token_counts "$CWD")
        END_INPUT=$(echo $TOKENS | cut -d' ' -f1)
        END_OUTPUT=$(echo $TOKENS | cut -d' ' -f2)

        # Calculate deltas
        DURATION=$((END_TIMESTAMP - START_TIMESTAMP))
        FORMATTED=$(format_duration $DURATION)
        INPUT_DELTA=$((END_INPUT - START_INPUT))
        OUTPUT_DELTA=$((END_OUTPUT - START_OUTPUT))
        TOTAL_DELTA=$((INPUT_DELTA + OUTPUT_DELTA))

        # Estimate cost (Opus: $15/M input, $75/M output)
        COST=$(python3 -c "print(f'{($INPUT_DELTA / 1_000_000) * 15 + ($OUTPUT_DELTA / 1_000_000) * 75:.4f}')")

        # Save to history
        echo "{\"name\": \"$NAME\", \"start\": \"$START_DATE\", \"end\": \"$END_DATE\", \"duration_seconds\": $DURATION, \"duration_formatted\": \"$FORMATTED\", \"cwd\": \"$CWD\", \"input_tokens\": $INPUT_DELTA, \"output_tokens\": $OUTPUT_DELTA, \"total_tokens\": $TOTAL_DELTA, \"cost_usd\": $COST}" >> "$HISTORY_FILE"

        # Remove current timer
        rm "$CURRENT_TIMER"

        echo "=================================================="
        echo "TIMER STOPPED: $NAME"
        echo "=================================================="
        echo ""
        echo "⏱  DURATION"
        echo "   $FORMATTED ($DURATION seconds)"
        echo ""
        echo "📊 TOKENS USED"
        echo "   Input:  $INPUT_DELTA"
        echo "   Output: $OUTPUT_DELTA"
        echo "   Total:  $TOTAL_DELTA"
        echo ""
        echo "💰 ESTIMATED COST (Opus)"
        echo "   \$$COST"
        echo ""
        echo "=================================================="
        ;;

    status)
        if [ ! -f "$CURRENT_TIMER" ]; then
            echo "No timer running"
            exit 0
        fi

        NOW=$(get_timestamp)
        TIMER_DATA=$(cat "$CURRENT_TIMER")
        START_TIMESTAMP=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['start_time'])")
        NAME=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")
        START_DATE=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['start_date'])")
        CWD=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['cwd'])")
        START_INPUT=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('start_input_tokens', 0))")
        START_OUTPUT=$(echo "$TIMER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('start_output_tokens', 0))")

        ELAPSED=$((NOW - START_TIMESTAMP))
        FORMATTED=$(format_duration $ELAPSED)

        # Get current token counts
        TOKENS=$(get_token_counts "$CWD")
        CURRENT_INPUT=$(echo $TOKENS | cut -d' ' -f1)
        CURRENT_OUTPUT=$(echo $TOKENS | cut -d' ' -f2)
        INPUT_DELTA=$((CURRENT_INPUT - START_INPUT))
        OUTPUT_DELTA=$((CURRENT_OUTPUT - START_OUTPUT))

        echo "=================================================="
        echo "TIMER RUNNING: $NAME"
        echo "=================================================="
        echo "Started: $START_DATE"
        echo "Elapsed: $FORMATTED ($ELAPSED seconds)"
        echo ""
        echo "Tokens so far:"
        echo "   Input:  $INPUT_DELTA"
        echo "   Output: $OUTPUT_DELTA"
        echo "=================================================="
        ;;

    list)
        if [ ! -f "$HISTORY_FILE" ]; then
            echo "No timer history"
            exit 0
        fi

        echo "=================================================="
        echo "TIMER HISTORY"
        echo "=================================================="
        python3 << EOF
import json

with open("$HISTORY_FILE", "r") as f:
    entries = [json.loads(line) for line in f if line.strip()]

if not entries:
    print("No entries")
else:
    for i, entry in enumerate(entries[-10:], 1):  # Last 10 entries
        print(f"{i}. {entry['name']}")
        print(f"   Duration: {entry['duration_formatted']}")
        print(f"   Tokens: {entry.get('total_tokens', 'N/A')} (in: {entry.get('input_tokens', 'N/A')}, out: {entry.get('output_tokens', 'N/A')})")
        print(f"   Cost: \${entry.get('cost_usd', 'N/A')}")
        print(f"   Time: {entry['start']} → {entry['end']}")
        print()
EOF
        ;;

    clear)
        rm -f "$CURRENT_TIMER" "$HISTORY_FILE"
        echo "Timer history cleared"
        ;;

    *)
        echo "Usage: timer.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  start [name]  - Start timer (captures current token count)"
        echo "  stop          - Stop timer and show time + tokens used"
        echo "  status        - Show running timer with current stats"
        echo "  list          - List previous results with token data"
        echo "  clear         - Clear timer history"
        echo ""
        echo "Example:"
        echo "  timer.sh start 'greppy-test'"
        echo "  # ... do your task ..."
        echo "  timer.sh stop"
        ;;
esac
