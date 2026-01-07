# Precision Inspector Specification

> **Status:** Planning  
> **Version:** 1.0.0-draft  
> **Last Updated:** 2025-01-06  
> **Hotkey:** `Cmd+Shift+K` (macOS)

---

## Table of Contents

1. [Overview](#overview)
2. [User Experience](#user-experience)
3. [Visual Design](#visual-design)
4. [Technical Architecture](#technical-architecture)
5. [Feature Specifications](#feature-specifications)
6. [Extraction Functions](#extraction-functions)
7. [Network Interception](#network-interception)
8. [Security & Privacy](#security--privacy)
9. [Browser Compatibility](#browser-compatibility)
10. [Error Handling](#error-handling)
11. [Output Format](#output-format)
12. [File Structure](#file-structure)
13. [Implementation Phases](#implementation-phases)
14. [Testing Plan](#testing-plan)
15. [Future Enhancements](#future-enhancements)

---

## Overview

### What Is It?

Precision Inspector is a hover-based element selector that provides micro-precise element selection with real-time visual feedback. Unlike the drag-based DOM Extractor (`Cmd+Shift+M`), this tool allows users to hover over individual elements and see detailed information in real-time before capturing.

### Inspiration

- **Bolt.new** - Element selector with hover highlighting
- **Figma AI** - Precise element selection for AI context
- **Browser DevTools** - Element inspector with visual feedback

### Comparison

| Feature | Drag Mode (`Cmd+Shift+M`) | Precision Mode (`Cmd+Shift+K`) |
|---------|---------------------------|--------------------------------|
| Selection method | Drag rectangle | Hover + click |
| Granularity | Area (multiple elements) | Single element (micro-precise) |
| Visual feedback | Selection box only | Highlight + label + status bar |
| Real-time info | None | Live element details |
| Network context | None | Captured requests since activation |
| CSS variables | None | Full inheritance chain |
| Event listeners | None | Detected and listed |
| Use case | Capture page regions | Inspect specific elements |

---

## User Experience

### Activation Flow

```
1. User presses Cmd+Shift+K
2. Overlay appears with crosshair cursor
3. Status bar appears at top: "● PRECISION MODE - Hover to inspect • Click to capture • Esc to exit"
4. User moves mouse - elements highlight in real-time
5. Element label follows highlighted element showing tag, dimensions, predicted action
6. User clicks on desired element
7. Full extraction runs, copies to clipboard
8. Toast confirms: "✓ Copied to clipboard!"
9. Inspector closes automatically
```

### Exit Methods

| Method | Action |
|--------|--------|
| Click | Captures element and exits |
| Escape | Exits without capturing |
| `Cmd+Shift+K` again | Toggles off (exits) |

### Visual Feedback States

```
┌─────────────────────────────────────────────────────────────────┐
│ STATE: Idle (just activated)                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● PRECISION MODE          Hover to inspect • Esc to exit │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [No highlight - waiting for hover]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STATE: Hovering over element                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● button#submit • 138×48 → submit    Click • Esc to exit │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│       ╔═══════════════════════════════════════╗                 │
│       ║                                       ║ ◄── Blue border │
│       ║          Place Order                  ║     + light bg  │
│       ║                                       ║                 │
│       ╚═══════════════════════════════════════╝                 │
│                        │                                        │
│       ┌────────────────▼────────────────────┐                   │
│       │ button#submit-order.btn.btn-primary │ ◄── Floating     │
│       │ 138×48 → submit-form                │     label        │
│       │ "Place Order"                       │                   │
│       └─────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STATE: Captured (brief flash before close)                      │
│                                                                 │
│              ┌─────────────────────────┐                        │
│              │  ✓ Copied to clipboard! │                        │
│              └─────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Visual Design

### Color Palette

| Element | Color | Hex | Purpose |
|---------|-------|-----|---------|
| Highlight border | Blue | `#0066ff` | Primary selection indicator |
| Highlight background | Blue (8% opacity) | `rgba(0,102,255,0.08)` | Subtle fill |
| Status bar background | Dark (92% opacity) | `rgba(26,26,46,0.92)` | Readable but transparent |
| Status bar text | White | `#ffffff` | Primary text |
| Status bar muted | Gray | `#888888` | Secondary text |
| Label background | Dark solid | `#1a1a2e` | Readable tooltip |
| Action indicator | Green | `#4ade80` | Predicted action |
| Active indicator | Blue | `#0066ff` | Mode active dot |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Status bar | System UI | 13px | 400 (600 for emphasis) |
| Element label | Monospace | 12px | 400 |
| Toast | System UI | 14px | 400 |

### Z-Index Hierarchy

| Element | Z-Index | Purpose |
|---------|---------|---------|
| Status bar | 2147483647 | Always on top |
| Label | 2147483647 | Always on top |
| Overlay | 2147483646 | Captures mouse events |
| Highlight | 2147483645 | Below overlay for pointer-events |

### Animations

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Highlight position | all | 50ms | ease-out |
| Toast fade in | opacity | 150ms | ease-out |
| Toast fade out | opacity | 150ms | ease-in |

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     precision-inspector.js                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   State     │  │  Polyfills  │  │    Safe Helpers         │ │
│  │  Manager    │  │  (ES5)      │  │  (SVGAnimatedString)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    UI Components                            ││
│  │  ┌──────────┐ ┌───────────┐ ┌─────────┐ ┌────────────────┐ ││
│  │  │ Overlay  │ │ Highlight │ │  Label  │ │   Status Bar   │ ││
│  │  └──────────┘ └───────────┘ └─────────┘ └────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Event Handlers                            ││
│  │  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐ ││
│  │  │ mousemove  │ │   click   │ │  keydown  │ │  cleanup   │ ││
│  │  └────────────┘ └───────────┘ └───────────┘ └────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Network Interception                       ││
│  │  ┌─────────────────┐  ┌─────────────────┐                  ││
│  │  │  fetch wrapper  │  │   XHR wrapper   │                  ││
│  │  └─────────────────┘  └─────────────────┘                  ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 Extraction Functions                        ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ││
│  │  │  Visual    │ │  Semantic  │ │   Form     │ │  Network │ ││
│  │  ├────────────┤ ├────────────┤ ├────────────┤ ├──────────┤ ││
│  │  │  Design    │ │   State    │ │   Table    │ │   CSS    │ ││
│  │  ├────────────┤ ├────────────┤ ├────────────┤ ├──────────┤ ││
│  │  │  Position  │ │ Constraints│ │   List     │ │  Events  │ ││
│  │  ├────────────┤ ├────────────┤ ├────────────┤ ├──────────┤ ││
│  │  │  BoxModel  │ │  Agentic   │ │  Landmark  │ │  A11y    │ ││
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Output Formatter                          ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │              Clipboard Copy                          │   ││
│  │  │  (navigator.clipboard → execCommand fallback)        │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### State Management

```javascript
var state = {
    // Core state
    active: false,
    hoveredElement: null,
    startTime: null,
    
    // Network tracking
    networkLog: [],
    
    // UI references
    overlay: null,
    highlight: null,
    label: null,
    status: null,
    
    // Original functions (for restoration)
    originalFetch: null,
    originalXHROpen: null,
    originalXHRSend: null
};
```

---

## Feature Specifications

### 1. Real-Time Hover Highlighting

**Behavior:**
- Mouse movement triggers `elementFromPoint()` lookup
- Overlay temporarily disabled for accurate detection
- Highlight box animates to element position (50ms ease-out)
- Label updates with element info
- Status bar updates with current element

**Edge Cases:**
| Case | Handling |
|------|----------|
| Hover over `<body>` or `<html>` | Hide highlight, show "Move to element" |
| Hover over inspector UI | Ignore, keep previous selection |
| Element removed during hover | Gracefully hide highlight |
| Rapid mouse movement | Throttle updates to 60fps |
| Zero-dimension elements | Show label only, no highlight box |

### 2. Element Label

**Content:**
```
┌─────────────────────────────────────────┐
│ button#submit-order.btn.btn-primary     │  ◄── Short selector
│ 138×48 → submit-form                    │  ◄── Dimensions + action
│ "Place Order"                           │  ◄── Text content (truncated)
└─────────────────────────────────────────┘
```

**Positioning Logic:**
```
1. Default: Below element, 8px gap
2. If below would overflow viewport: Above element
3. If left would overflow: Align to right edge - 10px
4. If right would overflow: Align to left edge + 10px
5. Minimum margin from edges: 10px
```

### 3. Status Bar

**States:**

| State | Content |
|-------|---------|
| Idle | `● PRECISION MODE` `Hover to inspect • Click to capture • Esc to exit` |
| Hovering | `● button#submit` `138×48` `→ submit` `Click to capture • Esc to exit` |
| Capturing | `● Capturing...` |

**Styling:**
- Fixed to top center
- Semi-transparent background with backdrop blur
- Subtle border for definition
- Responsive width (auto)

### 4. Click to Capture

**Flow:**
```
1. User clicks
2. Prevent default + stop propagation
3. Run full extraction on hovered element
4. Format output
5. Copy to clipboard (with fallback)
6. Show success toast
7. Cleanup and exit
```

### 5. Network Context Capture

**What's Captured:**
- All `fetch()` requests since inspector opened
- All `XMLHttpRequest` requests since inspector opened
- Request method, sanitized URL, status, duration

**What's NOT Captured:**
- Request/response bodies
- Headers (may contain auth)
- Cookies
- Full URLs with query params containing sensitive data

---

## Extraction Functions

### Core Extractions (from dom-extractor.js)

| # | Function | Section | Description |
|---|----------|---------|-------------|
| 1 | `getPositionInfo()` | position | Viewport coords, page coords, percentages |
| 2 | `getVisualInfo()` | visual | Colors, fonts, opacity, cursor |
| 3 | `getDesignInfo()` | design | Border-radius, shadows, layout |
| 4 | `getSemanticInfo()` | semantic | Role, ARIA, labels, href |
| 5 | `getInteractiveState()` | state | Disabled, checked, focused |
| 6 | `getInputConstraints()` | constraints | Min/max, pattern, inputMode |
| 7 | `hasInteractivity()` | interactive | Clickable, focusable, draggable |
| 8 | `getScrollContext()` | scroll | Scroll parent, position |
| 9 | `getPseudoContent()` | pseudo | ::before, ::after content |
| 10 | `getFormContext()` | form | Form ID, action, method |
| 11 | `getTableContext()` | table | Row, col, headers |
| 12 | `getListContext()` | list | Position, total items |
| 13 | `getLandmarkContext()` | landmark | Header, nav, main, footer |
| 14 | `getModalContext()` | modal | Dialog, modal title |
| 15 | `getSiblingContext()` | siblings | Prev/next siblings |
| 16 | `getParentHierarchy()` | hierarchy | Parent chain |
| 17 | `getPredictedAction()` | action | What clicking does |
| 18 | `getLoadingState()` | status | Loading indicators |
| 19 | `getVisibilityDetails()` | viewport | Visibility state |

### Agentic Extractions (from dom-extractor.js)

| # | Function | Section | Description |
|---|----------|---------|-------------|
| 20 | `getExpectedOutcomes()` | behavior | What happens on activation |
| 21 | `getInteractionHints()` | input-method | How to interact |
| 22 | `getElementRelationships()` | dependencies | Connected elements |
| 23 | `getValidationExpectations()` | constraints | Validation rules |
| 24 | `getWorkflowContext()` | step-context | Multi-step position |
| 25 | `getDataBinding()` | data-binding | Framework bindings |
| 26 | `getTimingContext()` | timing | Transitions, debounce |
| 27 | `getErrorState()` | error-state | Validation errors |
| 28 | `getPermissionRequirements()` | permissions | Browser permissions |
| 29 | `getAsyncBehavior()` | async | Loading, pagination |
| 30 | `getKeyboardShortcuts()` | shortcuts | Hotkeys, access keys |
| 31 | `getContentType()` | content | Media type, format |

### NEW: Precision-Only Extractions

| # | Function | Section | Description |
|---|----------|---------|-------------|
| 32 | `getNetworkContext()` | network | Requests since activation |
| 33 | `getCSSVariables()` | css-variables | Custom properties chain |
| 34 | `getEventListeners()` | events | Attached event handlers |
| 35 | `getBoxModel()` | box-model | Content, padding, border, margin |
| 36 | `getComputedAccessibility()` | accessibility | Computed a11y properties |
| 37 | `getDOMPath()` | dom-path | Full path from root |

---

## Network Interception

### Implementation

```javascript
// ========================================
// NETWORK INTERCEPTION
// ========================================

// Store originals for restoration
var originalFetch = window.fetch;
var originalXHROpen = XMLHttpRequest.prototype.open;
var originalXHRSend = XMLHttpRequest.prototype.send;

// Sensitive parameter patterns
var sensitiveParams = [
    'token', 'key', 'secret', 'auth', 'password', 
    'api_key', 'apikey', 'access_token', 'refresh_token',
    'session', 'sid', 'jwt', 'bearer', 'credential'
];

// URL sanitization
function sanitizeUrl(url) {
    try {
        var u = new URL(url, window.location.origin);
        
        // Remove sensitive query params
        for (var i = 0; i < sensitiveParams.length; i++) {
            u.searchParams.delete(sensitiveParams[i]);
        }
        
        // Check remaining params for sensitive patterns
        var params = [];
        u.searchParams.forEach(function(value, key) {
            var keyLower = key.toLowerCase();
            var isSensitive = false;
            for (var j = 0; j < sensitiveParams.length; j++) {
                if (keyLower.indexOf(sensitiveParams[j]) !== -1) {
                    isSensitive = true;
                    break;
                }
            }
            if (!isSensitive) {
                params.push(key + '=' + (value.length > 20 ? '[value]' : value));
            }
        });
        
        return u.pathname + (params.length ? '?' + params.join('&') : '');
    } catch (e) {
        return '[url]';
    }
}

// Fetch wrapper
window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
    
    var entry = {
        type: 'fetch',
        method: method,
        url: sanitizeUrl(url),
        timestamp: Date.now(),
        status: null,
        duration: null
    };
    
    state.networkLog.push(entry);
    
    return originalFetch.apply(this, arguments)
        .then(function(response) {
            entry.status = response.status;
            entry.duration = Date.now() - entry.timestamp;
            return response;
        })
        .catch(function(error) {
            entry.status = 'error';
            entry.error = error.message || 'Network error';
            entry.duration = Date.now() - entry.timestamp;
            throw error;
        });
};

// XHR wrapper
XMLHttpRequest.prototype.open = function(method, url) {
    this._precisionInspectorEntry = {
        type: 'xhr',
        method: method.toUpperCase(),
        url: sanitizeUrl(url),
        timestamp: Date.now(),
        status: null,
        duration: null
    };
    state.networkLog.push(this._precisionInspectorEntry);
    return originalXHROpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function() {
    var entry = this._precisionInspectorEntry;
    var xhr = this;
    
    if (entry) {
        this.addEventListener('loadend', function() {
            entry.status = xhr.status || 'error';
            entry.duration = Date.now() - entry.timestamp;
        });
    }
    
    return originalXHRSend.apply(this, arguments);
};

// Cleanup - restore originals
function restoreNetworkInterception() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
}
```

### Network Log Entry Schema

```javascript
{
    type: 'fetch' | 'xhr',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | ...,
    url: '/api/endpoint?param=value',  // Sanitized
    timestamp: 1704567890123,          // ms since epoch
    status: 200 | 404 | 500 | 'error', // HTTP status or 'error'
    duration: 145,                      // ms
    error: 'Network error'              // Only if status === 'error'
}
```

---

## Security & Privacy

### Data Handling Principles

| Principle | Implementation |
|-----------|----------------|
| **Local only** | No data sent to any server |
| **No body capture** | Request/response bodies never read |
| **No header capture** | Headers may contain auth tokens |
| **URL sanitization** | Sensitive params stripped |
| **No storage** | Data only in memory, cleared on exit |
| **Clipboard only** | Output goes to clipboard, nowhere else |

### Sensitive Data Patterns

```javascript
// Never captured or included in output
var sensitivePatterns = {
    // URL parameters
    urlParams: [
        'token', 'key', 'secret', 'auth', 'password',
        'api_key', 'apikey', 'access_token', 'refresh_token',
        'session', 'sid', 'jwt', 'bearer', 'credential',
        'private', 'apiSecret', 'client_secret'
    ],
    
    // Data attributes
    dataAttrs: [
        'data-token', 'data-key', 'data-secret', 'data-auth',
        'data-api-key', 'data-session', 'data-jwt'
    ],
    
    // Input types
    inputTypes: [
        'password'
    ],
    
    // Input names/IDs
    inputNames: [
        'password', 'passwd', 'pwd', 'secret', 'token',
        'api_key', 'apikey', 'credit_card', 'cc_number',
        'cvv', 'cvc', 'ssn', 'social_security'
    ]
};
```

### Password Field Handling

```javascript
function getInputValue(el) {
    try {
        // Never return password values
        if (el.type && el.type.toLowerCase() === 'password') {
            return '[password]';
        }
        
        // Check name/id for sensitive patterns
        var name = (el.name || el.id || '').toLowerCase();
        for (var i = 0; i < sensitivePatterns.inputNames.length; i++) {
            if (name.indexOf(sensitivePatterns.inputNames[i]) !== -1) {
                return '[sensitive]';
            }
        }
        
        return el.value || '';
    } catch (e) {
        return '';
    }
}
```

---

## Browser Compatibility

### ES5 Compliance Checklist

| Feature | ES6+ | ES5 Replacement |
|---------|------|-----------------|
| Arrow functions | `() => {}` | `function() {}` |
| `let`/`const` | `let x = 1` | `var x = 1` |
| Template literals | `` `${x}` `` | `'' + x + ''` |
| `.includes()` | `arr.includes(x)` | `arr.indexOf(x) !== -1` |
| `.startsWith()` | `str.startsWith(x)` | `str.indexOf(x) === 0` |
| `.endsWith()` | `str.endsWith(x)` | `str.indexOf(x) === str.length - x.length` |
| `Set` | `new Set()` | Custom `SimpleSet` class |
| `Map` | `new Map()` | Plain object `{}` |
| `for...of` | `for (x of arr)` | `for (var i = 0; i < arr.length; i++)` |
| `Object.entries()` | `Object.entries(obj)` | Manual iteration |
| `Object.values()` | `Object.values(obj)` | Manual iteration |
| `Object.assign()` | `Object.assign()` | Polyfill included |
| Spread operator | `[...arr]` | `arr.slice()` |
| Default params | `fn(x = 1)` | `x = x || 1` |
| Destructuring | `{a, b} = obj` | `var a = obj.a, b = obj.b` |
| Promises | `Promise` | Assume available (IE11 needs polyfill) |

### Polyfills Included

```javascript
// Element.prototype.remove
if (!Element.prototype.remove) {
    Element.prototype.remove = function() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    };
}

// Element.prototype.closest
if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
        var el = this;
        do {
            try {
                if (el.matches ? el.matches(s) : el.msMatchesSelector(s)) return el;
            } catch (e) { return null; }
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}

// Object.assign
if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
        if (target === null || target === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        var to = Object(target);
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (source !== null && source !== undefined) {
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        to[key] = source[key];
                    }
                }
            }
        }
        return to;
    };
}

// Array.prototype.forEach (IE8)
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
        for (var i = 0; i < this.length; i++) {
            callback.call(thisArg, this[i], i, this);
        }
    };
}
```

### SVGAnimatedString Handling

```javascript
function getSafeClassName(el) {
    try {
        var raw = el.className;
        if (!raw) return '';
        if (typeof raw === 'string') return raw;
        if (raw.baseVal !== undefined) return raw.baseVal;
        return '';
    } catch (e) { return ''; }
}

function getSafeHref(el) {
    try {
        var raw = el.href;
        if (!raw) return '';
        if (typeof raw === 'string') return raw;
        if (raw.baseVal !== undefined) return raw.baseVal;
        return '';
    } catch (e) { return ''; }
}

function getSafeType(el) {
    try {
        var raw = el.type;
        if (!raw) return '';
        if (typeof raw === 'string') return raw.toLowerCase();
        if (raw.baseVal !== undefined) return raw.baseVal.toLowerCase();
        return '';
    } catch (e) { return ''; }
}
```

### Browser-Specific Considerations

| Browser | Consideration | Handling |
|---------|---------------|----------|
| Safari | SVGAnimatedString | Safe helper functions |
| Safari | No `backdrop-filter` (old) | Graceful degradation |
| Firefox | `elementsFromPoint` returns different order | Sort by z-index |
| IE11 | No `classList` on SVG | Use `getAttribute('class')` |
| IE11 | No `dataset` | Use `getAttribute('data-*')` |
| IE11 | No `Promise` | Assume polyfilled or skip async features |
| Edge Legacy | Similar to IE11 | Same handling |

---

## Error Handling

### Try-Catch Strategy

Every function that accesses DOM or external APIs is wrapped:

```javascript
function extractSomething(el) {
    try {
        // Extraction logic
        return result;
    } catch (e) {
        // Return safe default
        return {};  // or [] or null or ''
    }
}
```

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| DOM access | `el.getBoundingClientRect()` throws | Return empty/default |
| Style access | `getComputedStyle()` fails | Return empty object |
| Property access | `el.someProperty` is undefined | Check before access |
| Type errors | SVGAnimatedString methods | Use safe helpers |
| Network errors | Fetch fails | Log error status |
| Clipboard errors | `navigator.clipboard` unavailable | Use execCommand fallback |

### Graceful Degradation

```javascript
// Example: Clipboard with fallback
function copyToClipboard(text) {
    // Try modern API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
            .then(function() { return true; })
            .catch(function() { return fallbackCopy(text); });
    }
    // Fallback for older browsers
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    try {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        textarea.select();
        var success = document.execCommand('copy');
        textarea.remove();
        return success;
    } catch (e) {
        return false;
    }
}
```

---

## Output Format

### Full Output Structure

```
+-----------------------------------------------------------------
| PRECISION EXTRACT
| url: https://example.com/checkout
| viewport: 1728×959  scroll: 0,250
| mode: precision-hover
| captured: 2025-01-06T12:34:56.789Z
+-----------------------------------------------------------------
| SELECTED ELEMENT
| tag: button#submit-order.btn.btn-primary
| text: "Place Order"
| selector: #submit-order
+-----------------------------------------------------------------
| DOM PATH
| html > body > main#content > form#checkout > div.actions > button
| depth: 6
+-----------------------------------------------------------------
| BOX MODEL
|--- content: 114×24
|--- padding: 12px 24px 12px 24px
|--- border: 0
|--- margin: 0
|--- total: 138×48
|--- box-sizing: border-box
+-----------------------------------------------------------------
| POSITION
|--- viewport: 651,469 (138×48)
|--- page: 651,719
|--- in-parent: 75.2%, 80.0% of div.actions
+-----------------------------------------------------------------
| VISUAL
|--- background: rgb(37, 99, 235)
|--- color: rgb(255, 255, 255)
|--- font: 600 16px/24px Inter, sans-serif
|--- border-radius: 8px
|--- cursor: pointer
|--- opacity: 1
+-----------------------------------------------------------------
| CSS VARIABLES
|--- --btn-bg: #3b82f6 (from :root)
|--- --btn-text: #ffffff (from :root)
|--- --btn-padding-x: 24px (from .btn)
|--- --btn-padding-y: 12px (from .btn)
|--- --btn-radius: 8px (from :root)
|--- --font-family: Inter, sans-serif (from :root)
+-----------------------------------------------------------------
| SEMANTIC
|--- role: button (implicit)
|--- aria-label: none
|--- aria-describedby: none
+-----------------------------------------------------------------
| STATE
|--- disabled: false
|--- focused: false
|--- hover: false
+-----------------------------------------------------------------
| INTERACTIVE
|--- native-button: true
|--- focusable: true
|--- tabindex: 0
|--- cursor-pointer: true
+-----------------------------------------------------------------
| EVENT LISTENERS
|--- click: bound handleSubmit
|--- mouseenter: bound handleHover
|--- focus: bound handleFocus
|--- blur: bound handleBlur
+-----------------------------------------------------------------
| FORM CONTEXT
|--- form: #checkout-form
|--- action: /api/orders
|--- method: POST
|--- fields: 8
|--- valid: false (2 invalid fields)
|--- submit-button: this element
+-----------------------------------------------------------------
| ACCESSIBILITY
|--- name: "Place Order" (from content)
|--- role: button
|--- focusable: true
|--- keyboard-operable: true
|--- contrast-ratio: 4.8:1 (AA pass, AAA fail)
+-----------------------------------------------------------------
| AUTOMATION CONTEXT
|--- behavior (on activation)
|    outcome: form-submit
|    target: /api/orders
|    method: POST
|    willNavigate: true
|--- input-method
|    clickable: true
|    clickMethod: left-click
|    keyboard: Enter or Space
|--- dependencies
|    form: #checkout-form
|    blockedBy: input#card-expiry (required), input#card-cvv (required)
|--- timing
|    hasTransition: true (transform 200ms ease-out)
+-----------------------------------------------------------------
| NETWORK CONTEXT (5 requests since inspector opened)
|--- 1. GET /api/cart → 200 (45ms)
|--- 2. GET /api/user → 200 (32ms)
|--- 3. POST /api/cart/validate → 200 (120ms)
|--- 4. GET /api/shipping-options → 200 (89ms)
|--- 5. POST /api/analytics/view → 204 (156ms)
+-----------------------------------------------------------------
| SIBLINGS
|--- position: 2 of 2
|--- prev: button.btn-secondary "Back to Cart"
|--- next: none
+-----------------------------------------------------------------
| HIERARCHY
| button < div.actions < form#checkout < main#content < body < html
+-----------------------------------------------------------------
```

---

## File Structure

```
dom-for-llm-extractor/
├── init.lua                         # Hammerspoon bindings (add Cmd+Shift+K)
├── dom-extractor.js                 # Drag mode (existing)
├── dom-extractor.min.js             # Drag mode minified
├── precision-inspector.js           # NEW: Hover mode
├── precision-inspector.min.js       # NEW: Hover mode minified
├── bookmarklet.js                   # Drag mode bookmarklet
├── bookmarklet-precision.js         # NEW: Precision mode bookmarklet
├── shared/                          # NEW: Shared utilities
│   ├── extractors.js                # Shared extraction functions
│   ├── helpers.js                   # Safe helpers, polyfills
│   └── security.js                  # Sanitization functions
├── README.md                        # Updated with precision mode
└── test/
    └── precision-test.html          # Test page for precision mode

docs/dom-for-llm-extractor/
├── howcurrentlyworks.md             # Updated with precision mode
└── precision-inspector-spec.md      # This document
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1)
- [ ] Create `precision-inspector.js` skeleton
- [ ] Implement state management
- [ ] Add polyfills and safe helpers
- [ ] Create UI components (overlay, highlight, label, status)
- [ ] Implement basic hover detection
- [ ] Implement click to capture (basic output)
- [ ] Implement Escape to exit
- [ ] Add toggle functionality

### Phase 2: Visual Polish (Day 1-2)
- [ ] Refine highlight animation (smooth 50ms transitions)
- [ ] Implement smart label positioning
- [ ] Style status bar with backdrop blur
- [ ] Add toast notifications
- [ ] Handle edge cases (zero-size elements, off-screen)

### Phase 3: Network Interception (Day 2)
- [ ] Implement fetch wrapper
- [ ] Implement XHR wrapper
- [ ] Add URL sanitization
- [ ] Store network log in state
- [ ] Add cleanup/restoration

### Phase 4: Extraction Functions (Day 2-3)
- [ ] Port all 31 extractors from dom-extractor.js
- [ ] Add new extractors:
  - [ ] `getNetworkContext()`
  - [ ] `getCSSVariables()`
  - [ ] `getEventListeners()`
  - [ ] `getBoxModel()`
  - [ ] `getComputedAccessibility()`
  - [ ] `getDOMPath()`
- [ ] Wrap all in try-catch

### Phase 5: Output Formatting (Day 3)
- [ ] Design output format
- [ ] Implement formatter
- [ ] Add clipboard copy with fallback
- [ ] Test output in various scenarios

### Phase 6: Integration (Day 3-4)
- [ ] Update `init.lua` with `Cmd+Shift+K` binding
- [ ] Create minified version
- [ ] Create bookmarklet version
- [ ] Update README
- [ ] Update howcurrentlyworks.md

### Phase 7: Testing (Day 4)
- [ ] Test in Chrome
- [ ] Test in Safari (SVG elements!)
- [ ] Test in Firefox
- [ ] Test in Edge
- [ ] Test on React sites
- [ ] Test on Vue sites
- [ ] Test on Next.js sites
- [ ] Test network interception
- [ ] Test error handling

### Phase 8: Documentation & PR (Day 4)
- [ ] Finalize this spec document
- [ ] Create PR with detailed description
- [ ] Add examples to README

---

## Testing Plan

### Manual Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Activate with Cmd+Shift+K | Overlay appears, status bar shows |
| 2 | Move mouse over elements | Highlight follows, label updates |
| 3 | Hover over SVG element | No crash, correct info shown |
| 4 | Hover over React component | No crash, element info shown |
| 5 | Click on element | Extraction runs, clipboard updated, exit |
| 6 | Press Escape | Exit without capture |
| 7 | Press Cmd+Shift+K again | Toggle off |
| 8 | Hover over body/html | Highlight hidden, status shows hint |
| 9 | Hover over inspector UI | Ignored, previous selection kept |
| 10 | Rapid mouse movement | Smooth updates, no lag |
| 11 | Click on password field | Value shows as [password] |
| 12 | Network requests during session | Captured in output |
| 13 | Fetch with sensitive params | Params sanitized in output |
| 14 | Element removed during hover | Graceful handling |
| 15 | Very small element (1x1) | Label shown, highlight minimal |
| 16 | Element at edge of viewport | Label repositioned |
| 17 | Scrolled page | Correct positions reported |
| 18 | iframe content | Handled gracefully (may not access) |

### Browser Test Matrix

| Browser | Version | macOS | Windows | Linux |
|---------|---------|-------|---------|-------|
| Chrome | Latest | ✓ | ✓ | ✓ |
| Safari | Latest | ✓ | N/A | N/A |
| Firefox | Latest | ✓ | ✓ | ✓ |
| Edge | Latest | ✓ | ✓ | ✓ |
| Safari | 14 | ✓ | N/A | N/A |
| Chrome | 90 | ✓ | ✓ | ✓ |

### Automated Checks

```bash
# Syntax validation
node --check precision-inspector.js

# ES6+ detection
grep -E "=>|`|\blet\b|\bconst\b|\.includes\(|\.startsWith\(" precision-inspector.js

# Try-catch coverage
grep -c "try {" precision-inspector.js  # Should be 30+

# Minification
terser precision-inspector.js -c -m -o precision-inspector.min.js
```

---

## Future Enhancements

### Version 1.1
- [ ] Multi-element selection (Shift+Click to add)
- [ ] Element pinning (Space to lock selection)
- [ ] Keyboard navigation (↑↓←→ to traverse DOM)

### Version 1.2
- [ ] CSS variables deep inspection
- [ ] Computed styles diff (vs parent)
- [ ] Animation timeline capture

### Version 1.3
- [ ] Component detection (React, Vue, Angular)
- [ ] Props/state extraction (where possible)
- [ ] Source map integration

### Version 1.4
- [ ] Accessibility audit mode
- [ ] WCAG violation detection
- [ ] Fix suggestions

### Version 2.0
- [ ] User flow recording
- [ ] Multi-step capture
- [ ] Playwright/Cypress test generation

---

## Appendix

### A. Hotkey Compatibility Research

| Combo | macOS Chrome | macOS Safari | macOS Firefox | Windows Chrome | Windows Firefox |
|-------|--------------|--------------|---------------|----------------|-----------------|
| Cmd+Shift+K | ✅ Free | ✅ Free | ⚠️ Web Console | N/A | N/A |
| Ctrl+Shift+K | ✅ Free | ✅ Free | ⚠️ Web Console | ⚠️ Web Console | ⚠️ Web Console |
| Cmd+Shift+E | ✅ Free | ✅ Free | ✅ Free | N/A | N/A |
| Ctrl+Shift+E | ✅ Free | ✅ Free | ✅ Free | ⚠️ Edge: Sidebar | ✅ Free |

**Recommendation:** Use `Cmd+Shift+K` on macOS. Hammerspoon intercepts before browser, so Firefox conflict is avoided.

### B. Performance Considerations

| Operation | Target | Mitigation |
|-----------|--------|------------|
| mousemove handler | <16ms (60fps) | Throttle if needed |
| elementFromPoint | <1ms | Native, fast |
| getBoundingClientRect | <1ms | Native, fast |
| getComputedStyle | <5ms | Cache if needed |
| Full extraction | <100ms | Async if needed |
| Clipboard write | <50ms | Async with fallback |

### C. Size Budget

| File | Target | Actual |
|------|--------|--------|
| precision-inspector.js | <50KB | TBD |
| precision-inspector.min.js | <20KB | TBD |
| bookmarklet-precision.js | <20KB | TBD |

---

*End of Specification*
