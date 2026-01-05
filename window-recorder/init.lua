-- Window Recorder for Hammerspoon
-- Record window positions with a hotkey, replay them with another
-- https://github.com/burtond/window-recorder

require("hs.ipc")

-- Saved window positions (persisted to file)
local savedPositions = {}
local nextSlot = 2
local saveFile = os.getenv("HOME") .. "/.hammerspoon/window-positions.json"

-- Exit fullscreen if needed, then apply frame
local function setWindowFrame(win, frame)
    if win:isFullScreen() then
        win:setFullScreen(false)
        -- Wait for fullscreen animation to complete
        hs.timer.doAfter(0.5, function()
            win:setFrame(frame)
        end)
    else
        win:setFrame(frame)
    end
end

-- Load saved positions from file
local function loadPositions()
    local file = io.open(saveFile, "r")
    if file then
        local content = file:read("*all")
        file:close()
        if content and content ~= "" then
            local decoded = hs.json.decode(content)
            if decoded and decoded.positions then
                nextSlot = decoded.nextSlot or 2
                -- Rebind hotkeys for saved positions (keys are strings from JSON)
                for slot, pos in pairs(decoded.positions) do
                    local slotNum = tonumber(slot)
                    savedPositions[slotNum] = pos
                    hs.hotkey.bind({"cmd", "alt"}, slot, function()
                        local w = hs.window.focusedWindow()
                        if w then
                            setWindowFrame(w, hs.geometry.rect(pos.x, pos.y, pos.w, pos.h))
                        end
                    end)
                end
            end
        end
    end
end

-- Save positions to file
local function savePositions()
    -- Convert numeric keys to strings for JSON compatibility
    local positionsToSave = {}
    for k, v in pairs(savedPositions) do
        positionsToSave[tostring(k)] = v
    end
    local data = hs.json.encode({positions = positionsToSave, nextSlot = nextSlot}, true)
    local file = io.open(saveFile, "w")
    if file then
        file:write(data)
        file:close()
    end
end

-- Load on startup
loadPositions()

-- Preset slot 1 (edit these values to your preference)
hs.hotkey.bind({"cmd", "alt"}, "1", function()
    local win = hs.window.focusedWindow()
    if win then
        setWindowFrame(win, hs.geometry.rect(100, 100, 800, 600))
    end
end)

-- Cmd+Option+R: Record current window position to next available slot
hs.hotkey.bind({"cmd", "alt"}, "R", function()
    local win = hs.window.focusedWindow()
    if not win then
        hs.alert.show("No window focused")
        return
    end

    if nextSlot > 9 then
        hs.alert.show("All slots (2-9) are full! Reload config to reset.")
        return
    end

    local f = win:frame()
    local slot = nextSlot

    savedPositions[slot] = {x = f.x, y = f.y, w = f.w, h = f.h}

    hs.hotkey.bind({"cmd", "alt"}, tostring(slot), function()
        local w = hs.window.focusedWindow()
        if w then
            local pos = savedPositions[slot]
            setWindowFrame(w, hs.geometry.rect(pos.x, pos.y, pos.w, pos.h))
        end
    end)

    hs.alert.show("Saved to Cmd+Option+" .. slot)
    nextSlot = nextSlot + 1
    savePositions()  -- Persist to disk
end)

-- Cmd+Option+0: Show all saved positions
hs.hotkey.bind({"cmd", "alt"}, "0", function()
    local msg = "Saved positions:\n"
    msg = msg .. "1: Preset\n"
    for i = 2, nextSlot - 1 do
        local p = savedPositions[i]
        msg = msg .. i .. ": " .. p.x .. "," .. p.y .. " (" .. p.w .. "x" .. p.h .. ")\n"
    end
    hs.alert.show(msg, 3)
end)

-- Cmd+Option+Period: Clear all saved positions
hs.hotkey.bind({"cmd", "alt"}, ".", function()
    savedPositions = {}
    nextSlot = 2
    -- Clear the file
    local file = io.open(saveFile, "w")
    if file then
        file:write("")
        file:close()
    end
    hs.alert.show("Cleared all saved positions")
    -- Reload to unbind old hotkeys
    hs.reload()
end)

