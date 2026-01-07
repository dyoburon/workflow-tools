(function() {
    'use strict';
    
    try {
    // ========================================
    // POLYFILLS FOR OLDER BROWSERS (ES5)
    // ========================================
    
    // Polyfill for Element.prototype.remove (IE11)
    if (!Element.prototype.remove) {
        Element.prototype.remove = function() {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        };
    }
    
    // Polyfill for Element.prototype.closest (IE11)
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
    
    // Polyfill for Object.assign (IE11)
    if (typeof Object.assign !== 'function') {
        Object.assign = function(target) {
            if (target == null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var nextSource = arguments[i];
                if (nextSource != null) {
                    for (var key in nextSource) {
                        if (Object.prototype.hasOwnProperty.call(nextSource, key)) {
                            to[key] = nextSource[key];
                        }
                    }
                }
            }
            return to;
        };
    }
    
    // Polyfill for Array.prototype.forEach (IE8)
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function(callback, thisArg) {
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }
    
    // Polyfill for Array.prototype.filter (IE8)
    if (!Array.prototype.filter) {
        Array.prototype.filter = function(callback, thisArg) {
            var result = [];
            for (var i = 0; i < this.length; i++) {
                if (callback.call(thisArg, this[i], i, this)) {
                    result.push(this[i]);
                }
            }
            return result;
        };
    }
    
    // Polyfill for Array.prototype.map (IE8)
    if (!Array.prototype.map) {
        Array.prototype.map = function(callback, thisArg) {
            var result = [];
            for (var i = 0; i < this.length; i++) {
                result.push(callback.call(thisArg, this[i], i, this));
            }
            return result;
        };
    }
    
    // ========================================
    // SAFE HELPERS (SVGAnimatedString, etc.)
    // ========================================
    
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
    
    function arrayIndexOf(arr, item) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === item) return i;
        }
        return -1;
    }
    
    // ========================================
    // TOGGLE OFF IF ALREADY ACTIVE
    // ========================================
    
    // Note: Must use inline IDs here since constants not yet defined
    var TOGGLE_IDS = ['precision-inspector-overlay', 'precision-inspector-highlight', 'precision-inspector-label', 'precision-inspector-status', 'precision-inspector-toast'];
    if (document.getElementById('precision-inspector-overlay')) {
        for (var toggleIdx = 0; toggleIdx < TOGGLE_IDS.length; toggleIdx++) {
            var toggleEl = document.getElementById(TOGGLE_IDS[toggleIdx]);
            if (toggleEl && toggleEl.parentNode) {
                toggleEl.parentNode.removeChild(toggleEl);
            }
        }
        return;
    }
    
    // ========================================
    // STATE MANAGEMENT
    // ========================================
    
    var state = {
        // Core state
        active: true,
        hoveredElement: null,
        startTime: Date.now(),
        
        // Performance throttling
        lastMoveTime: 0,
        rafPending: false,
        
        // Network tracking
        networkLog: [],
        
        // UI references
        overlay: null,
        highlight: null,
        label: null,
        statusBar: null,
        toast: null,
        
        // Original functions (for restoration)
        originalFetch: null,
        originalXHROpen: null,
        originalXHRSend: null,
        
        // Event handler references (for cleanup)
        handlers: {
            mousemove: null,
            click: null,
            keydown: null
        }
    };
    
    // ========================================
    // CONSTANTS
    // ========================================
    
    var COLORS = {
        highlightBorder: '#0066ff',
        highlightBg: 'rgba(0,102,255,0.08)',
        statusBarBg: 'rgba(26,26,46,0.92)',
        statusBarText: '#ffffff',
        statusBarMuted: '#888888',
        labelBg: '#1a1a2e',
        labelText: '#ffffff',
        actionGreen: '#4ade80',
        activeDot: '#0066ff'
    };
    
    var Z_INDEX = {
        statusBar: 2147483647,
        label: 2147483647,
        overlay: 2147483646,
        highlight: 2147483645
    };
    
    var TIMING = {
        throttleMs: 16,          // 60fps
        flashDurationMs: 120,
        animationMs: 150,
        toastDurationMs: 1500,
        cleanupDelayMs: 250
    };
    
    var LIMITS = {
        maxNetworkEntries: 100,
        maxOnclickLength: 1000,
        maxDataAttrLength: 500
    };
    
    var UI_ELEMENT_IDS = [
        'precision-inspector-overlay',
        'precision-inspector-highlight',
        'precision-inspector-label',
        'precision-inspector-status',
        'precision-inspector-toast'
    ];
    
    var SENSITIVE_PARAMS = [
        'token', 'key', 'secret', 'auth', 'password',
        'api_key', 'apikey', 'access_token', 'refresh_token',
        'session', 'sid', 'jwt', 'bearer', 'credential',
        'private', 'apiSecret', 'client_secret'
    ];
    
    var SENSITIVE_INPUT_NAMES = [
        'password', 'passwd', 'pwd', 'secret', 'token',
        'api_key', 'apikey', 'credit_card', 'cc_number',
        'cvv', 'cvc', 'ssn', 'social_security'
    ];
    
    // ========================================
    // UI CREATION
    // ========================================
    
    function createOverlay() {
        try {
            var overlay = document.createElement('div');
            overlay.id = 'precision-inspector-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                cursor: 'crosshair',
                zIndex: String(Z_INDEX.overlay),
                background: 'transparent',
                pointerEvents: 'auto'
            });
            document.body.appendChild(overlay);
            state.overlay = overlay;
            return overlay;
        } catch (e) {
            return null;
        }
    }
    
    function createHighlight() {
        try {
            var highlight = document.createElement('div');
            highlight.id = 'precision-inspector-highlight';
            Object.assign(highlight.style, {
                position: 'fixed',
                border: '2px solid ' + COLORS.highlightBorder,
                background: COLORS.highlightBg,
                pointerEvents: 'none',
                zIndex: String(Z_INDEX.highlight),
                display: 'none',
                transition: 'all 50ms ease-out',
                boxSizing: 'border-box'
            });
            document.body.appendChild(highlight);
            state.highlight = highlight;
            return highlight;
        } catch (e) {
            return null;
        }
    }
    
    function createLabel() {
        try {
            var label = document.createElement('div');
            label.id = 'precision-inspector-label';
            Object.assign(label.style, {
                position: 'fixed',
                background: COLORS.labelBg,
                color: COLORS.labelText,
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                lineHeight: '1.4',
                maxWidth: '400px',
                pointerEvents: 'none',
                zIndex: String(Z_INDEX.label),
                display: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            });
            document.body.appendChild(label);
            state.label = label;
            return label;
        } catch (e) {
            return null;
        }
    }
    
    function createStatusBar() {
        try {
            var statusBar = document.createElement('div');
            statusBar.id = 'precision-inspector-status';
            Object.assign(statusBar.style, {
                position: 'fixed',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: COLORS.statusBarBg,
                color: COLORS.statusBarText,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                zIndex: String(Z_INDEX.statusBar),
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            });
            
            // Active dot
            var dot = document.createElement('span');
            Object.assign(dot.style, {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: COLORS.activeDot,
                display: 'inline-block'
            });
            statusBar.appendChild(dot);
            
            // Mode text
            var modeText = document.createElement('span');
            modeText.style.fontWeight = '600';
            modeText.textContent = 'PRECISION MODE';
            statusBar.appendChild(modeText);
            
            // Element info (dynamic)
            var elementInfo = document.createElement('span');
            elementInfo.id = 'precision-inspector-element-info';
            elementInfo.style.color = COLORS.statusBarMuted;
            elementInfo.textContent = 'Hover to inspect';
            statusBar.appendChild(elementInfo);
            
            // Separator
            var sep = document.createElement('span');
            sep.style.color = COLORS.statusBarMuted;
            sep.textContent = '•';
            statusBar.appendChild(sep);
            
            // Instructions
            var instructions = document.createElement('span');
            instructions.style.color = COLORS.statusBarMuted;
            instructions.textContent = 'Click to capture • Esc to exit';
            statusBar.appendChild(instructions);
            
            document.body.appendChild(statusBar);
            state.statusBar = statusBar;
            return statusBar;
        } catch (e) {
            return null;
        }
    }
    
    function showToast(msg, type, duration) {
        try {
            // Handle legacy calls: showToast(msg, duration)
            if (typeof type === 'number') {
                duration = type;
                type = 'success';
            }
            duration = duration || 2000;
            type = type || 'success'; // 'success', 'error', 'info'
            
            // Remove existing toast
            var existing = document.getElementById('precision-inspector-toast');
            if (existing) existing.remove();
            
            var toast = document.createElement('div');
            toast.id = 'precision-inspector-toast';
            
            // Icon based on type
            var icons = {
                success: '\u2713',
                error: '\u2717',
                info: '\u2139'
            };
            var colors = {
                success: { bg: 'rgba(34, 197, 94, 0.95)', border: 'rgba(34, 197, 94, 0.3)' },
                error: { bg: 'rgba(239, 68, 68, 0.95)', border: 'rgba(239, 68, 68, 0.3)' },
                info: { bg: 'rgba(59, 130, 246, 0.95)', border: 'rgba(59, 130, 246, 0.3)' }
            };
            
            var colorSet = colors[type] || colors.success;
            var icon = icons[type] || icons.success;
            
            Object.assign(toast.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                background: colorSet.bg,
                color: '#ffffff',
                padding: '12px 20px 12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: '500',
                zIndex: String(Z_INDEX.statusBar + 1),
                boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ' + colorSet.border,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transform: 'translateX(120%)',
                transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            });
            
            // Icon element
            var iconEl = document.createElement('span');
            Object.assign(iconEl.style, {
                fontSize: '18px',
                lineHeight: '1'
            });
            iconEl.textContent = icon;
            toast.appendChild(iconEl);
            
            // Message element
            var textEl = document.createElement('span');
            textEl.textContent = msg;
            toast.appendChild(textEl);
            
            document.body.appendChild(toast);
            state.toast = toast;
            
            // Slide in (double RAF for reliable animation)
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    if (toast) toast.style.transform = 'translateX(0)';
                });
            });
            
            // Slide out and remove
            setTimeout(function() {
                if (toast) toast.style.transform = 'translateX(120%)';
                setTimeout(function() {
                    if (toast && toast.parentNode) {
                        toast.remove();
                    }
                    if (state.toast === toast) {
                        state.toast = null;
                    }
                }, 200);
            }, duration);
        } catch (e) {
            // Silently fail
        }
    }
    
    // ========================================
    // SELECTOR HELPERS
    // ========================================
    
    function getShortSelector(el) {
        try {
            if (!el || !el.tagName) return 'unknown';
            var selector = el.tagName.toLowerCase();
            if (el.id) selector += '#' + el.id;
            var classStr = getSafeClassName(el);
            if (classStr) {
                var classes = classStr.trim().split(/\s+/).filter(function(c) {
                    return c && c.indexOf(':') === -1 && c.indexOf('_') !== 0;
                });
                if (classes.length > 0) {
                    selector += '.' + classes.slice(0, 3).join('.');
                }
            }
            return selector;
        } catch (e) {
            return 'unknown';
        }
    }
    
    function getUniqueSelector(el) {
        try {
            if (!el) return 'unknown';
            if (el.id) return '#' + el.id;
            var path = [];
            while (el && el.nodeType === Node.ELEMENT_NODE) {
                var selector = el.tagName ? el.tagName.toLowerCase() : 'unknown';
                if (el.id) {
                    path.unshift('#' + el.id);
                    break;
                } else {
                    var classStr = getSafeClassName(el);
                    if (classStr) {
                        var classes = classStr.trim().split(/\s+/).filter(function(c) {
                            return c && c.indexOf(':') === -1 && c.indexOf('_') !== 0;
                        });
                        if (classes.length > 0) {
                            selector += '.' + classes.slice(0, 2).join('.');
                        }
                    }
                }
                path.unshift(selector);
                el = el.parentElement;
            }
            return path.slice(-4).join(' > ');
        } catch (e) {
            return 'unknown';
        }
    }
    
    function getText(el) {
        try {
            if (!el) return '';
            var text = '';
            // Get direct text content, not from children
            for (var i = 0; i < el.childNodes.length; i++) {
                if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
                    text += el.childNodes[i].textContent;
                }
            }
            // Fallback to full textContent if no direct text
            if (!text.trim()) {
                text = el.textContent || '';
            }
            // Early length limit before regex processing (prevent DoS)
            if (text.length > 10000) {
                text = text.substring(0, 10000);
            }
            var cleaned = text.replace(/\s+/g, ' ').trim();
            // Truncate long text
            if (cleaned.length > 50) {
                cleaned = cleaned.substring(0, 47) + '...';
            }
            return cleaned;
        } catch (err) {
            return '';
        }
    }
    
    // ========================================
    // PREDICTED ACTION
    // ========================================
    
    function getPredictedAction(el) {
        try {
            if (!el || !el.tagName) return '';
            var tag = el.tagName.toLowerCase();
            var type = getSafeType(el);
            var role = el.getAttribute('role');
            var href = getSafeHref(el);
            
            // Links
            if (tag === 'a' && href) {
                if (href.indexOf('mailto:') === 0) return 'email';
                if (href.indexOf('tel:') === 0) return 'call';
                if (href.indexOf('#') === 0) return 'scroll';
                if (href.indexOf('http') === 0) return 'navigate';
                return 'navigate';
            }
            
            // Buttons
            if (tag === 'button' || role === 'button') {
                if (type === 'submit') return 'submit-form';
                if (type === 'reset') return 'reset-form';
                var text = getText(el).toLowerCase();
                if (text.indexOf('submit') !== -1) return 'submit';
                if (text.indexOf('save') !== -1) return 'save';
                if (text.indexOf('delete') !== -1 || text.indexOf('remove') !== -1) return 'delete';
                if (text.indexOf('cancel') !== -1) return 'cancel';
                if (text.indexOf('close') !== -1) return 'close';
                if (text.indexOf('add') !== -1) return 'add';
                if (text.indexOf('edit') !== -1) return 'edit';
                if (text.indexOf('search') !== -1) return 'search';
                if (text.indexOf('login') !== -1 || text.indexOf('sign in') !== -1) return 'login';
                if (text.indexOf('logout') !== -1 || text.indexOf('sign out') !== -1) return 'logout';
                return 'click';
            }
            
            // Inputs
            if (tag === 'input') {
                if (type === 'checkbox') return 'toggle';
                if (type === 'radio') return 'select';
                if (type === 'file') return 'upload';
                if (type === 'submit') return 'submit-form';
                if (type === 'reset') return 'reset-form';
                return 'input';
            }
            
            // Select
            if (tag === 'select') return 'select-option';
            
            // Textarea
            if (tag === 'textarea') return 'input-text';
            
            // Interactive elements
            if (el.onclick || el.getAttribute('onclick')) return 'click';
            if (role === 'tab') return 'switch-tab';
            if (role === 'menuitem') return 'menu-action';
            if (role === 'checkbox') return 'toggle';
            if (role === 'switch') return 'toggle';
            if (role === 'slider') return 'adjust';
            if (role === 'link') return 'navigate';
            
            // Check for click handlers via data attributes
            if (el.hasAttribute('data-action')) {
                var dataAction = el.getAttribute('data-action') || '';
                // Sanitize: only allow alphanumeric, hyphens, underscores
                if (dataAction.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(dataAction)) {
                    return dataAction;
                }
            }
            
            // Expandable
            if (el.getAttribute('aria-expanded') !== null) return 'expand/collapse';
            if (el.getAttribute('aria-haspopup')) return 'open-popup';
            
            return '';
        } catch (e) {
            return '';
        }
    }
    
    // ========================================
    // DESTINATION DETECTION
    // ========================================
    
    function formatDestinationDisplay(url) {
        try {
            if (!url) return '';
            if (typeof url !== 'string') return '';
            
            // External URL
            if (url.indexOf('http') === 0) {
                try {
                    var u = new URL(url);
                    if (u.hostname !== window.location.hostname) {
                        var path = u.pathname;
                        if (path.length > 20) path = path.substring(0, 17) + '...';
                        return '\u2197 ' + u.hostname + path;
                    }
                    var localPath = u.pathname + (u.search ? '?...' : '');
                    return localPath.length > 30 ? localPath.substring(0, 27) + '...' : localPath;
                } catch (urlErr) {
                    return url.length > 30 ? url.substring(0, 27) + '...' : url;
                }
            }
            // Anchor
            if (url.indexOf('#') === 0) {
                return '\u2693 ' + url;
            }
            // mailto
            if (url.indexOf('mailto:') === 0) {
                return '\u2709 ' + url.substring(7);
            }
            // tel
            if (url.indexOf('tel:') === 0) {
                return '\u260E ' + url.substring(4);
            }
            // Relative URL
            if (url.indexOf('/') === 0 || url.indexOf('./') === 0) {
                return url.length > 30 ? url.substring(0, 27) + '...' : url;
            }
            // JavaScript void or other
            if (url.indexOf('javascript:') === 0) {
                return null;
            }
            return url.length > 30 ? url.substring(0, 27) + '...' : url;
        } catch (e) {
            return url;
        }
    }
    
    function getDestination(el) {
        try {
            if (!el || !el.tagName) return null;
            
            var dest = { type: null, url: null, display: null, method: null };
            var tag = el.tagName.toLowerCase();
            
            // 1. Direct href (links)
            var href = getSafeHref(el);
            if (href && href.indexOf('javascript:void') === -1) {
                dest.type = 'href';
                dest.url = href;
                dest.display = formatDestinationDisplay(href);
                if (dest.display) return dest;
            }
            
            // 2. Button formaction attribute (takes precedence over form action)
            var formaction = el.getAttribute('formaction');
            if (formaction) {
                dest.type = 'formaction';
                dest.url = formaction;
                dest.method = (el.getAttribute('formmethod') || 'POST').toUpperCase();
                dest.display = formatDestinationDisplay(formaction) + ' [' + dest.method + ']';
                return dest;
            }
            
            // 3. Form action (buttons/inputs in forms)
            var form = el.closest('form');
            if (form && form.action) {
                var isSubmitter = tag === 'button' || (tag === 'input' && (getSafeType(el) === 'submit' || getSafeType(el) === 'image'));
                if (isSubmitter || tag === 'form') {
                    dest.type = 'form-action';
                    dest.url = form.action;
                    dest.method = (form.method || 'GET').toUpperCase();
                    dest.display = formatDestinationDisplay(form.action) + ' [' + dest.method + ']';
                    return dest;
                }
            }
            
            // 4. Data attributes (common patterns)
            var dataAttrs = ['data-href', 'data-url', 'data-link', 'data-target', 'data-action', 'data-navigate'];
            for (var i = 0; i < dataAttrs.length; i++) {
                var val = el.getAttribute(dataAttrs[i]);
                // Limit length to prevent abuse
                if (val && val.length <= LIMITS.maxDataAttrLength && (val.indexOf('/') !== -1 || val.indexOf('http') === 0)) {
                    dest.type = dataAttrs[i];
                    dest.url = val;
                    dest.display = formatDestinationDisplay(val);
                    if (dest.display) return dest;
                }
            }
            
            // 5. Parse onclick for URLs (basic pattern matching)
            var onclick = el.getAttribute('onclick') || '';
            // Limit length to prevent ReDoS
            if (onclick && onclick.length <= LIMITS.maxOnclickLength) {
                // Match URLs in quotes (non-greedy)
                var urlMatch = onclick.match(/['"]((https?:\/\/|\/)[^'"]{1,200})['"]/);
                if (urlMatch) {
                    dest.type = 'onclick';
                    dest.url = urlMatch[1];
                    dest.display = formatDestinationDisplay(urlMatch[1]);
                    if (dest.display) return dest;
                }
                // Match window.location or location.href assignments
                var locMatch = onclick.match(/location(?:\.href)?\s*=\s*['"]([^'"]{1,200})['"]/);
                if (locMatch) {
                    dest.type = 'onclick-redirect';
                    dest.url = locMatch[1];
                    dest.display = formatDestinationDisplay(locMatch[1]);
                    if (dest.display) return dest;
                }
            }
            
            // 6. Check for router links (React Router, Vue Router, Next.js)
            var routerAttr = el.getAttribute('to');
            if (routerAttr && routerAttr.indexOf('/') === 0) {
                dest.type = 'router-link';
                dest.url = routerAttr;
                dest.display = routerAttr;
                return dest;
            }
            
            // 7. Check for Next.js Link (often wraps an <a>)
            if (tag === 'a') {
                var parent = el.parentElement;
                if (parent && parent.tagName && parent.tagName.toLowerCase() === 'link') {
                    var parentHref = parent.getAttribute('href');
                    if (parentHref) {
                        dest.type = 'next-link';
                        dest.url = parentHref;
                        dest.display = formatDestinationDisplay(parentHref);
                        if (dest.display) return dest;
                    }
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    }
    
    // ========================================
    // LABEL CONTENT
    // ========================================
    
    function updateLabel(el, rect) {
        try {
            if (!state.label || !el) {
                if (state.label) state.label.style.display = 'none';
                return;
            }
            
            var selector = getShortSelector(el);
            var dims = Math.round(rect.width) + '\u00D7' + Math.round(rect.height);
            var action = getPredictedAction(el);
            var text = getText(el);
            var dest = getDestination(el);
            
            var content = selector + '\n' + dims;
            
            // Show destination if available, otherwise show action
            if (dest && dest.display) {
                content += ' \u2192 ' + dest.display;
            } else if (action) {
                content += ' \u2192 ' + action;
            }
            
            if (text) {
                content += '\n"' + text + '"';
            }
            
            state.label.textContent = content;
            state.label.style.display = 'block';
            
            // Position label below element with smart positioning
            var labelRect = state.label.getBoundingClientRect();
            var viewportWidth = window.innerWidth;
            var viewportHeight = window.innerHeight;
            
            var left = rect.left;
            var top = rect.bottom + 8;
            
            // If below would overflow, position above
            if (top + labelRect.height > viewportHeight - 10) {
                top = rect.top - labelRect.height - 8;
            }
            
            // If still overflows (element at very top), position to side
            if (top < 10) {
                top = Math.max(10, rect.top);
            }
            
            // Horizontal overflow
            if (left + labelRect.width > viewportWidth - 10) {
                left = viewportWidth - labelRect.width - 10;
            }
            if (left < 10) {
                left = 10;
            }
            
            state.label.style.left = left + 'px';
            state.label.style.top = top + 'px';
        } catch (e) {
            if (state.label) state.label.style.display = 'none';
        }
    }
    
    function updateStatusBar(el) {
        try {
            var elementInfo = document.getElementById('precision-inspector-element-info');
            if (!elementInfo) return;
            
            if (!el) {
                elementInfo.textContent = 'Hover to inspect';
                elementInfo.style.color = COLORS.statusBarMuted;
                return;
            }
            
            var selector = getShortSelector(el);
            var rect = el.getBoundingClientRect();
            var dims = Math.round(rect.width) + '\u00D7' + Math.round(rect.height);
            var action = getPredictedAction(el);
            var dest = getDestination(el);
            
            var info = selector + ' \u2022 ' + dims;
            
            // Show destination if available, otherwise show action
            if (dest && dest.display) {
                info += ' \u2192 ' + dest.display;
            } else if (action) {
                info += ' \u2192 ' + action;
            }
            
            elementInfo.textContent = info;
            elementInfo.style.color = COLORS.statusBarText;
        } catch (e) {
            // Silently fail
        }
    }
    
    // ========================================
    // HIGHLIGHT POSITIONING
    // ========================================
    
    function updateHighlight(el) {
        try {
            if (!state.highlight) return;
            
            if (!el || el === document.body || el === document.documentElement) {
                state.highlight.style.display = 'none';
                updateLabel(null, null);
                updateStatusBar(null);
                return;
            }
            
            var rect = el.getBoundingClientRect();
            
            // Skip zero-dimension elements
            if (rect.width === 0 && rect.height === 0) {
                state.highlight.style.display = 'none';
                updateLabel(null, null);
                updateStatusBar(null);
                return;
            }
            
            state.highlight.style.display = 'block';
            state.highlight.style.left = rect.left + 'px';
            state.highlight.style.top = rect.top + 'px';
            state.highlight.style.width = rect.width + 'px';
            state.highlight.style.height = rect.height + 'px';
            
            updateLabel(el, rect);
            updateStatusBar(el);
        } catch (e) {
            if (state.highlight) state.highlight.style.display = 'none';
        }
    }
    
    // ========================================
    // EVENT HANDLERS
    // ========================================
    
    function handleMouseMove(e) {
        try {
            if (!state.active) return;
            
            // Throttle to 60fps
            var now = Date.now();
            if (now - state.lastMoveTime < TIMING.throttleMs) return;
            state.lastMoveTime = now;
            
            // Temporarily hide overlay to get element underneath
            if (state.overlay) {
                state.overlay.style.pointerEvents = 'none';
            }
            
            var el = document.elementFromPoint(e.clientX, e.clientY);
            
            // Restore overlay
            if (state.overlay) {
                state.overlay.style.pointerEvents = 'auto';
            }
            
            // Skip our own UI elements
            if (el && (
                el.id === 'precision-inspector-overlay' ||
                el.id === 'precision-inspector-highlight' ||
                el.id === 'precision-inspector-label' ||
                el.id === 'precision-inspector-status' ||
                el.id === 'precision-inspector-toast' ||
                (el.closest && el.closest('#precision-inspector-status'))
            )) {
                return;
            }
            
            // Skip if same element (no need to update)
            if (el === state.hoveredElement) return;
            
            state.hoveredElement = el;
            
            // Use requestAnimationFrame for visual updates
            if (!state.rafPending) {
                state.rafPending = true;
                requestAnimationFrame(function() {
                    state.rafPending = false;
                    updateHighlight(state.hoveredElement);
                });
            }
        } catch (err) {
            // Continue silently
        }
    }
    
    function handleClick(e) {
        try {
            if (!state.active) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (!state.hoveredElement) {
                showToast('No element selected', 'info', TIMING.toastDurationMs);
                return;
            }
            
            // Capture the element
            captureElement(state.hoveredElement);
        } catch (err) {
            showToast('Capture failed', 'error', TIMING.toastDurationMs);
            cleanup();
        }
    }
    
    function handleKeyDown(e) {
        try {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
            }
        } catch (err) {
            cleanup();
        }
    }
    
    // ========================================
    // NETWORK INTERCEPTION
    // ========================================
    
    function sanitizeUrl(url) {
        try {
            var u = new URL(url, window.location.origin);
            
            // Remove sensitive query params
            for (var i = 0; i < SENSITIVE_PARAMS.length; i++) {
                u.searchParams.delete(SENSITIVE_PARAMS[i]);
            }
            
            // Check remaining params for sensitive patterns
            var params = [];
            var keys = [];
            u.searchParams.forEach(function(value, key) {
                keys.push(key);
            });
            
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                var value = u.searchParams.get(key);
                var keyLower = key.toLowerCase();
                var isSensitive = false;
                
                for (var k = 0; k < SENSITIVE_PARAMS.length; k++) {
                    if (keyLower.indexOf(SENSITIVE_PARAMS[k]) !== -1) {
                        isSensitive = true;
                        break;
                    }
                }
                
                if (!isSensitive && value) {
                    params.push(key + '=' + (value.length > 20 ? '[value]' : value));
                }
            }
            
            return u.pathname + (params.length ? '?' + params.join('&') : '');
        } catch (e) {
            return '[url]';
        }
    }
    
    function setupNetworkInterception() {
        try {
            // Store originals
            state.originalFetch = window.fetch;
            state.originalXHROpen = XMLHttpRequest.prototype.open;
            state.originalXHRSend = XMLHttpRequest.prototype.send;
            
            // Wrap fetch
            window.fetch = function(input, init) {
                try {
                    var url = typeof input === 'string' ? input : (input.url || '');
                    var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
                    
                    var entry = {
                        type: 'fetch',
                        method: method,
                        url: sanitizeUrl(url),
                        timestamp: Date.now(),
                        status: null,
                        duration: null,
                        initiator: state.hoveredElement ? getShortSelector(state.hoveredElement) : null
                    };
                    
                    // Enforce limit to prevent memory issues
                    if (state.networkLog.length >= LIMITS.maxNetworkEntries) {
                        state.networkLog.shift();
                    }
                    state.networkLog.push(entry);
                    
                    return state.originalFetch.apply(this, arguments)
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
                } catch (e) {
                    return state.originalFetch.apply(this, arguments);
                }
            };
            
            // Wrap XHR open
            XMLHttpRequest.prototype.open = function(method, url) {
                try {
                    this._precisionInspectorEntry = {
                        type: 'xhr',
                        method: method.toUpperCase(),
                        url: sanitizeUrl(url),
                        timestamp: Date.now(),
                        status: null,
                        duration: null,
                        initiator: state.hoveredElement ? getShortSelector(state.hoveredElement) : null
                    };
                    // Enforce limit to prevent memory issues
                    if (state.networkLog.length >= LIMITS.maxNetworkEntries) {
                        state.networkLog.shift();
                    }
                    state.networkLog.push(this._precisionInspectorEntry);
                } catch (e) {
                    // Continue without logging
                }
                return state.originalXHROpen.apply(this, arguments);
            };
            
            // Wrap XHR send
            XMLHttpRequest.prototype.send = function() {
                try {
                    var entry = this._precisionInspectorEntry;
                    var xhr = this;
                    
                    if (entry) {
                        this.addEventListener('loadend', function() {
                            entry.status = xhr.status || 'error';
                            entry.duration = Date.now() - entry.timestamp;
                        });
                    }
                } catch (e) {
                    // Silently fail
                }
                return state.originalXHRSend.apply(this, arguments);
            };
        } catch (e) {
            // Network interception failed, continue without it
        }
    }
    
    function restoreNetworkInterception() {
        try {
            if (state.originalFetch) {
                window.fetch = state.originalFetch;
            }
            if (state.originalXHROpen) {
                XMLHttpRequest.prototype.open = state.originalXHROpen;
            }
            if (state.originalXHRSend) {
                XMLHttpRequest.prototype.send = state.originalXHRSend;
            }
        } catch (e) {
            // Silently fail
        }
    }
    
    // ========================================
    // EXTRACTION FUNCTIONS
    // ========================================
    
    function getPositionInfo(el) {
        try {
            var rect = el.getBoundingClientRect();
            var scrollX = window.scrollX || window.pageXOffset || 0;
            var scrollY = window.scrollY || window.pageYOffset || 0;
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            
            var info = {
                viewport: {
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                page: {
                    left: Math.round(rect.left + scrollX),
                    top: Math.round(rect.top + scrollY)
                },
                percentages: {
                    left: vw > 0 ? (rect.left / vw * 100).toFixed(1) : '0',
                    top: vh > 0 ? (rect.top / vh * 100).toFixed(1) : '0'
                }
            };
            
            var parent = el.offsetParent || el.parentElement;
            if (parent && parent !== document.body) {
                var parentRect = parent.getBoundingClientRect();
                info.inParent = {
                    selector: getShortSelector(parent),
                    leftPct: parentRect.width > 0 ? ((rect.left - parentRect.left) / parentRect.width * 100).toFixed(1) : '0',
                    topPct: parentRect.height > 0 ? ((rect.top - parentRect.top) / parentRect.height * 100).toFixed(1) : '0'
                };
            }
            
            return info;
        } catch (e) {
            return {};
        }
    }
    
    function getVisualInfo(el) {
        try {
            var cs = window.getComputedStyle(el);
            var info = {};
            
            // Visibility
            if (cs.display === 'none') info.hidden = 'display:none';
            else if (cs.visibility === 'hidden') info.hidden = 'visibility:hidden';
            else if (parseFloat(cs.opacity) === 0) info.hidden = 'opacity:0';
            
            var opacity = parseFloat(cs.opacity);
            if (opacity < 1 && opacity > 0) info.opacity = opacity.toFixed(2);
            
            // Colors
            var bg = cs.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                info.background = bg;
            }
            var color = cs.color;
            if (color) info.color = color;
            
            // Typography
            var font = cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily.split(',')[0].trim();
            info.font = font;
            
            // Border radius
            var br = cs.borderRadius;
            if (br && br !== '0px') info.borderRadius = br;
            
            // Cursor
            if (cs.cursor && cs.cursor !== 'auto') info.cursor = cs.cursor;
            
            return info;
        } catch (e) {
            return {};
        }
    }
    
    function getBoxModel(el) {
        try {
            var cs = window.getComputedStyle(el);
            var rect = el.getBoundingClientRect();
            
            return {
                content: {
                    width: Math.round(parseFloat(cs.width) || 0),
                    height: Math.round(parseFloat(cs.height) || 0)
                },
                padding: {
                    top: cs.paddingTop,
                    right: cs.paddingRight,
                    bottom: cs.paddingBottom,
                    left: cs.paddingLeft
                },
                border: {
                    top: cs.borderTopWidth,
                    right: cs.borderRightWidth,
                    bottom: cs.borderBottomWidth,
                    left: cs.borderLeftWidth
                },
                margin: {
                    top: cs.marginTop,
                    right: cs.marginRight,
                    bottom: cs.marginBottom,
                    left: cs.marginLeft
                },
                total: {
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                boxSizing: cs.boxSizing
            };
        } catch (e) {
            return {};
        }
    }
    
    function getSemanticInfo(el) {
        try {
            var info = {};
            
            // Role
            var role = el.getAttribute('role');
            if (role) {
                info.role = role;
            } else {
                // Implicit roles
                var tag = el.tagName.toLowerCase();
                var implicitRoles = {
                    'button': 'button',
                    'a': 'link',
                    'input': 'textbox',
                    'select': 'combobox',
                    'textarea': 'textbox',
                    'img': 'img',
                    'nav': 'navigation',
                    'main': 'main',
                    'header': 'banner',
                    'footer': 'contentinfo',
                    'aside': 'complementary',
                    'article': 'article',
                    'section': 'region'
                };
                if (implicitRoles[tag]) {
                    info.role = implicitRoles[tag] + ' (implicit)';
                }
            }
            
            // ARIA attributes (sanitized: length limit + control char strip)
            var ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) {
                ariaLabel = ariaLabel.substring(0, 200).replace(/[\x00-\x1F\x7F]/g, '');
                if (ariaLabel) info.ariaLabel = ariaLabel;
            }
            
            var ariaDescribedBy = el.getAttribute('aria-describedby');
            if (ariaDescribedBy) {
                ariaDescribedBy = ariaDescribedBy.substring(0, 100);
                info.ariaDescribedBy = ariaDescribedBy;
            }
            
            var ariaLabelledBy = el.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
                ariaLabelledBy = ariaLabelledBy.substring(0, 100);
                info.ariaLabelledBy = ariaLabelledBy;
            }
            
            // Href for links
            var href = getSafeHref(el);
            if (href) info.href = sanitizeUrl(href);
            
            return info;
        } catch (e) {
            return {};
        }
    }
    
    function getInteractiveState(el) {
        try {
            var info = {};
            
            if (el.disabled) info.disabled = true;
            if (el.checked) info.checked = true;
            if (el.selected) info.selected = true;
            if (el.readOnly) info.readOnly = true;
            if (el.required) info.required = true;
            if (document.activeElement === el) info.focused = true;
            
            var ariaExpanded = el.getAttribute('aria-expanded');
            if (ariaExpanded) info.expanded = ariaExpanded === 'true';
            
            var ariaPressed = el.getAttribute('aria-pressed');
            if (ariaPressed) info.pressed = ariaPressed === 'true';
            
            var ariaSelected = el.getAttribute('aria-selected');
            if (ariaSelected) info.selected = ariaSelected === 'true';
            
            return info;
        } catch (e) {
            return {};
        }
    }
    
    function hasInteractivity(el) {
        try {
            var info = {};
            var tag = el.tagName.toLowerCase();
            var cs = window.getComputedStyle(el);
            
            // Native interactive elements
            var interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
            if (arrayIndexOf(interactiveTags, tag) !== -1) {
                info.nativeInteractive = true;
            }
            
            // Focusable
            var tabindex = el.getAttribute('tabindex');
            if (tabindex !== null && tabindex !== '-1') {
                info.focusable = true;
                info.tabindex = parseInt(tabindex, 10);
            } else if (arrayIndexOf(interactiveTags, tag) !== -1 && !el.disabled) {
                info.focusable = true;
                info.tabindex = 0;
            }
            
            // Cursor pointer
            if (cs.cursor === 'pointer') {
                info.cursorPointer = true;
            }
            
            // Click handlers
            if (el.onclick || el.getAttribute('onclick')) {
                info.hasClickHandler = true;
            }
            
            // Role-based interactivity
            var role = el.getAttribute('role');
            var interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option'];
            if (role && arrayIndexOf(interactiveRoles, role) !== -1) {
                info.interactiveRole = role;
            }
            
            return info;
        } catch (e) {
            return {};
        }
    }
    
    function getDOMPath(el) {
        try {
            var path = [];
            var current = el;
            
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                var selector = current.tagName.toLowerCase();
                if (current.id) {
                    selector += '#' + current.id;
                }
                path.unshift(selector);
                current = current.parentElement;
            }
            
            return {
                path: path.join(' > '),
                depth: path.length
            };
        } catch (e) {
            return { path: '', depth: 0 };
        }
    }
    
    function getCSSVariables(el) {
        try {
            var variables = [];
            
            // Get all CSS custom properties from the element
            // Note: This is limited - we can only get computed values, not the variable names
            // We'll check common variable patterns
            var commonVars = [
                '--color-primary', '--color-secondary', '--color-accent',
                '--bg-color', '--text-color', '--border-color',
                '--font-family', '--font-size', '--line-height',
                '--spacing', '--padding', '--margin',
                '--border-radius', '--shadow',
                '--btn-bg', '--btn-text', '--btn-border'
            ];
            
            // Check :root for CSS variables
            var rootStyles = window.getComputedStyle(document.documentElement);
            
            for (var i = 0; i < commonVars.length; i++) {
                var varName = commonVars[i];
                var value = rootStyles.getPropertyValue(varName).trim();
                if (value) {
                    variables.push({
                        name: varName,
                        value: value,
                        from: ':root'
                    });
                }
            }
            
            return variables;
        } catch (e) {
            return [];
        }
    }
    
    function getNetworkContext() {
        try {
            return state.networkLog.map(function(entry) {
                var result = {
                    type: entry.type,
                    method: entry.method,
                    url: entry.url,
                    status: entry.status,
                    duration: entry.duration ? entry.duration + 'ms' : 'pending'
                };
                if (entry.initiator) {
                    result.initiator = entry.initiator;
                }
                return result;
            });
        } catch (e) {
            return [];
        }
    }
    
    function getFormContext(el) {
        try {
            var form = el.closest('form');
            if (!form) return null;
            
            return {
                id: form.id || null,
                name: form.name || null,
                action: form.action ? sanitizeUrl(form.action) : null,
                method: (form.method || 'GET').toUpperCase(),
                enctype: form.enctype || null
            };
        } catch (e) {
            return null;
        }
    }
    
    function getInputValue(el) {
        try {
            var type = getSafeType(el);
            var name = (el.name || el.id || '').toLowerCase();
            
            // Never return password values
            if (type === 'password') {
                return '[password]';
            }
            
            // Check name/id for sensitive patterns
            for (var i = 0; i < SENSITIVE_INPUT_NAMES.length; i++) {
                if (name.indexOf(SENSITIVE_INPUT_NAMES[i]) !== -1) {
                    return '[sensitive]';
                }
            }
            
            return el.value || '';
        } catch (e) {
            return '';
        }
    }
    
    function getInputConstraints(el) {
        try {
            var tag = el.tagName.toLowerCase();
            if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
                return null;
            }
            
            var constraints = {};
            
            if (el.minLength > 0) constraints.minLength = el.minLength;
            if (el.maxLength > 0 && el.maxLength < 524288) constraints.maxLength = el.maxLength;
            if (el.min) constraints.min = el.min;
            if (el.max) constraints.max = el.max;
            if (el.step) constraints.step = el.step;
            if (el.pattern) constraints.pattern = el.pattern;
            if (el.required) constraints.required = true;
            if (el.placeholder) constraints.placeholder = el.placeholder;
            if (el.inputMode) constraints.inputMode = el.inputMode;
            if (el.autocomplete) constraints.autocomplete = el.autocomplete;
            
            return Object.keys(constraints).length > 0 ? constraints : null;
        } catch (e) {
            return null;
        }
    }
    
    // ========================================
    // OUTPUT FORMATTING
    // ========================================
    
    function formatOutput(el) {
        try {
            var lines = [];
            var now = new Date().toISOString();
            var scrollX = window.scrollX || window.pageXOffset || 0;
            var scrollY = window.scrollY || window.pageYOffset || 0;
            
            // Header
            lines.push('+-----------------------------------------------------------------');
            lines.push('| PRECISION EXTRACT');
            lines.push('| url: ' + sanitizeUrl(window.location.href));
            lines.push('| viewport: ' + window.innerWidth + '×' + window.innerHeight + '  scroll: ' + Math.round(scrollX) + ',' + Math.round(scrollY));
            lines.push('| mode: precision-hover');
            lines.push('| captured: ' + now);
            lines.push('+-----------------------------------------------------------------');
            
            // Selected Element
            lines.push('| SELECTED ELEMENT');
            lines.push('| tag: ' + getShortSelector(el));
            var text = getText(el);
            if (text) lines.push('| text: "' + text + '"');
            lines.push('| selector: ' + getUniqueSelector(el));
            lines.push('+-----------------------------------------------------------------');
            
            // DOM Path
            var domPath = getDOMPath(el);
            lines.push('| DOM PATH');
            lines.push('| ' + domPath.path);
            lines.push('| depth: ' + domPath.depth);
            lines.push('+-----------------------------------------------------------------');
            
            // Box Model
            var boxModel = getBoxModel(el);
            if (boxModel.content) {
                lines.push('| BOX MODEL');
                lines.push('|--- content: ' + boxModel.content.width + '×' + boxModel.content.height);
                if (boxModel.padding) {
                    lines.push('|--- padding: ' + boxModel.padding.top + ' ' + boxModel.padding.right + ' ' + boxModel.padding.bottom + ' ' + boxModel.padding.left);
                }
                if (boxModel.border) {
                    lines.push('|--- border: ' + boxModel.border.top + ' ' + boxModel.border.right + ' ' + boxModel.border.bottom + ' ' + boxModel.border.left);
                }
                if (boxModel.margin) {
                    lines.push('|--- margin: ' + boxModel.margin.top + ' ' + boxModel.margin.right + ' ' + boxModel.margin.bottom + ' ' + boxModel.margin.left);
                }
                if (boxModel.total) {
                    lines.push('|--- total: ' + boxModel.total.width + '×' + boxModel.total.height);
                }
                if (boxModel.boxSizing) {
                    lines.push('|--- box-sizing: ' + boxModel.boxSizing);
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Position
            var position = getPositionInfo(el);
            if (position.viewport) {
                lines.push('| POSITION');
                lines.push('|--- viewport: ' + position.viewport.left + ',' + position.viewport.top + ' (' + position.viewport.width + '×' + position.viewport.height + ')');
                if (position.page) {
                    lines.push('|--- page: ' + position.page.left + ',' + position.page.top);
                }
                if (position.inParent) {
                    lines.push('|--- in-parent: ' + position.inParent.leftPct + '%, ' + position.inParent.topPct + '% of ' + position.inParent.selector);
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Visual
            var visual = getVisualInfo(el);
            if (Object.keys(visual).length > 0) {
                lines.push('| VISUAL');
                if (visual.background) lines.push('|--- background: ' + visual.background);
                if (visual.color) lines.push('|--- color: ' + visual.color);
                if (visual.font) lines.push('|--- font: ' + visual.font);
                if (visual.borderRadius) lines.push('|--- border-radius: ' + visual.borderRadius);
                if (visual.cursor) lines.push('|--- cursor: ' + visual.cursor);
                if (visual.opacity) lines.push('|--- opacity: ' + visual.opacity);
                if (visual.hidden) lines.push('|--- hidden: ' + visual.hidden);
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Semantic
            var semantic = getSemanticInfo(el);
            if (Object.keys(semantic).length > 0) {
                lines.push('| SEMANTIC');
                if (semantic.role) lines.push('|--- role: ' + semantic.role);
                if (semantic.ariaLabel) lines.push('|--- aria-label: ' + semantic.ariaLabel);
                if (semantic.ariaDescribedBy) lines.push('|--- aria-describedby: ' + semantic.ariaDescribedBy);
                if (semantic.ariaLabelledBy) lines.push('|--- aria-labelledby: ' + semantic.ariaLabelledBy);
                if (semantic.href) lines.push('|--- href: ' + semantic.href);
                lines.push('+-----------------------------------------------------------------');
            }
            
            // State
            var interactiveState = getInteractiveState(el);
            if (Object.keys(interactiveState).length > 0) {
                lines.push('| STATE');
                for (var key in interactiveState) {
                    if (interactiveState.hasOwnProperty(key)) {
                        lines.push('|--- ' + key + ': ' + interactiveState[key]);
                    }
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Interactive
            var interactive = hasInteractivity(el);
            if (Object.keys(interactive).length > 0) {
                lines.push('| INTERACTIVE');
                for (var iKey in interactive) {
                    if (interactive.hasOwnProperty(iKey)) {
                        lines.push('|--- ' + iKey + ': ' + interactive[iKey]);
                    }
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Predicted Action
            var action = getPredictedAction(el);
            if (action) {
                lines.push('| PREDICTED ACTION');
                lines.push('|--- ' + action);
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Destination
            var dest = getDestination(el);
            if (dest) {
                lines.push('| DESTINATION');
                lines.push('|--- type: ' + dest.type);
                lines.push('|--- url: ' + sanitizeUrl(dest.url));
                if (dest.display) lines.push('|--- display: ' + dest.display);
                if (dest.method) lines.push('|--- method: ' + dest.method);
                if (dest.type === 'form-action') {
                    var destForm = el.closest('form');
                    if (destForm) {
                        if (destForm.enctype) lines.push('|--- enctype: ' + destForm.enctype);
                    }
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Form Context
            var formContext = getFormContext(el);
            if (formContext) {
                lines.push('| FORM CONTEXT');
                if (formContext.id) lines.push('|--- form-id: ' + formContext.id);
                if (formContext.name) lines.push('|--- form-name: ' + formContext.name);
                if (formContext.action) lines.push('|--- action: ' + formContext.action);
                if (formContext.method) lines.push('|--- method: ' + formContext.method);
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Input Constraints
            var constraints = getInputConstraints(el);
            if (constraints) {
                lines.push('| INPUT CONSTRAINTS');
                for (var cKey in constraints) {
                    if (constraints.hasOwnProperty(cKey)) {
                        lines.push('|--- ' + cKey + ': ' + constraints[cKey]);
                    }
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Input Value (if applicable)
            var tag = el.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                var value = getInputValue(el);
                if (value) {
                    lines.push('| CURRENT VALUE');
                    lines.push('|--- "' + value + '"');
                    lines.push('+-----------------------------------------------------------------');
                }
            }
            
            // CSS Variables
            var cssVars = getCSSVariables(el);
            if (cssVars.length > 0) {
                lines.push('| CSS VARIABLES');
                for (var v = 0; v < cssVars.length; v++) {
                    lines.push('|--- ' + cssVars[v].name + ': ' + cssVars[v].value + ' (from ' + cssVars[v].from + ')');
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Network Context
            var networkContext = getNetworkContext();
            if (networkContext.length > 0) {
                lines.push('| NETWORK CONTEXT (' + networkContext.length + ' requests since activation)');
                for (var n = 0; n < networkContext.length; n++) {
                    var req = networkContext[n];
                    var reqLine = '|--- ' + (n + 1) + '. ' + req.method + ' ' + req.url + ' \u2192 ' + req.status + ' (' + req.duration + ')';
                    if (req.initiator) {
                        reqLine += ' [from: ' + req.initiator + ']';
                    }
                    lines.push(reqLine);
                }
                lines.push('+-----------------------------------------------------------------');
            }
            
            // Duration
            var duration = Date.now() - state.startTime;
            lines.push('| INSPECTOR ACTIVE: ' + (duration / 1000).toFixed(1) + 's');
            lines.push('+-----------------------------------------------------------------');
            
            return lines.join('\n');
        } catch (e) {
            return 'Error formatting output: ' + e.message;
        }
    }
    
    // ========================================
    // CLIPBOARD
    // ========================================
    
    function copyToClipboard(text) {
        try {
            // Try modern API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text)
                    .then(function() { return true; })
                    .catch(function() { return fallbackCopy(text); });
            }
            // Fallback for older browsers
            return Promise.resolve(fallbackCopy(text));
        } catch (e) {
            return Promise.resolve(fallbackCopy(text));
        }
    }
    
    function fallbackCopy(text) {
        try {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            Object.assign(textarea.style, {
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                opacity: '0'
            });
            document.body.appendChild(textarea);
            textarea.select();
            var success = document.execCommand('copy');
            textarea.remove();
            return success;
        } catch (e) {
            return false;
        }
    }
    
    // ========================================
    // CAPTURE
    // ========================================
    
    function flashElement() {
        try {
            if (!state.highlight) return;
            
            // Store original styles
            var origBorder = state.highlight.style.border;
            var origBg = state.highlight.style.background;
            var origTransition = state.highlight.style.transition;
            
            // Flash to green (success color)
            state.highlight.style.transition = 'none';
            state.highlight.style.border = '3px solid #22c55e';
            state.highlight.style.background = 'rgba(34, 197, 94, 0.25)';
            
            // Restore after brief flash
            setTimeout(function() {
                if (state.highlight) {
                    state.highlight.style.transition = 'all ' + TIMING.animationMs + 'ms ease-out';
                    state.highlight.style.border = origBorder;
                    state.highlight.style.background = origBg;
                    
                    // Restore original transition after animation
                    setTimeout(function() {
                        if (state.highlight) {
                            state.highlight.style.transition = origTransition;
                        }
                    }, TIMING.animationMs);
                }
            }, TIMING.flashDurationMs);
        } catch (e) {
            // Silently fail
        }
    }
    
    function captureElement(el) {
        try {
            // Flash the highlight for visual feedback
            flashElement();
            
            var output = formatOutput(el);
            
            copyToClipboard(output)
                .then(function(success) {
                    if (success) {
                        showToast('Copied to clipboard', 'success', TIMING.toastDurationMs);
                    } else {
                        showToast('Copy failed - check console', 'error', 2000);
                        console.log('Precision Inspector Output:\n' + output);
                    }
                })
                .catch(function(err) {
                    showToast('Copy failed', 'error', TIMING.toastDurationMs);
                    console.log('Precision Inspector Output:\n' + output);
                })
                .then(function() {
                    // Always cleanup after operation completes (finally equivalent)
                    setTimeout(function() {
                        cleanup();
                    }, TIMING.cleanupDelayMs);
                });
        } catch (e) {
            showToast('Capture failed', 'error', TIMING.toastDurationMs);
            cleanup();
        }
    }
    
    // ========================================
    // CLEANUP
    // ========================================
    
    function cleanup() {
        try {
            state.active = false;
            
            // Remove event listeners
            if (state.overlay) {
                state.overlay.removeEventListener('mousemove', handleMouseMove);
                state.overlay.removeEventListener('click', handleClick);
            }
            document.removeEventListener('keydown', handleKeyDown);
            
            // Remove UI elements
            for (var i = 0; i < UI_ELEMENT_IDS.length; i++) {
                var el = document.getElementById(UI_ELEMENT_IDS[i]);
                if (el) el.remove();
            }
            
            // Restore network interception
            restoreNetworkInterception();
            
            // Clear state
            state.overlay = null;
            state.highlight = null;
            state.label = null;
            state.statusBar = null;
            state.toast = null;
            state.hoveredElement = null;
            state.networkLog = [];
            state.lastMoveTime = 0;
            state.rafPending = false;
        } catch (e) {
            // Force remove elements
            for (var j = 0; j < UI_ELEMENT_IDS.length; j++) {
                var elem = document.getElementById(UI_ELEMENT_IDS[j]);
                if (elem && elem.parentNode) {
                    elem.parentNode.removeChild(elem);
                }
            }
        }
    }
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    function init() {
        try {
            // Create UI
            createOverlay();
            createHighlight();
            createLabel();
            createStatusBar();
            
            // Setup network interception
            setupNetworkInterception();
            
            // Attach event listeners
            if (state.overlay) {
                state.overlay.addEventListener('mousemove', handleMouseMove);
                state.overlay.addEventListener('click', handleClick);
            }
            document.addEventListener('keydown', handleKeyDown);
            
            // Show activation toast
            showToast('Precision Inspector Active', 'info', TIMING.toastDurationMs);
        } catch (e) {
            showToast('Failed to initialize', 'error', 2000);
            cleanup();
        }
    }
    
    // Start
    init();
    
    } catch (e) {
        // Global error handler
        console.error('Precision Inspector Error:', e);
        // Attempt cleanup - inline since UI_ELEMENT_IDS may not be accessible
        var emergencyIds = ['precision-inspector-overlay', 'precision-inspector-highlight', 'precision-inspector-label', 'precision-inspector-status', 'precision-inspector-toast'];
        for (var i = 0; i < emergencyIds.length; i++) {
            var el = document.getElementById(emergencyIds[i]);
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
    }
})();
