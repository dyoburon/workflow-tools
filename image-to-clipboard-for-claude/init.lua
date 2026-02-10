-- Screenshot to Clipboard (Cmd+Option+S)
-- Takes interactive screenshot, copies image data to clipboard
-- Requires: Hammerspoon (https://www.hammerspoon.org/)

hs.hotkey.bind({"cmd", "alt"}, "S", function()
    local task = hs.task.new("/usr/sbin/screencapture", function(exitCode)
        if exitCode == 0 then
            hs.alert.show("Screenshot copied!")
        end
    end, {"-c", "-i", "-x"})

    task:start()
end)
