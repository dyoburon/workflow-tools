-- Page Measure Tool (Cmd+Shift+M)
-- Injects a measurement overlay into the current browser tab
-- Drag a rectangle, captures DOM context and copies to clipboard

-- Load minified JS from file
local scriptDir = debug.getinfo(1, "S").source:match("@(.*/)")
local jsFile = io.open(scriptDir .. "page-measure-enhanced-fixed.min.js", "r")
local pageMeasureJS = jsFile:read("*all")
jsFile:close()

hs.hotkey.bind({"cmd", "shift"}, "M", function()
    local app = hs.application.frontmostApplication()
    local appName = app:name()

    local escapedJS = pageMeasureJS:gsub('\\', '\\\\'):gsub('"', '\\"')

    if appName == "Google Chrome" or appName == "Google Chrome Canary" then
        local script = 'tell application "Google Chrome" to execute front window\'s active tab javascript "' .. escapedJS .. '"'
        hs.osascript.applescript(script)
    elseif appName == "Safari" then
        local script = 'tell application "Safari" to do JavaScript "' .. escapedJS .. '" in front document'
        hs.osascript.applescript(script)
    elseif appName == "Arc" then
        local script = 'tell application "Arc" to execute front window\'s active tab javascript "' .. escapedJS .. '"'
        hs.osascript.applescript(script)
    else
        hs.alert.show("Page Measure: Not in a supported browser")
    end
end)
