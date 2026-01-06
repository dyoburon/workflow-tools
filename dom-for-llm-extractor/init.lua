-- DOM for LLM Extractor - Universal Browser Support
-- Cmd+Shift+M to activate in any browser
--
-- Supports:
-- - Chrome, Safari, Arc, Edge: Direct AppleScript injection
-- - Firefox: Bookmarklet click (requires one-time bookmarklet setup)

local scriptDir = debug.getinfo(1, "S").source:match("@(.*/)")
local jsFile = io.open(scriptDir .. "page-measure-enhanced-fixed.min.js", "r")
if not jsFile then
    hs.alert.show("Error: Could not find page-measure-enhanced-fixed.min.js")
    return
end
local pageMeasureJS = jsFile:read("*all")
jsFile:close()

-- Firefox: Find and click DOM Extractor bookmarklet in any location
local function executeInFirefox()
    local script = [[
        tell application "Firefox" to activate
        delay 0.1
        tell application "System Events"
            tell process "Firefox"
                set searchTerms to {"DOM Extractor", "Dom Extractor", "dom-extractor", "DOMExtractor", "dom extractor"}
                set bookmarksMenu to menu 1 of menu bar item "Bookmarks" of menu bar 1
                set allMenus to {bookmarksMenu}
                
                try
                    set end of allMenus to menu 1 of menu item "Bookmarks Toolbar" of bookmarksMenu
                end try
                try
                    set end of allMenus to menu 1 of menu item "Other Bookmarks" of bookmarksMenu
                end try
                
                repeat with currentMenu in allMenus
                    repeat with menuItem in menu items of currentMenu
                        try
                            set itemName to name of menuItem
                            if itemName is not missing value then
                                repeat with term in searchTerms
                                    if itemName contains contents of term then
                                        click menuItem
                                        return true
                                    end if
                                end repeat
                            end if
                        end try
                    end repeat
                end repeat
                return false
            end tell
        end tell
    ]]
    
    local ok, result = hs.osascript.applescript(script)
    if not ok or result == false then
        hs.alert.show("Firefox: Bookmarklet not found.\n\nCreate a bookmark named 'DOM Extractor'\nwith the bookmarklet code.")
    end
end

hs.hotkey.bind({"cmd", "shift"}, "M", function()
    local app = hs.application.frontmostApplication()
    local appName = app:name()
    local escapedJS = pageMeasureJS:gsub('\\', '\\\\'):gsub('"', '\\"')

    if appName == "Google Chrome" or appName == "Google Chrome Canary" then
        hs.osascript.applescript('tell application "' .. appName .. '" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Safari" then
        hs.osascript.applescript('tell application "Safari" to do JavaScript "' .. escapedJS .. '" in front document')
    elseif appName == "Arc" then
        hs.osascript.applescript('tell application "Arc" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Microsoft Edge" then
        hs.osascript.applescript('tell application "Microsoft Edge" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Firefox" then
        executeInFirefox()
    else
        hs.alert.show("DOM Extractor: Unsupported browser\n\nSupported: Chrome, Safari, Arc, Edge, Firefox")
    end
end)
