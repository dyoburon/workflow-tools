# DOM for LLM Extractor - How It Currently Works

Technical documentation for the DOM extraction tool.

## Architecture Overview

```
User Press Cmd+Shift+M
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hammerspoon (init.lua)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Detect frontmost browser                    │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                      │            │
│         ▼                                      ▼            │
│  ┌─────────────────────┐            ┌──────────────────┐   │
│  │ Chrome/Safari/Arc/  │            │     Firefox      │   │
│  │   Edge: AppleScript │            │  System Events   │   │
│  │   JS Injection      │            │  Bookmarklet     │   │
│  └─────────────────────┘            └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Browser Tab (DOM)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           dom-extractor.min.js executes              │  │
│  │  1. Creates overlay                                   │  │
│  │  2. User drags selection rectangle                    │  │
│  │  3. Collects elements via elementsFromPoint()         │  │
│  │  4. Extracts rich context per element                 │  │
│  │  5. Formats output for LLM consumption                │  │
│  │  6. Copies to clipboard                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Size | Purpose |
|------|------|---------|
| `init.lua` | ~3KB | Hammerspoon entry point, browser detection, hotkey binding |
| `dom-extractor.js` | ~42KB | Full readable source |
| `dom-extractor.min.js` | ~17KB | Minified version loaded by init.lua |
| `bookmarklet.js` | ~17KB | Same code with `javascript:` prefix for Firefox |

## Injection Methods

### Chrome, Safari, Arc, Edge (AppleScript)

Direct JavaScript injection via AppleScript:

```lua
-- Chrome
hs.osascript.applescript('tell application "Google Chrome" to execute front window\'s active tab javascript "..."')

-- Safari
hs.osascript.applescript('tell application "Safari" to do JavaScript "..." in front document')

-- Arc
hs.osascript.applescript('tell application "Arc" to execute front window\'s active tab javascript "..."')

