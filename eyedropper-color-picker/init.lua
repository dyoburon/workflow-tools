-- Eyedropper Color Picker for Hammerspoon
-- Press Cmd+Option+E to activate, click anywhere to grab hex color, Escape to cancel
-- Copies hex value (#RRGGBB) to clipboard
-- Works system-wide in any app/window
-- Zero dependencies: uses screencapture + sips + raw BMP byte reading

local eyedropperTap = nil

local function eyedropperReadColor(x, y)
    local tmpPng = os.tmpname() .. ".png"
    local tmpBmp = os.tmpname() .. ".bmp"
    -- Capture 1x1 pixel at click location
    hs.task.new("/usr/sbin/screencapture", function(exitCode)
        if exitCode ~= 0 then
            os.remove(tmpPng)
            hs.alert.show("Eyedropper: Capture failed")
            return
        end
        -- Convert to BMP for raw pixel reading
        os.execute("/usr/bin/sips -s format bmp " .. tmpPng .. " -o " .. tmpBmp .. " >/dev/null 2>&1")
        os.remove(tmpPng)
        local f = io.open(tmpBmp, "rb")
        if not f then
            hs.alert.show("Eyedropper: Could not process image")
            return
        end
        local header = f:read(14)
        if not header or #header < 14 then
            f:close()
            os.remove(tmpBmp)
            hs.alert.show("Eyedropper: Invalid image")
            return
        end
        local offset = header:byte(11) + header:byte(12) * 256
        f:seek("set", offset)
        local pixel = f:read(4)
        f:close()
        os.remove(tmpBmp)
        if not pixel or #pixel < 3 then
            hs.alert.show("Eyedropper: Could not read pixel")
            return
        end
        -- BMP stores pixels as BGRA
        local b, g, r = pixel:byte(1), pixel:byte(2), pixel:byte(3)
        local hex = string.format("#%02X%02X%02X", r, g, b)
        hs.pasteboard.setContents(hex)
        hs.alert.show("Copied: " .. hex, 2)
    end, {"-x", "-R", string.format("%d,%d,1,1", math.floor(x), math.floor(y)), tmpPng}):start()
end

local function eyedropperStop()
    if eyedropperTap then
        eyedropperTap:stop()
        eyedropperTap = nil
    end
end

hs.hotkey.bind({"cmd", "alt"}, "E", function()
    if eyedropperTap then
        eyedropperStop()
        hs.alert.show("Eyedropper off", 1)
        return
    end
    hs.alert.show("Eyedropper: click to pick color (Esc to cancel)", 2)
    eyedropperTap = hs.eventtap.new({
        hs.eventtap.event.types.leftMouseDown,
        hs.eventtap.event.types.keyDown
    }, function(event)
        if event:getType() == hs.eventtap.event.types.keyDown then
            -- Escape key = 53
            if event:getKeyCode() == 53 then
                eyedropperStop()
                hs.alert.show("Eyedropper cancelled", 1)
                return true
            end
            return false
        end
        -- Left click: grab color at mouse position
        local pos = hs.mouse.absolutePosition()
        eyedropperStop()
        eyedropperReadColor(pos.x, pos.y)
        return true
    end)
    eyedropperTap:start()
end)
