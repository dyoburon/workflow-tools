#!/bin/bash
# Token counter - shows input/output tokens for current Claude Code session
# Usage: tokens.sh [project-path]
#
# Reads ALL session files (main + agent) and sums up all token usage

PROJECT_PATH="${1:-$(pwd)}"

# Convert project path to Claude's format
CLAUDE_PROJECT_PATH=$(echo "$PROJECT_PATH" | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_PATH"

if [ ! -d "$SESSION_DIR" ]; then
    echo "Error: No session directory found for $PROJECT_PATH"
    echo "Looked in: $SESSION_DIR"
    exit 1
fi

# Check if any session files exist
if ! ls "$SESSION_DIR"/*.jsonl >/dev/null 2>&1; then
    echo "Error: No session files found"
    exit 1
fi

# Parse JSON and sum tokens from ALL session files (main + agent)
python3 << EOF
import json
import glob
import os

session_dir = "$SESSION_DIR"
input_tokens = 0
output_tokens = 0
cache_read = 0
cache_creation = 0
message_count = 0
file_count = 0

for filepath in glob.glob(os.path.join(session_dir, "*.jsonl")):
    file_count += 1
    try:
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    # Check for usage in message field (assistant messages)
                    if data.get("type") == "assistant":
                        msg = data.get("message", {})
                        usage = msg.get("usage", {})
                        if usage:
                            input_tokens += usage.get("input_tokens", 0)
                            output_tokens += usage.get("output_tokens", 0)
                            cache_read += usage.get("cache_read_input_tokens", 0)
                            cache_creation += usage.get("cache_creation_input_tokens", 0)
                            message_count += 1
                except json.JSONDecodeError:
                    continue
    except (IOError, OSError):
        continue

total = input_tokens + output_tokens

print("=" * 50)
print("TOKEN USAGE - Current Session (incl. agents)")
print("=" * 50)
print(f"Session files: {file_count}")
print(f"Messages: {message_count}")
print("-" * 50)
print(f"Input tokens:    {input_tokens:>12,}")
print(f"Output tokens:   {output_tokens:>12,}")
print(f"Cache read:      {cache_read:>12,}")
print(f"Cache creation:  {cache_creation:>12,}")
print("-" * 50)
print(f"TOTAL:           {total:>12,}")
print("=" * 50)

# Rough cost estimate (Opus pricing: \$15/M input, \$75/M output)
input_cost = (input_tokens / 1_000_000) * 15
output_cost = (output_tokens / 1_000_000) * 75
total_cost = input_cost + output_cost
print(f"Est. cost (Opus): \${total_cost:.4f}")
EOF