-- Edge
hs.osascript.applescript('tell application "Microsoft Edge" to execute front window\'s active tab javascript "..."')
```

**Requirements:**
- Chrome: View > Developer > Allow JavaScript from Apple Events
- Safari: Develop > Allow JavaScript from Apple Events

### Firefox (System Events Bookmarklet)

Firefox blocks AppleScript JS injection for security. Workaround:

1. User creates bookmarklet named exactly `Dom Extractor`
2. Hammerspoon uses System Events to:
   - Activate Firefox
   - Open Bookmarks menu
   - Search for the bookmarklet by exact name
   - Click it

```lua
local script = [[
    tell application "Firefox" to activate
    delay 0.1
    tell application "System Events"
        tell process "Firefox"
            set searchTerms to {"Dom Extractor", "DOM Extractor", ...}
            set bookmarksMenu to menu 1 of menu bar item "Bookmarks" of menu bar 1
            -- Searches in Bookmarks Menu, Toolbar, and Other Bookmarks
            -- Clicks matching bookmark when found
        end tell
    end tell
]]
```

**Supported bookmark names:** `Dom Extractor`, `DOM Extractor`, `dom-extractor`, `DOMExtractor`, `dom extractor`

## JavaScript Execution Flow

### 1. Toggle Check
```javascript
if (document.getElementById('dom-extractor-overlay')) {
    document.getElementById('dom-extractor-overlay').remove();
    return;
}
```
Press hotkey again to dismiss if active.

### 2. Overlay Creation
Creates a full-viewport transparent div with crosshair cursor:
```javascript
var overlay = document.createElement('div');
overlay.id = 'dom-extractor-overlay';
Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0',
    width: '100vw', height: '100vh',
    cursor: 'crosshair',
    zIndex: '2147483647'
});
```

### 3. Selection Box
User drags to create selection rectangle:
```javascript
function onMouseDown(e) { startX = e.clientX; startY = e.clientY; createBox(); }
function onMouseMove(e) { /* update box dimensions */ }
function onMouseUp(e) { /* collect elements, build output, copy to clipboard */ }
```

### 4. Element Collection
Uses `document.elementsFromPoint()` with 8px grid sampling:
```javascript
function getElementsInRect(rect) {
    var step = 8;
    for (var x = rect.left; x <= rect.right; x += step) {
        for (var y = rect.top; y <= rect.bottom; y += step) {
            var elsAtPoint = document.elementsFromPoint(x, y);
            // Filter by overlap coverage > 20%
        }
    }
    // Sort by area (smallest first = most specific)
}
```

### 5. Context Extraction

For each element, extracts:

| Category | Function | Data Extracted |
|----------|----------|----------------|
| Position | `getPositionInfo()` | viewport coords, page coords, percentages, parent-relative |
| Visual | `getVisualInfo()` | colors, fonts, opacity, cursor, z-index, visibility |
| Design | `getDesignInfo()` | border-radius, shadows, padding, margin, layout (flex/grid), position |
| Semantic | `getSemanticInfo()` | role, aria-*, labels, title, alt, href, data-* |
| State | `getInteractiveState()` | disabled, checked, expanded, focused, required, value |
| Constraints | `getInputConstraints()` | minLength, maxLength, pattern, inputMode |
| Interactivity | `hasInteractivity()` | native elements, focusable, onclick, pointer cursor |
| Scroll | `getScrollContext()` | scrollable parent, scroll position |
| Pseudo | `getPseudoContent()` | ::before, ::after content |
| Form | `getFormContext()` | form id, action, method, field count |
| Table | `getTableContext()` | row, col, headers |
| List | `getListContext()` | position in list, total items |
| Landmark | `getLandmarkContext()` | header, nav, main, footer, etc. |
| Modal | `getModalContext()` | dialog, modal title |
| Siblings | `getSiblingContext()` | adjacent elements |
| Hierarchy | `getParentHierarchy()` | up to 5 parent selectors |
| Action | `getPredictedAction()` | what interaction would do |
| Loading | `getLoadingState()` | loading/error indicators |
| Visibility | `getVisibilityDetails()` | viewport visibility |

### 6. Output Format

Structured text optimized for LLM parsing:
```
+-----------------------------------------------------------------
| DOM EXTRACT
| url: https://example.com/page
| viewport: 1440x900  scroll: 0,0
+-----------------------------------------------------------------
| SELECTION
| region: top-left
| position: 5.0%, 10.0%
| pixels: 72,90 -> 200,150 (128x60)
+-----------------------------------------------------------------
| PRIMARY ELEMENT
| tag: button.submit-btn
| text: "Submit"
| selector: #main > form > button
|--- position
|    viewport: 72,90 (128x60)
|--- visual
|    background: rgb(59, 130, 246)
|    color: rgb(255, 255, 255)
|--- interactive: native-button, focusable, pointer
|--- action: submit-form
+-----------------------------------------------------------------
| NEARBY (3)
| 1. input#email [interactive]
| 2. label "Email"
| 3. form#contact-form [interactive]
+-----------------------------------------------------------------
```

### 7. Clipboard Copy
```javascript
navigator.clipboard.writeText(output)
    .then(function() { showToast('Copied to clipboard!'); })
    .catch(function(err) { showToast('Failed: ' + err.message); });
```

## Selector Generation

### Short Selector (`getShortSelector`)
For display: `tag#id.class1.class2.class3` (max 3 classes)

### Unique Selector (`getUniqueSelector`)
For targeting: walks up DOM tree until ID found or returns last 4 path segments
```javascript
// If has ID: #my-element
// Otherwise: div.container > section.main > button.submit
```

## Privacy & Security

**Excluded from extraction:**
- Passwords (`type="password"` values)
- Query parameters from URLs
- Data attributes containing: `token`, `key`, `secret`, `auth`
- Cookies, localStorage, sessionStorage

**No network access:** All processing is local, output goes to clipboard only.

## Limitations

1. **iframes** - Cannot access cross-origin iframe content
2. **Shadow DOM** - Limited access to closed shadow roots
3. **Dynamic content** - Captures current state only
4. **Firefox folders** - Bookmarklet must be at top level, not in nested folders

## Updating the Minified Version

When modifying `dom-extractor.js`, regenerate the minified version:
```bash
# Using terser (npm install -g terser)
terser dom-extractor.js -c -m -o dom-extractor.min.js

# Update bookmarklet.js
echo "javascript:" > bookmarklet.js
cat dom-extractor.min.js >> bookmarklet.js
```

## Hotkey

Default: `Cmd+Shift+M`

To change, modify `init.lua`:
```lua
hs.hotkey.bind({"cmd", "shift"}, "M", function()
```
