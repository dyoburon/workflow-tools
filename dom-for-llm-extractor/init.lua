-- DOM for LLM Extractor
-- Hotkey: Cmd+Shift+M
-- Drag a rectangle in browser to extract DOM info for LLM consumption
--
-- Supports:
-- - Chrome, Safari, Arc, Edge: Direct AppleScript JS injection
-- - Firefox: Auto-clicks bookmarklet via System Events (requires bookmarklet named "DOM Extractor")

local scriptDir = debug.getinfo(1, "S").source:match("@(.*/)")

-- Load minified JS
local jsFile = io.open(scriptDir .. "dom-extractor.min.js", "r")
if not jsFile then
    hs.alert.show("DOM Extractor: Could not load dom-extractor.min.js")
    return
end
local domExtractorJS = jsFile:read("*all")
jsFile:close()

-- Escape JS for AppleScript embedding
local function escapeForAppleScript(js)
    return js:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n')
end

local escapedJS = escapeForAppleScript(domExtractorJS)

-- Firefox: Find and click DOM Extractor bookmarklet via System Events
local function executeInFirefox()
    local script = [[
        tell application "Firefox" to activate
        delay 0.1
        tell application "System Events"
            tell process "Firefox"
                -- Exact names to match (in priority order)
                set searchTerms to {"Dom Extractor", "DOM Extractor", "dom-extractor", "DOMExtractor", "dom extractor"}
                set bookmarksMenu to menu 1 of menu bar item "Bookmarks" of menu bar 1
                set allMenus to {bookmarksMenu}
                
                try
                    set end of allMenus to menu 1 of menu item "Bookmarks Toolbar" of bookmarksMenu
                end try
                try
                    set end of allMenus to menu 1 of menu item "Other Bookmarks" of bookmarksMenu
                end try
                
                -- First pass: exact match only
                repeat with currentMenu in allMenus
                    repeat with menuItem in menu items of currentMenu
                        try
                            set itemName to name of menuItem
                            if itemName is not missing value then
                                repeat with term in searchTerms
                                    if itemName is equal to contents of term then
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
        hs.alert.show("Firefox: Bookmarklet not found.\n\nCreate bookmark named exactly:\n'Dom Extractor'")
    end
end

hs.hotkey.bind({"cmd", "shift"}, "M", function()
    local app = hs.application.frontmostApplication()
    local appName = app:name()

    if appName == "Google Chrome" or appName == "Google Chrome Canary" then
        hs.osascript.applescript('tell application "' .. appName .. '" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Safari" then
        hs.osascript.applescript('tell application "Safari" to do JavaScript "' .. escapedJS .. '" in front document')
    elseif appName == "Arc" then
        hs.osascript.applescript('tell application "Arc" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Microsoft Edge" then
        hs.osascript.applescript('tell application "Microsoft Edge" to execute front window\'s active tab javascript "' .. escapedJS .. '"')
    elseif appName == "Firefox" or appName == "Firefox Developer Edition" then
        executeInFirefox()
    else
        hs.alert.show("DOM Extractor: Unsupported browser\n" .. appName)
    end
end)
