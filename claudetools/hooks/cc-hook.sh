#!/bin/bash
# Hook for $cc checkpoint commands

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

# Handle $cc-list
if [[ "$prompt" == "\$cc-list" ]]; then
    checkpoint_dir="$HOME/.claude/checkpoints"

    if [ ! -d "$checkpoint_dir" ] || [ -z "$(ls -A "$checkpoint_dir"/*.meta.json 2>/dev/null)" ]; then
        echo '{"decision":"block","reason":"No checkpoints found.\n\nCreate one with: $cc <name>"}'
        exit 0
    fi

    output="Saved Checkpoints:\n"
    output+="─────────────────────────────────────────────────\n"

    for meta in "$checkpoint_dir"/*.meta.json; do
        name=$(jq -r '.name' "$meta")
        created=$(jq -r '.created' "$meta")
        size=$(jq -r '.size_bytes' "$meta")
        project=$(jq -r '.project_path' "$meta")

        # Format size
        if [ "$size" -gt 1048576 ]; then
            size_fmt="$(echo "scale=1; $size/1048576" | bc)M"
        elif [ "$size" -gt 1024 ]; then
            size_fmt="$(echo "scale=1; $size/1024" | bc)K"
        else
            size_fmt="${size}B"
        fi

        # Format date (just date part)
        date_fmt=$(echo "$created" | cut -d'T' -f1)

        output+="  $name\n"
        output+="    Created: $date_fmt  Size: $size_fmt\n"
        output+="    Project: $project\n\n"
    done

    output+="Resume with: \$cc-resume <name>"

    echo "{\"decision\":\"block\",\"reason\":\"$output\"}"
    exit 0
fi

# Handle $cc <checkpoint-name>
if [[ "$prompt" =~ ^\$cc[[:space:]] ]]; then
    name="${prompt#\$cc }"
    name="${name%% *}"  # Just the first word

    if [ -z "$name" ]; then
        echo '{"decision":"block","reason":"Usage: $cc <checkpoint-name>"}'
        exit 0
    fi

    # Run the checkpoint script
    output=$("$HOME/.claude/commands/cc-fast.sh" "$name" "$(pwd)" 2>&1)

    if [ $? -eq 0 ]; then
        echo "{\"decision\":\"block\",\"reason\":\"$output\\n\\nResume with: \$cc-resume $name\"}"
    else
        echo "{\"decision\":\"block\",\"reason\":\"Error creating checkpoint:\\n$output\"}"
    fi
    exit 0
fi

# Handle just "$cc" with no args
if [[ "$prompt" == "\$cc" ]]; then
    echo '{"decision":"block","reason":"Usage: $cc <checkpoint-name>"}'
    exit 0
fi

# Handle $cc-resume <name>
if [[ "$prompt" =~ ^\$cc-resume[[:space:]] ]]; then
    name="${prompt#\$cc-resume }"
    name="${name%% *}"  # Just the first word

    checkpoint_dir="$HOME/.claude/checkpoints"
    summary_file="$checkpoint_dir/${name}.md"
    jsonl_file="$checkpoint_dir/${name}.jsonl"
    meta_file="$checkpoint_dir/${name}.meta.json"

    # Check if checkpoint exists
    if [ ! -f "$jsonl_file" ] && [ ! -f "$summary_file" ]; then
        # List available checkpoints
        available=$(ls "$checkpoint_dir"/*.meta.json 2>/dev/null | xargs -I {} basename {} .meta.json | tr '\n' ', ' | sed 's/,$//')
        if [ -z "$available" ]; then
            available="none"
        fi
        echo "{\"decision\":\"block\",\"reason\":\"Checkpoint '$name' not found.\\n\\nAvailable: $available\"}"
        exit 0
    fi

    # Build context for Claude
    context="# Resume from Checkpoint: $name\n\n"

    # Add metadata if available
    if [ -f "$meta_file" ]; then
        created=$(jq -r '.created' "$meta_file" 2>/dev/null | cut -d'T' -f1)
        project=$(jq -r '.project_path' "$meta_file" 2>/dev/null)
        context+="**Created:** $created\n**Project:** $project\n\n"
    fi

    # If summary exists, use it
    if [ -f "$summary_file" ]; then
        summary_content=$(cat "$summary_file")
        context+="## Checkpoint Summary\n\n$summary_content\n\n"
        context+="---\n\n**Instructions:** Review this checkpoint summary and ask the user how they'd like to proceed."
    else
        # No summary, provide instructions to read raw data
        context+="## No Summary Available\n\n"
        context+="The raw checkpoint data is at: $jsonl_file\n\n"
        context+="**Instructions:** Read the checkpoint file to understand the previous conversation context, then summarize what was being worked on and ask how to proceed."
    fi

    # Use jq to properly escape the context for JSON
    escaped_context=$(echo -e "$context" | jq -Rs '.')

    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":$escaped_context}}"
    exit 0
fi

# Handle just "$cc-resume" with no args
if [[ "$prompt" == "\$cc-resume" ]]; then
    echo '{"decision":"block","reason":"Usage: $cc-resume <checkpoint-name>\n\nList checkpoints with: $cc-list"}'
    exit 0
fi

exit 0