-- Page Measure Tool (Cmd+Shift+M)
-- Injects a measurement overlay into the current browser tab
-- Drag a rectangle, captures element metadata and copies to clipboard
local pageMeasureJS = [[
!function(){if(document.getElementById('page-measure-overlay'))return void document.getElementById('page-measure-overlay').remove();let t,e,n;const o=window.innerWidth,i=window.innerHeight,s=document.createElement('div');function l(t,e=2e3){const n=document.createElement('div');Object.assign(n.style,{position:'fixed',top:'20px',right:'20px',background:'#333',color:'#fff',padding:'16px 24px',borderRadius:'8px',fontSize:'13px',fontFamily:'monospace',zIndex:'2147483647',boxShadow:'0 4px 12px rgba(0,0,0,0.3)',maxWidth:'400px',whiteSpace:'pre-wrap',lineHeight:'1.4'}),n.textContent=t,document.body.appendChild(n),setTimeout(()=>n.remove(),e)}function r(t){let e=t.tagName.toLowerCase();if(t.id&&(e+='#'+t.id),t.className&&'string'==typeof t.className){const n=t.className.trim().split(/\s+/).filter(t=>t&&!t.includes(':'));n.length>0&&(e+='.'+n.slice(0,3).join('.'))}return e}function a(t){const e=(t.textContent||'').replace(/\s+/g,' ').trim();return e.length>60?e.substring(0,60)+'...':e}function c(t,e){const n=[],s=(t.left/o*100).toFixed(1),l=(t.top/i*100).toFixed(1),c=((t.right-t.left)/o*100).toFixed(1),d=((t.bottom-t.top)/i*100).toFixed(1);if(n.push('SELECTION'),n.push(`Position: ${s}% left, ${l}% top`),n.push(`Size: ${c}% x ${d}%`),n.push(''),0===e.length)n.push('No elements found in selection');else{const t=e[0];n.push('PRIMARY ELEMENT'),n.push(`Tag: ${r(t.el)}`);const o=a(t.el);o&&n.push(`Text: '${o}'`),n.push(`Selector: ${function(t){if(t.id)return'#'+t.id;let e=[];for(;t&&t.nodeType===Node.ELEMENT_NODE;){let n=t.tagName.toLowerCase();if(t.id){n='#'+t.id,e.unshift(n);break}if(t.className&&'string'==typeof t.className){const e=t.className.trim().split(/\s+/).filter(t=>t&&!t.includes(':'));e.length>0&&(n+='.'+e.slice(0,2).join('.'))}e.unshift(n),t=t.parentElement}return e.slice(-4).join(' > ')}(t.el)}`);const i=function(t){const e=t.offsetParent||t.parentElement;if(!e)return null;const n=t.getBoundingClientRect(),o=e.getBoundingClientRect();return{left:((n.left-o.left)/o.width*100).toFixed(1),top:((n.top-o.top)/o.height*100).toFixed(1),parentSelector:r(e)}}(t.el);if(i&&n.push(`In parent (${i.parentSelector}): ${i.left}% left, ${i.top}% top`),e.length>1){n.push(''),n.push(`OTHER ELEMENTS (${e.length-1}):`);for(let t=1;t<Math.min(e.length,6);t++){const o=e[t],i=a(o.el),s=i?` '${i.substring(0,30)}${i.length>30?'...':''}'`:'';n.push(`- ${r(o.el)}${s}`)}e.length>6&&n.push(`  ... and ${e.length-6} more`)}}return n.join('\n')}s.id='page-measure-overlay',Object.assign(s.style,{position:'fixed',top:'0',left:'0',width:'100vw',height:'100vh',cursor:'crosshair',zIndex:'2147483647',background:'transparent'}),s.addEventListener('mousedown',function(o){t=o.clientX,e=o.clientY,n=document.createElement('div'),Object.assign(n.style,{position:'fixed',border:'2px solid #0066ff',background:'rgba(0, 102, 255, 0.1)',pointerEvents:'none',zIndex:'2147483647'}),s.appendChild(n),n.style.left=t+'px',n.style.top=e+'px',n.style.width='0',n.style.height='0'}),s.addEventListener('mousemove',function(o){if(!n)return;const i=Math.min(t,o.clientX),s=Math.min(e,o.clientY),l=Math.abs(o.clientX-t),r=Math.abs(o.clientY-e);Object.assign(n.style,{left:i+'px',top:s+'px',width:l+'px',height:r+'px'})}),s.addEventListener('mouseup',function(o){if(!n)return;const i={left:Math.min(t,o.clientX),top:Math.min(e,o.clientY),right:Math.max(t,o.clientX),bottom:Math.max(e,o.clientY)};s.style.display='none';const r=function(t){const e=[],o=new Set;for(let i=t.left;i<=t.right;i+=10)for(let l=t.top;l<=t.bottom;l+=10){const r=document.elementsFromPoint(i,l);for(const i of r){if(i===s||i===n||i===document.body||i===document.documentElement)continue;if(o.has(i))continue;o.add(i);const l=i.getBoundingClientRect(),r=Math.max(t.left,l.left),a=Math.min(t.right,l.right),c=Math.max(t.top,l.top),d=Math.min(t.bottom,l.bottom);if(a>r&&d>c){const t=(a-r)*(d-c),n=l.width*l.height,o=n>0?t/n:0;o>.3&&e.push({el:i,rect:l,area:n,coverage:o})}}}return e.sort((t,e)=>t.area-e.area),e}(i);s.style.display='block';const a=c(i,r);navigator.clipboard.writeText(a).then(()=>l('Copied!\n\n'+a.substring(0,200)+(a.length>200?'...':''),3e3)).catch(()=>l('Failed to copy')),s.remove()}),document.addEventListener('keydown',t=>{'Escape'===t.key&&s.remove()}),document.body.appendChild(s)}();
]]

