#!/bin/bash
# Save a pending prompt for later execution

if [ -z "$1" ]; then
    echo "Usage: /pending <name> <prompt>"
    echo ""
    echo "Example: /pending refactor Refactor the auth module to use JWT"
    exit 1
fi

NAME="$1"
shift
PROMPT="$*"

if [ -z "$PROMPT" ]; then
    echo "Error: No prompt provided"
    echo "Usage: /pending <name> <prompt>"
    exit 1
fi

mkdir -p ~/.claude/pending-prompts
echo "$PROMPT" > ~/.claude/pending-prompts/"$NAME".txt

echo "Saved pending prompt: $NAME"
echo ""
echo "Execute with: /send $NAME"
