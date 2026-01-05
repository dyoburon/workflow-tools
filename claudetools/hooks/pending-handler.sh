#!/bin/bash
# Hook to intercept /pending commands and handle them directly

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

# Handle /pending <name> <prompt>
if [[ "$prompt" =~ ^/pending[[:space:]] ]]; then
    args="${prompt#/pending }"
    name="${args%% *}"
    content="${args#* }"

    if [ -z "$name" ] || [ "$name" = "$content" ]; then
        echo '{"decision":"block","reason":"Usage: /pending <name> <prompt>"}'
        exit 0
    fi

    mkdir -p ~/.claude/pending-prompts
    echo "$content" > ~/.claude/pending-prompts/"$name".txt

    echo "{\"decision\":\"block\",\"reason\":\"Saved pending prompt: $name\\n\\nExecute with: /send $name\"}"
    exit 0
fi

# Let everything else through
exit 0
