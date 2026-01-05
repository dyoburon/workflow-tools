#!/bin/bash
# Hook for $send only

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

if [[ "$prompt" =~ ^\$send[[:space:]] ]]; then
    name="${prompt#\$send }"
    name="${name%% *}"
    file="$HOME/.claude/pending-prompts/$name.txt"

    if [ ! -f "$file" ]; then
        available=$(ls ~/.claude/pending-prompts/*.txt 2>/dev/null | xargs -I {} basename {} .txt | tr '\n' ', ' | sed 's/,$//')
        if [ -z "$available" ]; then
            available="none"
        fi
        echo "{\"decision\":\"block\",\"reason\":\"Pending prompt '$name' not found.\\n\\nAvailable: $available\"}"
        exit 0
    fi

    content=$(cat "$file")
    rm "$file"

    # Use jq to build valid JSON with properly escaped content
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":$(echo "The user wants you to execute this saved prompt:\n\n$content" | jq -Rs '.')}}"
    exit 0
fi

exit 0
