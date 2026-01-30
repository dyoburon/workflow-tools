-- Screenshot to Clipboard Path (Cmd+Option+S)
-- Takes interactive screenshot, saves to file, copies PATH to clipboard
-- Requires: Hammerspoon (https://www.hammerspoon.org/)

local screenshotDir = os.getenv("HOME") .. "/Documents/Screenshots"
hs.fs.mkdir(screenshotDir)

hs.hotkey.bind({"cmd", "alt"}, "S", function()
    local timestamp = os.date("%Y-%m-%d_%H-%M-%S")
    local filename = screenshotDir .. "/screenshot_" .. timestamp .. ".png"

    local task = hs.task.new("/usr/sbin/screencapture", function(exitCode)
        if exitCode == 0 then
            hs.pasteboard.setContents(filename)
            hs.alert.show("Path copied!")
        end
    end, {"-i", "-x", filename})

    task:start()
end)
