#!/bin/bash
# Hook for $queue and $queue-list

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

# Handle $queue-list
if [[ "$prompt" == "\$queue-list" ]]; then
    queue_file="$HOME/.claude/queue-order.txt"

    if [ ! -f "$queue_file" ] || [ ! -s "$queue_file" ]; then
        echo '{"decision":"block","reason":"Queue is empty.\n\nAdd items with: $queue <name> <prompt>"}'
        exit 0
    fi

    output="Queue Contents:\n─────────────────────────────────────────────────\n"
    position=1
    while IFS= read -r name; do
        file="$HOME/.claude/pending-prompts/$name.txt"
        if [ -f "$file" ]; then
            # Get first 50 chars of prompt
            preview=$(head -c 50 "$file" | tr '\n' ' ')
            if [ ${#preview} -eq 50 ]; then
                preview="${preview}..."
            fi
            output+="  $position. $name: $preview\n"
        else
            output+="  $position. $name: (file missing)\n"
        fi
        position=$((position + 1))
    done < "$queue_file"

    output+="\nRun next with: \$sendqueue"

    reason=$(echo -e "$output" | jq -Rs '.')
    echo "{\"decision\":\"block\",\"reason\":$reason}"
    exit 0
fi

# Handle $queue <name> <prompt>
if [[ "$prompt" =~ ^\$queue[[:space:]] ]]; then
    args="${prompt#\$queue }"
    name="${args%% *}"
    content="${args#* }"

    if [ -z "$name" ] || [ "$name" = "$content" ]; then
        echo '{"decision":"block","reason":"Usage: $queue <name> <prompt>"}'
        exit 0
    fi

    # Sanitize name - remove quotes and special chars that could break filenames/JSON
    name=$(echo "$name" | tr -d '"\\/')

    # Save prompt (shared storage with pending)
    mkdir -p ~/.claude/pending-prompts
    echo "$content" > ~/.claude/pending-prompts/"$name".txt

    # Add to queue order
    echo "$name" >> ~/.claude/queue-order.txt

    # Show queue position
    position=$(wc -l < ~/.claude/queue-order.txt | tr -d ' ')

    # Use jq to properly escape the output
    reason=$(printf "Queued: %s (position %s)\n\nRun next with: \$sendqueue" "$name" "$position" | jq -Rs '.')
    echo "{\"decision\":\"block\",\"reason\":$reason}"
    exit 0
fi

exit 0
