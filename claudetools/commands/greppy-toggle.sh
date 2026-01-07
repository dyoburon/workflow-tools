#!/bin/bash
# Toggle greppy on/off for a project
# Usage:
#   greppy-toggle.sh [project-path]     - Toggle greppy
#   greppy-toggle.sh status [project]   - Check current status
#   greppy-toggle.sh on [project]       - Enable greppy
#   greppy-toggle.sh off [project]      - Disable greppy

ACTION="${1:-toggle}"
PROJECT_PATH="${2:-$(pwd)}"

# Handle if first arg is a path (no action specified)
if [[ "$ACTION" == /* ]] || [[ "$ACTION" == "." ]]; then
    PROJECT_PATH="$ACTION"
    ACTION="toggle"
fi

CLAUDE_DIR="$PROJECT_PATH/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
SETTINGS_GREPPY="$CLAUDE_DIR/settings.greppy.json"
SETTINGS_NOGREPPY="$CLAUDE_DIR/settings.nogreppy.json"

# Check if .claude directory exists
if [ ! -d "$CLAUDE_DIR" ]; then
    echo "Error: No .claude directory found in $PROJECT_PATH"
    exit 1
fi

# Determine current state by checking if hooks are configured
is_greppy_enabled() {
    if [ -f "$SETTINGS" ]; then
        if grep -q '"matcher"' "$SETTINGS" 2>/dev/null; then
            return 0  # enabled
        fi
    fi
    return 1  # disabled
}

case "$ACTION" in
    status)
        if is_greppy_enabled; then
            echo "Greppy: ENABLED"
        else
            echo "Greppy: DISABLED"
        fi
        ;;

    on)
        if [ -f "$SETTINGS_GREPPY" ]; then
            cp "$SETTINGS_GREPPY" "$SETTINGS"
            echo "Greppy: ENABLED"
        else
            echo "Error: No settings.greppy.json found. Creating from current settings..."
            # Create greppy settings with hooks
            cat > "$SETTINGS" << 'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Grep",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'BLOCKED: Use greppy instead. Run: greppy search \"query\" for semantic search, or greppy exact \"pattern\" for exact matches.' && exit 1"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(greppy:*)"
    ]
  }
}
EOF
            cp "$SETTINGS" "$SETTINGS_GREPPY"
            echo "Greppy: ENABLED (created new settings)"
        fi
        ;;

    off)
        # Save current as greppy version if it has hooks
        if is_greppy_enabled && [ ! -f "$SETTINGS_GREPPY" ]; then
            cp "$SETTINGS" "$SETTINGS_GREPPY"
        fi

        if [ -f "$SETTINGS_NOGREPPY" ]; then
            cp "$SETTINGS_NOGREPPY" "$SETTINGS"
        else
            # Create empty settings
            echo '{"hooks": {}, "permissions": {"allow": []}}' > "$SETTINGS"
        fi
        echo "Greppy: DISABLED"
        ;;

    toggle)
        if is_greppy_enabled; then
            # Currently enabled, disable it
            # Save current as greppy version
            cp "$SETTINGS" "$SETTINGS_GREPPY"

            if [ -f "$SETTINGS_NOGREPPY" ]; then
                cp "$SETTINGS_NOGREPPY" "$SETTINGS"
            else
                echo '{"hooks": {}, "permissions": {"allow": []}}' > "$SETTINGS"
            fi
            echo "Greppy: DISABLED"
        else
            # Currently disabled, enable it
            if [ -f "$SETTINGS_GREPPY" ]; then
                cp "$SETTINGS_GREPPY" "$SETTINGS"
                echo "Greppy: ENABLED"
            else
                echo "Error: No settings.greppy.json found to restore"
                exit 1
            fi
        fi
        ;;

    *)
        echo "Usage: greppy-toggle.sh [action] [project-path]"
        echo ""
        echo "Actions:"
        echo "  status    - Check if greppy is enabled"
        echo "  on        - Enable greppy"
        echo "  off       - Disable greppy"
        echo "  toggle    - Toggle greppy (default)"
        echo ""
        echo "Examples:"
        echo "  greppy-toggle.sh                    # Toggle in current directory"
        echo "  greppy-toggle.sh off                # Disable in current directory"
        echo "  greppy-toggle.sh status /path/to   # Check status for specific project"
        ;;
esac
