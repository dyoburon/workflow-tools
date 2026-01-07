# Precision Inspector Enhancement Plan

> **Date:** 2026-01-06
> **Status:** Planning
> **Priority:** High

---

## Audit Results

### ✅ What's Working Well

| Area | Status | Notes |
|------|--------|-------|
| Try-catch coverage | ✅ Good | 44 try blocks, 46 catch blocks - all functions wrapped |
| Event listener cleanup | ✅ Good | All 3 listeners properly removed in cleanup() |
| ES5 compliance | ✅ Good | No ES6 patterns detected |
| SVG handling | ✅ Good | Safe helpers for className, href, type |
| Polyfills | ✅ Good | Element.remove, closest, Object.assign, Array methods |
| Network restoration | ✅ Good | Original fetch/XHR restored on cleanup |

### ⚠️ Performance Concerns

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| No mousemove throttling | `handleMouseMove()` L682 | Fires 60+ times/sec, could lag on complex pages | Add 16ms throttle (60fps) |
| Label repositioning on every move | `updateLabel()` L556 | Causes reflow on every hover | Only reposition if element changed |
| No RAF usage | `updateHighlight()` L644 | Direct style manipulation | Batch with requestAnimationFrame |
| Toast creates new element each time | `showToast()` L352 | DOM churn if called rapidly | Reuse single toast element |

### ⚠️ Error Handling Gaps

| Issue | Location | Risk | Fix |
|-------|----------|------|-----|
| XHR loadend listener not removed | L858 | Memory leak on long sessions | Track and remove on cleanup |
| No timeout on network entries | `setupNetworkInterception()` | Stale "pending" entries forever | Add 30s timeout |
| Promise rejection unhandled | `copyToClipboard()` L1477 | Silent failure possible | Add .catch() handler |

### ❌ UX Issues (User Feedback)

| Issue | Current State | Desired State |
|-------|---------------|---------------|
| Toast is lackluster | Plain text, static, centered | Animated, icon, slides in from corner |
| Buttons don't show destination | Shows "click" or "submit-form" | Shows actual URL/endpoint |
| Links show "navigate" not WHERE | `→ navigate` | `→ /checkout` or `→ external: stripe.com` |
| No visual feedback on capture | Just toast | Brief flash/pulse on captured element |
| Label missing key info | selector, dims, action | + destination URL, form action |

---

## Enhancement Plan

### Phase 1: Performance Fixes

#### 1.1 Throttle mousemove (16ms = 60fps)
```javascript
var lastMoveTime = 0;
function handleMouseMove(e) {
    var now = Date.now();
    if (now - lastMoveTime < 16) return; // 60fps throttle
    lastMoveTime = now;
    // ... rest of handler
}
```

#### 1.2 Only update if element changed
```javascript
function handleMouseMove(e) {
    // ... get element ...
    if (el === state.hoveredElement) return; // Skip if same element
    state.hoveredElement = el;
    updateHighlight(el);
}
```

#### 1.3 Use requestAnimationFrame for visual updates
```javascript
var rafPending = false;
function scheduleHighlightUpdate(el) {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function() {
        rafPending = false;
        updateHighlight(el);
    });
}
```

### Phase 2: Enhanced Destination Detection

#### 2.1 New function: `getDestination(el)`
Extract where an element leads:

