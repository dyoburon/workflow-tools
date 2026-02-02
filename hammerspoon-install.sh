#!/bin/bash
# Hammerspoon Tools Installer
# Installs: force-alt-tab + window-recorder + dom-for-llm-extractor
# macOS only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "Hammerspoon Tools Installer"
echo "==========================="
echo ""

# Check OS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Error: Hammerspoon is macOS only."
    echo "These tools won't work on your system."
    exit 1
fi

# Check if Hammerspoon is installed
if [ ! -d "/Applications/Hammerspoon.app" ] && ! command -v hs &> /dev/null; then
    echo "Hammerspoon not found!"
    echo ""
    echo "Install it first:"
    echo "  brew install --cask hammerspoon"
    echo ""
    echo "Then run this installer again."
    exit 1
fi

echo "This will install:"
echo "  - force-alt-tab: Makes Cmd+Tab always unhide apps"
echo "  - window-recorder: Record & replay window positions"
echo "  - dom-for-llm-extractor: Page measure tool for DOM context"
echo "  - eyedropper-color-picker: Pick hex color from any pixel on screen"
echo ""

# Check for existing config
if [ -f ~/.hammerspoon/init.lua ]; then
    echo "Existing ~/.hammerspoon/init.lua found."
    echo ""
    echo "Options:"
    echo "  1) Replace (backup existing to init.lua.backup)"
    echo "  2) Append to existing config"
    echo "  3) Cancel"
    echo ""
    read -p "Select [1-3]: " choice

    case $choice in
        1)
            cp ~/.hammerspoon/init.lua ~/.hammerspoon/init.lua.backup
            echo "Backed up to init.lua.backup"
            MODE="replace"
            ;;
        2)
            MODE="append"
            ;;
        *)
            echo "Cancelled."
            exit 0
            ;;
    esac
else
    mkdir -p ~/.hammerspoon
    MODE="replace"
fi

# Generate config
generate_config() {
    echo "-- =================================================="
    echo "-- Workflow Tools - Hammerspoon Config"
    echo "-- =================================================="
    echo ""
    echo "-- Force Alt-Tab"
    echo "-- Makes Cmd+Tab always unhide and raise apps"
    echo ""
    cat "$SCRIPT_DIR/force-alt-tab/init.lua"
    echo ""
    echo ""
    echo "-- =================================================="
    echo "-- Window Recorder"
    echo "-- Record and replay window positions with hotkeys"
    echo "-- Cmd+Option+R to record, Cmd+Option+2-9 to replay"
    echo "-- =================================================="
    echo ""
    cat "$SCRIPT_DIR/window-recorder/init.lua"
    echo ""
    echo ""
    echo "-- =================================================="
    echo "-- Page Measure (DOM for LLM Extractor)"
    echo "-- Cmd+Shift+M to measure and capture DOM context"
    echo "-- =================================================="
    echo ""
    echo "local pageMeasureJS = [["
    cat "$SCRIPT_DIR/dom-for-llm-extractor/page-measure-enhanced-fixed.min.js"
    echo "]]"
    echo ""
    echo 'hs.hotkey.bind({"cmd", "shift"}, "M", function()'
    echo '    local app = hs.application.frontmostApplication()'
    echo '    local appName = app:name()'
    echo ''
    echo '    local escapedJS = pageMeasureJS:gsub('\''\\\\'\'',' '\''\\\\\\\\'\'')'
    echo '    escapedJS = escapedJS:gsub('\''"'\'', '\''\\\\\"'\'')'
    echo ''
    echo '    if appName == "Google Chrome" or appName == "Google Chrome Canary" then'
    echo '        local script = '\''tell application "Google Chrome" to execute front window\\'\''s active tab javascript "'\'' .. escapedJS .. '\''"'\'''
    echo '        hs.osascript.applescript(script)'
    echo '    elseif appName == "Safari" then'
    echo '        local script = '\''tell application "Safari" to do JavaScript "'\'' .. escapedJS .. '\''" in front document'\'''
    echo '        hs.osascript.applescript(script)'
    echo '    elseif appName == "Arc" then'
    echo '        local script = '\''tell application "Arc" to execute front window\\'\''s active tab javascript "'\'' .. escapedJS .. '\''"'\'''
    echo '        hs.osascript.applescript(script)'
    echo '    else'
    echo '        hs.alert.show("Page Measure: Not in a supported browser")'
    echo '    end'
    echo 'end)'
    echo ""
    echo ""
    echo "-- =================================================="
    echo "-- Eyedropper Color Picker"
    echo "-- Cmd+Option+E to pick hex color from any pixel"
    echo "-- =================================================="
    echo ""
    cat "$SCRIPT_DIR/eyedropper-color-picker/init.lua"
}

if [ "$MODE" = "replace" ]; then
    generate_config > ~/.hammerspoon/init.lua
else
    echo "" >> ~/.hammerspoon/init.lua
    generate_config >> ~/.hammerspoon/init.lua
fi

echo ""
echo "✓ Installed to ~/.hammerspoon/init.lua"
echo ""
echo "Next steps:"
echo "  1. Open Hammerspoon (if not running)"
echo "  2. Click menubar icon → Reload Config"
echo ""
echo "Usage:"
echo "  - Cmd+Tab now always unhides apps"
echo "  - Cmd+Option+R to record window position"
echo "  - Cmd+Option+2-9 to restore positions"
echo "  - Cmd+Shift+M to measure page elements (in browser)"
echo "  - Cmd+Option+E to pick hex color from any pixel"
echo ""
