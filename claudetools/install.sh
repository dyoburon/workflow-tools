#!/bin/bash
# Claude Code Tools Installer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Claude Code Tools..."

# Create directories
mkdir -p ~/.claude/hooks ~/.claude/commands ~/.claude/statusline

# Copy hooks
echo "Copying hooks..."
cp "$SCRIPT_DIR"/hooks/*.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.sh

# Copy commands
echo "Copying commands..."
cp "$SCRIPT_DIR"/commands/*.sh ~/.claude/commands/
chmod +x ~/.claude/commands/*.sh

# Copy statusline
echo "Copying statusline..."
cp "$SCRIPT_DIR"/statusline/statusline.sh ~/.claude/statusline/
chmod +x ~/.claude/statusline/statusline.sh

echo ""
echo "Files installed to ~/.claude/"
echo ""
echo "Next steps:"
echo "1. Add configuration to ~/.claude/settings.json"
echo "   (See settings.example.json for reference)"
echo ""
echo "2. Restart Claude Code"
echo ""
echo "Example settings.json:"
cat << 'EOF'
{
  "permissions": {
    "allow": ["Bash(\"$HOME/.claude/commands/cc-fast.sh\":*)"]
  },
  "statusLine": {
    "type": "command",
    "command": "$HOME/.claude/statusline/statusline.sh"
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/cc-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/pending-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/send-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/queue-hook.sh" }] },
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/sendqueue-hook.sh" }] }
    ]
  }
}
EOF
echo ""
echo "Done!"