```javascript
function getDestination(el) {
    try {
        var dest = { type: null, url: null, display: null };
        var tag = el.tagName.toLowerCase();
        
        // 1. Direct href (links)
        var href = getSafeHref(el);
        if (href) {
            dest.type = 'href';
            dest.url = href;
            dest.display = formatDestinationDisplay(href);
            return dest;
        }
        
        // 2. Form action (buttons in forms)
        var form = el.closest('form');
        if (form && form.action) {
            dest.type = 'form-action';
            dest.url = form.action;
            dest.display = formatDestinationDisplay(form.action) + ' [' + (form.method || 'GET').toUpperCase() + ']';
            return dest;
        }
        
        // 3. Button formaction attribute
        var formaction = el.getAttribute('formaction');
        if (formaction) {
            dest.type = 'formaction';
            dest.url = formaction;
            dest.display = formatDestinationDisplay(formaction);
            return dest;
        }
        
        // 4. Data attributes (common patterns)
        var dataAttrs = ['data-href', 'data-url', 'data-link', 'data-target', 'data-action'];
        for (var i = 0; i < dataAttrs.length; i++) {
            var val = el.getAttribute(dataAttrs[i]);
            if (val && (val.indexOf('/') !== -1 || val.indexOf('http') === 0)) {
                dest.type = dataAttrs[i];
                dest.url = val;
                dest.display = formatDestinationDisplay(val);
                return dest;
            }
        }
        
        // 5. Parse onclick for URLs (basic)
        var onclick = el.getAttribute('onclick') || '';
        var urlMatch = onclick.match(/['"]((https?:\/\/|\/)[^'"]+)['"]/);
        if (urlMatch) {
            dest.type = 'onclick';
            dest.url = urlMatch[1];
            dest.display = formatDestinationDisplay(urlMatch[1]);
            return dest;
        }
        
        // 6. Check for router links (React Router, Vue Router, Next.js)
        var routerAttrs = ['to', 'href']; // React Router Link uses 'to'
        for (var j = 0; j < routerAttrs.length; j++) {
            var routerVal = el.getAttribute(routerAttrs[j]);
            if (routerVal && routerVal.indexOf('/') === 0) {
                dest.type = 'router-link';
                dest.url = routerVal;
                dest.display = routerVal;
                return dest;
            }
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

function formatDestinationDisplay(url) {
    try {
        // External URL
        if (url.indexOf('http') === 0) {
            var u = new URL(url);
            if (u.hostname !== window.location.hostname) {
                return '↗ ' + u.hostname + u.pathname;
            }
            return u.pathname + (u.search ? '?...' : '');
        }
        // Relative URL
        if (url.indexOf('/') === 0) {
            return url.length > 30 ? url.substring(0, 27) + '...' : url;
        }
        // Anchor
        if (url.indexOf('#') === 0) {
            return '⚓ ' + url;
        }
        // mailto/tel
        if (url.indexOf('mailto:') === 0) {
            return '✉ ' + url.substring(7);
        }
        if (url.indexOf('tel:') === 0) {
            return '📞 ' + url.substring(4);
        }
        return url;
    } catch (e) {
        return url;
    }
}
```

#### 2.2 Update label to show destination
```javascript
function updateLabel(el, rect) {
    // ... existing code ...
    
    var dest = getDestination(el);
    if (dest && dest.display) {
        content += '\n→ ' + dest.display;
    }
    
    // ... rest of function ...
}
```

#### 2.3 Update status bar to show destination
```javascript
function updateStatusBar(el) {
    // ... existing code ...
    
    var dest = getDestination(el);
    if (dest && dest.display) {
        info += ' → ' + dest.display;
    } else if (action) {
        info += ' → ' + action;
    }
    
    // ... rest of function ...
}
```

### Phase 3: Enhanced Toast

#### 3.1 New toast design with animation
```javascript
function showToast(msg, type, duration) {
    try {
        duration = duration || 2000;
        type = type || 'success'; // 'success', 'error', 'info'
        
        // Remove existing toast
        var existing = document.getElementById('precision-inspector-toast');
        if (existing) existing.remove();
        
        var toast = document.createElement('div');
        toast.id = 'precision-inspector-toast';
        
        // Icon based on type
        var icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ'
        };
        var colors = {
            success: { bg: 'rgba(34, 197, 94, 0.95)', border: 'rgba(34, 197, 94, 0.3)' },
            error: { bg: 'rgba(239, 68, 68, 0.95)', border: 'rgba(239, 68, 68, 0.3)' },
            info: { bg: 'rgba(59, 130, 246, 0.95)', border: 'rgba(59, 130, 246, 0.3)' }
        };
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: colors[type].bg,
            color: '#ffffff',
            padding: '12px 20px 12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: '500',
            zIndex: String(Z_INDEX.statusBar + 1),
            boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ' + colors[type].border,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transform: 'translateX(120%)',
            transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
        });
        
        // Icon
        var icon = document.createElement('span');
        Object.assign(icon.style, {
            fontSize: '18px',
            lineHeight: '1'
        });
        icon.textContent = icons[type];
        toast.appendChild(icon);
        
        // Message
        var text = document.createElement('span');
        text.textContent = msg;
        toast.appendChild(text);
        
        document.body.appendChild(toast);
        
        // Slide in
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                toast.style.transform = 'translateX(0)';
            });
        });
        
        // Slide out and remove
        setTimeout(function() {
            toast.style.transform = 'translateX(120%)';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 200);
        }, duration);
    } catch (e) {
        // Silently fail
    }
}
```

