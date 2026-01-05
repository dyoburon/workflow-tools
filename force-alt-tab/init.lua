-- Force Alt-Tab (Cmd+Tab) to always unhide apps on macOS
-- https://github.com/burtond/force-alt-tab
--
-- Problem: On macOS, Cmd+Tab to a hidden app doesn't always bring it forward.
-- You have to press Cmd+Option while releasing Tab, or click the dock icon.
--
-- Solution: This script detects Cmd+Tab specifically and unhides the app.

require("hs.ipc")

local cmdTabPressed = false
local unhideTimer = nil

-- Watch for Cmd+Tab keypress
local cmdTabWatcher = hs.eventtap.new({hs.eventtap.event.types.keyDown}, function(event)
    local keyCode = event:getKeyCode()
    local flags = event:getFlags()

    -- Tab key = 48, check if Cmd is held
    if keyCode == 48 and flags.cmd then
        cmdTabPressed = true
        -- Reset flag after a short delay
        hs.timer.doAfter(0.5, function()
            cmdTabPressed = false
        end)
    end
    return false  -- Don't block the event
end)
cmdTabWatcher:start()

-- Only unhide if Cmd+Tab was used
local appWatcher = hs.application.watcher.new(function(appName, eventType, appObject)
    if eventType == hs.application.watcher.activated and cmdTabPressed then
        -- Small delay to let the switch complete
        if unhideTimer then unhideTimer:stop() end
        unhideTimer = hs.timer.doAfter(0.05, function()
            local app = hs.application.frontmostApplication()
            if app then
                app:unhide()
                -- Raise all windows to bring them forward
                local wins = app:allWindows()
                for _, win in ipairs(wins) do
                    win:raise()
                end
            end
        end)
    end
end)
appWatcher:start()

-- Restart watchers after wake from sleep
local sleepWatcher = hs.caffeinate.watcher.new(function(event)
    if event == hs.caffeinate.watcher.systemDidWake then
        cmdTabWatcher:stop()
        cmdTabWatcher:start()
        appWatcher:stop()
        appWatcher:start()
    end
end)
sleepWatcher:start()
