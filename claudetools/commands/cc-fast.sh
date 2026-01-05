#!/bin/bash
# Fast checkpoint - copies raw session file
# Usage: cc-fast.sh <checkpoint-name> [project-path]
#
# This finds the most recently modified session file and copies it.
# Cross-platform: works on macOS and Linux

# Cross-platform file size function
get_file_size() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f%z "$1"
    else
        stat -c%s "$1"
    fi
}

# Cross-platform ISO date (fallback for older systems)
get_iso_date() {
    date -Iseconds 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z"
}

CHECKPOINT_NAME="$1"
PROJECT_PATH="${2:-$(pwd)}"

if [ -z "$CHECKPOINT_NAME" ]; then
    echo "Usage: cc-fast.sh <checkpoint-name>"
    exit 1
fi

# Convert project path to Claude's format
CLAUDE_PROJECT_PATH=$(echo "$PROJECT_PATH" | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_PATH"

if [ ! -d "$SESSION_DIR" ]; then
    echo "Error: No session directory found for $PROJECT_PATH"
    echo "Looked in: $SESSION_DIR"
    exit 1
fi

# Find most recently modified session file
LATEST_SESSION=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)

if [ -z "$LATEST_SESSION" ]; then
    echo "Error: No session files found"
    exit 1
fi

# Create checkpoint directory
CHECKPOINT_DIR="$HOME/.claude/checkpoints"
mkdir -p "$CHECKPOINT_DIR"

# Copy session file as checkpoint
CHECKPOINT_FILE="$CHECKPOINT_DIR/${CHECKPOINT_NAME}.jsonl"
cp "$LATEST_SESSION" "$CHECKPOINT_FILE"

# Also create a metadata file
cat > "$CHECKPOINT_DIR/${CHECKPOINT_NAME}.meta.json" << EOF
{
    "name": "$CHECKPOINT_NAME",
    "created": "$(get_iso_date)",
    "source_session": "$(basename "$LATEST_SESSION")",
    "project_path": "$PROJECT_PATH",
    "size_bytes": $(get_file_size "$CHECKPOINT_FILE")
}
EOF

echo "Checkpoint saved: $CHECKPOINT_FILE"
echo "Source session: $(basename "$LATEST_SESSION")"
echo "Size: $(du -h "$CHECKPOINT_FILE" | cut -f1)"