hs.hotkey.bind({"cmd", "shift"}, "M", function()
    print("Page Measure: hotkey triggered")
    local app = hs.application.frontmostApplication()
    local appName = app:name()
    print("Page Measure: frontmost app is " .. appName)

    if appName == "Google Chrome" or appName == "Google Chrome Canary" then
        local script = string.format([[
            tell application "Google Chrome"
                execute front window's active tab javascript "%s"
            end tell
        ]], pageMeasureJS:gsub('"', '\\"'))
        local ok, result, rawOutput = hs.osascript.applescript(script)
        print("Page Measure: AppleScript result - ok=" .. tostring(ok) .. ", result=" .. tostring(result))
        if rawOutput then print("Page Measure: rawOutput=" .. tostring(rawOutput)) end
    elseif appName == "Safari" then
        local script = string.format([[
            tell application "Safari"
                do JavaScript "%s" in front document
            end tell
        ]], pageMeasureJS:gsub('"', '\\"'))
        hs.osascript.applescript(script)
    elseif appName == "Arc" then
        local script = string.format([[
            tell application "Arc"
                execute front window's active tab javascript "%s"
            end tell
        ]], pageMeasureJS:gsub('"', '\\"'))
        hs.osascript.applescript(script)
    else
        hs.alert.show("Page Measure: Not in a supported browser")
    end
end)

-- Screenshot to Clipboard Path (Cmd+Option+S)
-- Takes interactive screenshot, saves to file, copies PATH to clipboard
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

-- Cmd+Option+K: Show all hotkeys cheat sheet
hs.hotkey.bind({"cmd", "alt"}, "K", function()
    hs.alert.show([[
Hotkeys:
⌘⌥1-9  Snap to window position
⌘⌥R    Record window position
⌘⌥0    Show saved positions
⌘⌥.    Clear all positions
⌘⇧M    Page measure (DOM context)
⌘⌥S    Screenshot → path to clipboard
⌘⌥K    This help
]], 5)
end)
