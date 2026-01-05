#!/bin/bash
# Hook for $sendqueue - pop first from queue and execute

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

if [[ "$prompt" =~ ^\$sendqueue ]]; then
    queue_file="$HOME/.claude/queue-order.txt"

    # Check if queue exists and has items
    if [ ! -f "$queue_file" ] || [ ! -s "$queue_file" ]; then
        echo '{"decision":"block","reason":"Queue is empty."}'
        exit 0
    fi

    # Get first name from queue
    name=$(head -n 1 "$queue_file")

    # Remove first line from queue
    tail -n +2 "$queue_file" > "$queue_file.tmp" && mv "$queue_file.tmp" "$queue_file"

    # Check if prompt file exists
    file="$HOME/.claude/pending-prompts/$name.txt"
    if [ ! -f "$file" ]; then
        remaining=$(wc -l < "$queue_file" 2>/dev/null | tr -d ' ')
        reason=$(printf "Queue item '%s' not found (file missing). Removed from queue.\n\nRemaining in queue: %s" "$name" "$remaining" | jq -Rs '.')
        echo "{\"decision\":\"block\",\"reason\":$reason}"
        exit 0
    fi

    # Read and delete prompt file
    content=$(cat "$file")
    rm "$file"

    # Show what's next in queue
    remaining=$(wc -l < "$queue_file" 2>/dev/null | tr -d ' ')
    next=$(head -n 1 "$queue_file" 2>/dev/null)
    if [ -n "$next" ]; then
        queue_info="Next in queue: $next ($remaining remaining)"
    else
        queue_info="Queue is now empty."
    fi

    # Use jq to properly escape content for JSON
    context=$(printf "Executing queued prompt '%s':\n\n%s\n\n---\n%s" "$name" "$content" "$queue_info" | jq -Rs '.')
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":$context}}"
    exit 0
fi

exit 0