### Phase 4: Capture Flash Effect

#### 4.1 Brief highlight pulse on capture
```javascript
function flashElement(el) {
    try {
        if (!state.highlight) return;
        
        // Store original styles
        var origBorder = state.highlight.style.border;
        var origBg = state.highlight.style.background;
        
        // Flash to white/bright
        state.highlight.style.border = '3px solid #22c55e';
        state.highlight.style.background = 'rgba(34, 197, 94, 0.2)';
        state.highlight.style.transition = 'none';
        
        // Restore after brief flash
        setTimeout(function() {
            if (state.highlight) {
                state.highlight.style.transition = 'all 150ms ease-out';
                state.highlight.style.border = origBorder;
                state.highlight.style.background = origBg;
            }
        }, 150);
    } catch (e) {
        // Silently fail
    }
}
```

#### 4.2 Update captureElement to use flash
```javascript
function captureElement(el) {
    try {
        // Flash the element
        flashElement(el);
        
        var output = formatOutput(el);
        
        copyToClipboard(output).then(function(success) {
            if (success) {
                showToast('Copied to clipboard', 'success', 1500);
            } else {
                showToast('Copy failed - check console', 'error', 2000);
                console.log('Precision Inspector Output:\n' + output);
            }
            
            // Cleanup after flash completes
            setTimeout(function() {
                cleanup();
            }, 200);
        });
    } catch (e) {
        showToast('Capture failed', 'error', 1500);
        cleanup();
    }
}
```

### Phase 5: Enhanced Output Format

#### 5.1 Add DESTINATION section to output
```javascript
// In formatOutput(), after PREDICTED ACTION:

// Destination
var dest = getDestination(el);
if (dest) {
    lines.push('| DESTINATION');
    lines.push('|--- type: ' + dest.type);
    lines.push('|--- url: ' + sanitizeUrl(dest.url));
    if (dest.type === 'form-action') {
        var form = el.closest('form');
        if (form) {
            lines.push('|--- method: ' + (form.method || 'GET').toUpperCase());
            if (form.enctype) lines.push('|--- enctype: ' + form.enctype);
        }
    }
    lines.push('+-----------------------------------------------------------------');
}
```

#### 5.2 Enhance NETWORK CONTEXT with element correlation
```javascript
// Add initiator tracking to network entries
var entry = {
    type: 'fetch',
    method: method,
    url: sanitizeUrl(url),
    timestamp: Date.now(),
    status: null,
    duration: null,
    initiator: state.hoveredElement ? getShortSelector(state.hoveredElement) : null
};
```

---

## Implementation Order

1. **Phase 1: Performance** - Throttling, RAF, element change detection
2. **Phase 2: Destinations** - `getDestination()`, label/status updates
3. **Phase 3: Toast** - New animated toast design
4. **Phase 4: Flash** - Capture feedback
5. **Phase 5: Output** - DESTINATION section, network correlation

---

## Testing Checklist

After implementation:

- [ ] Hover performance on complex pages (React, Vue, Next.js)
- [ ] Links show destination URL in label
- [ ] Buttons show form action or data-href
- [ ] Toast slides in from bottom-right
- [ ] Green flash on capture
- [ ] Output includes DESTINATION section
- [ ] Network requests show initiator element
- [ ] No memory leaks (check DevTools)
- [ ] Works in Chrome, Safari, Firefox, Edge
- [ ] ES5 compliance (no arrow functions, let/const, etc.)

---

## Files to Modify

| File | Changes |
|------|---------|
| `precision-inspector.js` | All enhancements |
| `precision-inspector.min.js` | Re-minify after changes |
| `bookmarklet-precision.js` | Re-generate after changes |
