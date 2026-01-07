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
│  │  5. Extracts AUTOMATION CONTEXT for agents            │  │
│  │  6. Formats output for LLM consumption                │  │
│  │  7. Copies to clipboard                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Size | Purpose |
|------|------|---------|
| `init.lua` | ~3KB | Hammerspoon entry point, browser detection, hotkey binding |
| `dom-extractor.js` | ~97KB | Full readable source with all extraction functions |
| `dom-extractor.min.js` | ~35KB | Minified version loaded by init.lua |
| `bookmarklet.js` | ~35KB | Same code with `javascript:` prefix for Firefox |

## Browser Compatibility

### ES5 Compliance (Safari 10 / IE11 Support)

All code uses ES5 syntax only:
- No arrow functions (`=>`)
- No `let`/`const` (uses `var`)
- No template literals
- No `.includes()` (uses `.indexOf() !== -1`)
- No `.startsWith()` (uses `.indexOf() === 0`)
- No `Set` (uses custom `SimpleSet` class)
- No `Object.entries()` / `Object.values()`

### SVGAnimatedString Handling

SVG elements return `SVGAnimatedString` objects instead of strings for `href`, `type`, and `className`. Three helper functions handle this:

```javascript
// Safe href extraction (handles SVG <a> elements)
function getSafeHref(el) {
    var rawHref = el.href;
    if (!rawHref) return '';
    if (typeof rawHref === 'string') return rawHref;
    if (rawHref.baseVal) return rawHref.baseVal;  // SVGAnimatedString
    return '';
}

// Safe type extraction
function getSafeType(el) {
    var rawType = el.type;
    if (!rawType) return '';
    if (typeof rawType === 'string') return rawType.toLowerCase();
    if (rawType.baseVal) return rawType.baseVal.toLowerCase();
    return '';
}

// Safe className extraction
function getSafeClassName(el) {
    var rawClass = el.className;
    if (!rawClass) return '';
    if (typeof rawClass === 'string') return rawClass;
    if (rawClass.baseVal) return rawClass.baseVal;
    return '';
}
```

### Polyfills Included

```javascript
// Element.prototype.remove (IE11)
if (!Element.prototype.remove) {
    Element.prototype.remove = function() {
        if (this.parentNode) this.parentNode.removeChild(this);
    };
}

// Element.prototype.closest (IE11)
if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
        var el = this;
        do {
            if (el.matches ? el.matches(s) : el.msMatchesSelector(s)) return el;
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}

// Object.assign (IE11)
if (typeof Object.assign !== 'function') {
    Object.assign = function(target) { /* polyfill */ };
}

// elementsFromPoint fallback
if (!document.elementsFromPoint) {
    // Falls back to elementFromPoint (single element)
}

// Clipboard fallback
if (!navigator.clipboard) {
    // Falls back to execCommand('copy')
}
```

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
Creates a full-viewport transparent div with crosshair cursor.

### 3. Selection Box
User drags to create selection rectangle.

### 4. Element Collection
Uses `document.elementsFromPoint()` with 8px grid sampling, filters by overlap coverage > 20%, sorts by area (smallest first = most specific).

### 5. Context Extraction

For each element, extracts 32 categories of information (all wrapped in try-catch for resilience):

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

### 6. Automation Context Extraction (Agentic Features)

12 additional extraction functions specifically designed for AI agents:

| Function | Output Section | Purpose |
|----------|----------------|---------|
| `getExpectedOutcomes()` | `behavior` | What happens when element is activated (form submit, navigation, toggle, etc.) |
| `getInteractionHints()` | `input-method` | How to interact (click, keyboard, drag, etc.) |
| `getElementRelationships()` | `dependencies` | Connected elements (form, toggle target, controlled elements) |
| `getValidationExpectations()` | `constraints` | Input requirements (required, pattern, min/max) |
| `getWorkflowContext()` | `step-context` | Multi-step flow position (wizard step 2/4, progress %) |
| `getDataBinding()` | `data-binding` | Framework bindings (Vue v-model, React state, Angular ng-model) |
| `getTimingContext()` | `timing` | Transitions, animations, debounce hints |
| `getErrorState()` | `error-state` | Current validation errors and messages |
| `getPermissionRequirements()` | `permissions` | Browser permissions needed (camera, microphone, location, etc.) |
| `getAsyncBehavior()` | `async` | Loading states, pagination, infinite scroll, polling |
| `getKeyboardShortcuts()` | `shortcuts` | Access keys, hotkeys, implicit shortcuts |
| `getContentType()` | `content` | Media type, format, editability |

### 7. Error Resilience

**All 32 extraction functions are wrapped in try-catch** to prevent crashes on:
- Next.js hydration elements
- React fiber nodes
- Vue reactive proxies
- Shadow DOM elements
- Cross-origin iframes
- Elements removed during extraction
- Malformed DOM structures

```javascript
function getVisualInfo(el) {
    try {
        // extraction logic
    } catch (e) {
        return {};  // Graceful fallback
    }
}
```

### 8. Output Format

Structured text optimized for LLM parsing:

```
+-----------------------------------------------------------------
| DOM EXTRACT
| url: https://example.com/checkout
| viewport: 1440x900  scroll: 0,0
+-----------------------------------------------------------------
| SELECTION
| region: middle-center
| position: 45.2%, 52.1%
| pixels: 651,469 -> 789,517 (138x48)
+-----------------------------------------------------------------
| PRIMARY ELEMENT
| tag: button#submit-order.btn.btn-primary
| text: "Place Order"
| selector: #submit-order
|--- position
|    viewport: 651,469 (138x48)
|--- visual
|    background: rgb(37, 99, 235)
|    color: rgb(255, 255, 255)
|--- interactive: native-button, focusable, pointer
|--- form
|    inForm: true
|    formId: checkout-form
|    formAction: /api/orders
|--- action: submit-form
|
| AUTOMATION CONTEXT
|--- behavior (on activation)
|    outcome: form-submit
|    target: /api/orders
|    method: POST
|    isAjax: true
|--- input-method
|    clickable: true
|    clickMethod: left-click
|    keyboard: Enter or Space
|--- dependencies
|    form: #checkout-form
|--- constraints
|    required: true
|--- timing
|    hasTransition: true
|--- shortcuts
|    implicit: Enter (when form focused)
+-----------------------------------------------------------------
```

**Note:** The NEARBY section has been removed to reduce context waste. The PRIMARY ELEMENT now includes comprehensive automation context instead.

### 9. Clipboard Copy
```javascript
navigator.clipboard.writeText(output)
    .then(function() { showToast('Copied to clipboard!'); })
    .catch(function(err) { 
        // Fallback to execCommand
        var textarea = document.createElement('textarea');
        textarea.value = output;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    });
```

## Selector Generation

### Short Selector (`getShortSelector`)
For display: `tag#id.class1.class2.class3` (max 3 classes)

### Unique Selector (`getUniqueSelector`)
For targeting: walks up DOM tree until ID found or returns last 4 path segments

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
