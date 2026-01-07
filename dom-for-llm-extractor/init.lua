-- DOM for LLM Extractor
-- Hotkeys:
--   Cmd+Shift+M - Drag mode: Drag a rectangle to extract multiple elements
--   Cmd+Shift+K - Precision mode: Hover to inspect, click to capture single element
--
-- Supports:
-- - Chrome, Safari, Arc, Edge: Direct AppleScript JS injection
-- - Firefox: Auto-clicks bookmarklet via System Events (requires bookmarklet)

local scriptDir = debug.getinfo(1, "S").source:match("@(.*/)")

-- Load minified JS for drag mode
local jsFile = io.open(scriptDir .. "dom-extractor.min.js", "r")
if not jsFile then
    hs.alert.show("DOM Extractor: Could not load dom-extractor.min.js")
    return
end
local domExtractorJS = jsFile:read("*all")
jsFile:close()

-- Load precision inspector JS (use non-minified for now, minify later)
local precisionFile = io.open(scriptDir .. "precision-inspector.min.js", "r")
if not precisionFile then
    -- Fallback to non-minified version
    precisionFile = io.open(scriptDir .. "precision-inspector.js", "r")
end
local precisionInspectorJS = ""
if precisionFile then
    precisionInspectorJS = precisionFile:read("*all")
    precisionFile:close()
end

-- Escape JS for AppleScript embedding
local function escapeForAppleScript(js)
    return js:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n')
end

local escapedJS = escapeForAppleScript(domExtractorJS)
local escapedPrecisionJS = escapeForAppleScript(precisionInspectorJS)

-- Firefox: Find and click bookmarklet via System Events
local function executeInFirefox(bookmarkletName, displayName)
    local searchTerms = ""
    if bookmarkletName == "DOM Extractor" then
        searchTerms = '{"Dom Extractor", "DOM Extractor", "dom-extractor", "DOMExtractor", "dom extractor"}'
    else
        searchTerms = '{"Precision Inspector", "precision-inspector", "PrecisionInspector", "precision inspector"}'
    end
    
    local script = [[
        tell application "Firefox" to activate
        delay 0.1
        tell application "System Events"
            tell process "Firefox"
                -- Exact names to match (in priority order)
                set searchTerms to ]] .. searchTerms .. [[
                
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
        hs.alert.show("Firefox: Bookmarklet not found.\n\nCreate bookmark named exactly:\n'" .. displayName .. "'")
    end
end

-- Helper function to execute JS in browser
local function executeInBrowser(js, modeName)
    local app = hs.application.frontmostApplication()
    local appName = app:name()

    if appName == "Google Chrome" or appName == "Google Chrome Canary" then
        hs.osascript.applescript('tell application "' .. appName .. '" to execute front window\'s active tab javascript "' .. js .. '"')
    elseif appName == "Safari" then
        hs.osascript.applescript('tell application "Safari" to do JavaScript "' .. js .. '" in front document')
    elseif appName == "Arc" then
        hs.osascript.applescript('tell application "Arc" to execute front window\'s active tab javascript "' .. js .. '"')
    elseif appName == "Microsoft Edge" then
        hs.osascript.applescript('tell application "Microsoft Edge" to execute front window\'s active tab javascript "' .. js .. '"')
    elseif appName == "Firefox" or appName == "Firefox Developer Edition" then
        if modeName == "precision" then
            executeInFirefox("Precision Inspector", "Precision Inspector")
        else
            executeInFirefox("DOM Extractor", "Dom Extractor")
        end
    else
        hs.alert.show("DOM Extractor: Unsupported browser\n" .. appName)
    end
end

-- Cmd+Shift+M: Drag mode (original DOM Extractor)
hs.hotkey.bind({"cmd", "shift"}, "M", function()
    executeInBrowser(escapedJS, "drag")
end)

-- Cmd+Shift+K: Precision mode (hover to inspect, click to capture)
hs.hotkey.bind({"cmd", "shift"}, "K", function()
    if precisionInspectorJS == "" then
        hs.alert.show("Precision Inspector: Could not load precision-inspector.js")
        return
    end
    executeInBrowser(escapedPrecisionJS, "precision")
end)
