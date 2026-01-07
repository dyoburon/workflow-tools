(function() {
    try {
    // ========================================
    // POLYFILLS FOR OLDER BROWSERS
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
                if (el.matches ? el.matches(s) : el.msMatchesSelector(s)) return el;
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
    
    // Helper: Safe array indexOf (works with array-like objects)
    function arrayIndexOf(arr, item) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === item) return i;
        }
        return -1;
    }
    
    // Helper: Simple object-based Set alternative for IE11
    function SimpleSet() {
        this._items = [];
    }
    SimpleSet.prototype.has = function(item) {
        return arrayIndexOf(this._items, item) !== -1;
    };
    SimpleSet.prototype.add = function(item) {
        if (!this.has(item)) {
            this._items.push(item);
        }
    };
    
    // Helper: Safe href extraction (handles SVGAnimatedString on SVG <a> elements)
    function getSafeHref(el) {
        var rawHref = el.href;
        if (!rawHref) return '';
        if (typeof rawHref === 'string') return rawHref;
        if (rawHref.baseVal) return rawHref.baseVal;
        return '';
    }
    
    // Helper: Safe type extraction (handles SVGAnimatedString)
    function getSafeType(el) {
        var rawType = el.type;
        if (!rawType) return '';
        if (typeof rawType === 'string') return rawType.toLowerCase();
        if (rawType.baseVal) return rawType.baseVal.toLowerCase();
        return '';
    }
    
    // Helper: Safe className extraction (handles SVGAnimatedString)
    function getSafeClassName(el) {
        var rawClass = el.className;
        if (!rawClass) return '';
        if (typeof rawClass === 'string') return rawClass;
        if (rawClass.baseVal) return rawClass.baseVal;
        return '';
    }
    
    // Toggle off if already active
    if (document.getElementById('dom-extractor-overlay')) {
        document.getElementById('dom-extractor-overlay').remove();
        return;
    }

    var startX, startY, box;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scrollX = window.scrollX || window.pageXOffset;
    var scrollY = window.scrollY || window.pageYOffset;

    // ========================================
    // OVERLAY SETUP
    // ========================================
    var overlay = document.createElement('div');
    overlay.id = 'dom-extractor-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        cursor: 'crosshair',
        zIndex: '2147483647',
        background: 'transparent'
    });

    function createBox() {
        box = document.createElement('div');
        Object.assign(box.style, {
            position: 'fixed',
            border: '2px solid #0066ff',
            background: 'rgba(0,102,255,0.1)',
            pointerEvents: 'none',
            zIndex: '2147483647'
        });
        overlay.appendChild(box);
    }

    function showToast(msg, duration) {
        duration = duration || 2000;
        var t = document.createElement('div');
        Object.assign(t.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#1a1a2e',
            color: '#eee',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'SF Mono, Monaco, Consolas, monospace',
            zIndex: '2147483647',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            maxWidth: '300px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
            border: '1px solid #333',
            opacity: '0.95'
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.remove(); }, duration);
    }

    // ========================================
    // SELECTOR HELPERS
    // ========================================
    function getShortSelector(el) {
        try {
            var selector = el.tagName ? el.tagName.toLowerCase() : 'unknown';
            if (el.id) selector += '#' + el.id;
            // Handle SVG className (SVGAnimatedString) and regular className
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
            if (el.id) return '#' + el.id;
            var path = [];
            while (el && el.nodeType === Node.ELEMENT_NODE) {
                var selector = el.tagName ? el.tagName.toLowerCase() : 'unknown';
                if (el.id) {
                    path.unshift('#' + el.id);
                    break;
                } else {
                    // Handle SVG className (SVGAnimatedString) and regular className
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
            // Truncate for output
            if (cleaned.length > 200) {
                cleaned = cleaned.substring(0, 197) + '...';
            }
            return cleaned;
        } catch (err) {
            return '';
        }
    }

    // ========================================
    // POSITION & REGION HELPERS
    // ========================================
    function getRegionName(leftPct, topPct) {
        var h = leftPct < 33 ? 'left' : leftPct > 66 ? 'right' : 'center';
        var v = topPct < 33 ? 'top' : topPct > 66 ? 'bottom' : 'middle';
        return v + '-' + h;
    }

    function getPositionInfo(el) {
        try {
            var rect = el.getBoundingClientRect();
            var parent = el.offsetParent || el.parentElement;
            var info = {
                viewport: {
                    left: rect.left.toFixed(0),
                    top: rect.top.toFixed(0),
                    width: rect.width.toFixed(0),
                    height: rect.height.toFixed(0)
                },
                page: {
                    left: (rect.left + scrollX).toFixed(0),
                    top: (rect.top + scrollY).toFixed(0)
                },
                percentages: {
                    left: vw > 0 ? (rect.left / vw * 100).toFixed(1) : '0',
                    top: vh > 0 ? (rect.top / vh * 100).toFixed(1) : '0'
                }
            };
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

    // ========================================
    // VISUAL INFO EXTRACTION
    // ========================================
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
            var fontFamily = cs.fontFamily || '';
            info.font = cs.fontSize + ' ' + (typeof fontFamily === 'string' ? fontFamily.split(',')[0].replace(/['"]/g, '') : '');
            if (cs.fontWeight !== '400' && cs.fontWeight !== 'normal') {
                info.fontWeight = cs.fontWeight;
            }

            // Cursor
            if (cs.cursor !== 'auto' && cs.cursor !== 'default') {
                info.cursor = cs.cursor;
            }

            // Z-index
            if (cs.zIndex !== 'auto') {
                info.zIndex = cs.zIndex;
            }

            return info;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // DESIGN INFO EXTRACTION
    // ========================================
    function getDesignInfo(el) {
        try {
            var cs = window.getComputedStyle(el);
            var info = {};

            // Border radius
            var br = cs.borderRadius;
            if (br && br !== '0px') info.borderRadius = br;

            // Shadows
            var boxShadow = cs.boxShadow;
            if (boxShadow && boxShadow !== 'none') info.shadow = 'yes';

            // Spacing
            var padding = cs.padding;
            if (padding && padding !== '0px') info.padding = padding;
            var margin = cs.margin;
            if (margin && margin !== '0px') info.margin = margin;

            // Layout
            if (cs.display === 'flex') {
                info.layout = 'flex';
                info.flexDirection = cs.flexDirection;
                if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') info.gap = cs.gap;
            } else if (cs.display === 'grid') {
                info.layout = 'grid';
                if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') info.gap = cs.gap;
            }

            // Position
            if (cs.position !== 'static') {
                info.position = cs.position;
            }

            // Transitions
            var transition = cs.transition;
            if (transition && transition !== 'none' && transition !== 'all 0s ease 0s') {
                info.animated = 'yes';
            }

            // Overflow
            if (cs.overflow !== 'visible') {
                info.overflow = cs.overflow;
            }

            return info;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // INTERACTIVE STATE EXTRACTION
    // ========================================
    function getInteractiveState(el) {
        try {
            var state = {};

            // Disabled
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
                state.disabled = true;
            }

            // Checked/Selected
            if (el.checked) state.checked = true;
            if (el.selected) state.selected = true;
            if (el.getAttribute('aria-checked') === 'true') state.checked = true;
            if (el.getAttribute('aria-selected') === 'true') state.selected = true;

            // Expanded/Collapsed
            var expanded = el.getAttribute('aria-expanded');
            if (expanded) state.expanded = expanded === 'true';

            // Focus
            if (document.activeElement === el) state.focused = true;

            // Required
            if (el.required || el.getAttribute('aria-required') === 'true') {
                state.required = true;
            }

            // Invalid
            if (el.validity && !el.validity.valid) state.invalid = true;
            if (el.getAttribute('aria-invalid') === 'true') state.invalid = true;

            // Readonly
            if (el.readOnly) state.readonly = true;

            // Current value for inputs
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                if (el.value && getSafeType(el) !== 'password') {
                    state.value = el.value;
                }
                if (el.placeholder) state.placeholder = el.placeholder;
            }

            return state;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // INPUT CONSTRAINTS EXTRACTION
    // ========================================
    function getInputConstraints(el) {
        try {
            var constraints = {};

            if (el.minLength > 0) constraints.minLength = el.minLength;
            if (el.maxLength > 0 && el.maxLength < 524288) constraints.maxLength = el.maxLength;
            if (el.min) constraints.min = el.min;
            if (el.max) constraints.max = el.max;
            if (el.step) constraints.step = el.step;
            if (el.pattern) constraints.pattern = el.pattern;
            if (el.inputMode) constraints.inputMode = el.inputMode;
            if (el.autocomplete && el.autocomplete !== 'off') {
                constraints.autocomplete = el.autocomplete;
            }

            return constraints;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // SEMANTIC INFO EXTRACTION
    // ========================================
    function getSemanticInfo(el) {
        try {
            var info = {};

            // Role
            var role = el.getAttribute('role');
            if (role) info.role = role;

            // ARIA label (sanitized: length limit + control char strip)
            var ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) {
                ariaLabel = ariaLabel.substring(0, 200).replace(/[\x00-\x1F\x7F]/g, '');
                if (ariaLabel) info.ariaLabel = ariaLabel;
            }

            var ariaLabelledBy = el.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
                var labelEl = document.getElementById(ariaLabelledBy);
                if (labelEl) info.labelledBy = getText(labelEl);
            }

            var ariaDescribedBy = el.getAttribute('aria-describedby');
            if (ariaDescribedBy) {
                var descEl = document.getElementById(ariaDescribedBy);
                if (descEl) info.describedBy = getText(descEl);
            }

            // For inputs, find associated label
            if (el.id) {
                var label = document.querySelector('label[for="' + el.id + '"]');
                if (label) info.label = getText(label);
            }

            // Title/alt
            if (el.title) info.title = el.title;
            if (el.alt) info.alt = el.alt;

            // Links - href can be SVGAnimatedString on SVG <a> elements
            var href = getSafeHref(el);
            if (href) {
                // Sanitize - remove query params for privacy
                try {
                    var url = new URL(href);
                    info.href = url.origin + url.pathname;
                } catch (e2) {
                    info.href = href.split('?')[0];
                }
            }

            // Data attributes (non-sensitive, length-limited)
            var dataAttrs = {};
            for (var i = 0; i < el.attributes.length; i++) {
                var attr = el.attributes[i];
                if (attr.name.indexOf('data-') === 0 &&
                    attr.value.length <= 500 &&
                    attr.name.indexOf('token') === -1 &&
                    attr.name.indexOf('key') === -1 &&
                    attr.name.indexOf('secret') === -1 &&
                    attr.name.indexOf('auth') === -1) {
                    dataAttrs[attr.name] = attr.value;
                }
            }
            if (Object.keys(dataAttrs).length > 0) {
                info.data = dataAttrs;
            }

            return info;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // INTERACTIVITY DETECTION
    // ========================================
    function hasInteractivity(el) {
        try {
            var interactive = [];

            // Native interactive elements
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (['a', 'button', 'input', 'select', 'textarea'].indexOf(tag) !== -1) {
                interactive.push('native-' + tag);
            }

            // Tabindex
            if (el.tabIndex >= 0) interactive.push('focusable');

            // Click handlers (check for onclick or event listeners)
            if (el.onclick) interactive.push('onclick');

            // Cursor pointer
            var cs = window.getComputedStyle(el);
            if (cs.cursor === 'pointer') interactive.push('pointer');

            // Role-based
            var role = el.getAttribute('role');
            if (role && ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option'].indexOf(role) !== -1) {
                interactive.push('role-' + role);
            }

            // Contenteditable
            if (el.contentEditable === 'true') interactive.push('editable');

            // Draggable
            if (el.draggable) interactive.push('draggable');

            return interactive;
        } catch (e) {
            return [];
        }
    }

    // ========================================
    // SCROLL CONTEXT
    // ========================================
    function getScrollContext(el) {
        try {
            var context = {};
            var rect = el.getBoundingClientRect();

            // Is element in viewport?
            context.inViewport = rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;

            // Find scrollable parent
            var parent = el.parentElement;
            while (parent) {
                var cs = window.getComputedStyle(parent);
                if (cs.overflow === 'auto' || cs.overflow === 'scroll' ||
                    cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
                    context.scrollParent = getShortSelector(parent);
                    context.scrollTop = parent.scrollTop;
                    context.scrollHeight = parent.scrollHeight;
                    break;
                }
                parent = parent.parentElement;
            }

            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // PSEUDO CONTENT
    // ========================================
    function getPseudoContent(el) {
        try {
            var pseudo = {};
            var before = window.getComputedStyle(el, '::before').content;
            var after = window.getComputedStyle(el, '::after').content;

            if (before && before !== 'none' && before !== '""' && before !== "''") {
                pseudo.before = before.replace(/^["']|["']$/g, '');
            }
            if (after && after !== 'none' && after !== '""' && after !== "''") {
                pseudo.after = after.replace(/^["']|["']$/g, '');
            }

            return pseudo;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // FORM CONTEXT
    // ========================================
    function getFormContext(el) {
        try {
            var context = {};
            var form = el.closest('form');
            if (form) {
                context.inForm = true;
                if (form.id) context.formId = form.id;
                if (form.name) context.formName = form.name;
                if (form.action) {
                    try {
                        var url = new URL(form.action);
                        context.formAction = url.pathname;
                    } catch (e2) {
                        context.formAction = form.action.split('?')[0];
                    }
                }
                if (form.method) context.formMethod = form.method.toUpperCase();
                
                // Count form fields
                var inputs = form.querySelectorAll('input, select, textarea');
                context.formFields = inputs.length;
                
                // Find submit button
                var submit = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submit) {
                    context.submitButton = getShortSelector(submit);
                }
            }
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // TABLE CONTEXT
    // ========================================
    function getTableContext(el) {
        try {
            var context = {};
            var cell = el.closest('td, th');
            if (cell) {
                var row = cell.closest('tr');
                var table = cell.closest('table');
                if (row && table) {
                    var rows = table.querySelectorAll('tr');
                    var cells = row.querySelectorAll('td, th');
                    context.inTable = true;
                    context.row = Array.prototype.indexOf.call(rows, row) + 1;
                    context.col = Array.prototype.indexOf.call(cells, cell) + 1;
                    context.totalRows = rows.length;
                    context.totalCols = cells.length;
                    context.isHeader = cell.tagName === 'TH';
                    
                    // Get column header if exists
                    var thead = table.querySelector('thead');
                    if (thead) {
                        var headerCells = thead.querySelectorAll('th');
                        var colIndex = Array.prototype.indexOf.call(cells, cell);
                        if (headerCells[colIndex]) {
                            context.columnHeader = getText(headerCells[colIndex]);
                        }
                    }
                }
            }
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // LIST CONTEXT
    // ========================================
    function getListContext(el) {
        try {
            var context = {};
            var listItem = el.closest('li');
            if (listItem) {
                var list = listItem.closest('ul, ol');
                if (list) {
                    // Get direct children only (avoid :scope for IE11 compat)
                    var allItems = list.querySelectorAll('li');
                    var items = [];
                    for (var i = 0; i < allItems.length; i++) {
                        if (allItems[i].parentElement === list) {
                            items.push(allItems[i]);
                        }
                    }
                    context.inList = true;
                    context.listType = list.tagName ? list.tagName.toLowerCase() : 'list';
                    context.position = arrayIndexOf(items, listItem) + 1;
                    context.totalItems = items.length;
                }
            }
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // LANDMARK/REGION CONTEXT
    // ========================================
    function getLandmarkContext(el) {
        try {
            var context = {};
            var landmarks = {
                'header': 'header',
                'nav': 'navigation', 
                'main': 'main',
                'aside': 'sidebar',
                'footer': 'footer',
                'section': 'section',
                'article': 'article',
                'form': 'form'
            };
            
            for (var tag in landmarks) {
                var ancestor = el.closest(tag);
                if (ancestor) {
                    context.landmark = landmarks[tag];
                    if (ancestor.getAttribute('aria-label')) {
                        context.landmarkLabel = ancestor.getAttribute('aria-label');
                    }
                    break;
                }
            }
            
            // Check for role-based landmarks
            var rolesMap = {
                'banner': 'header',
                'navigation': 'navigation',
                'main': 'main',
                'complementary': 'sidebar',
                'contentinfo': 'footer',
                'search': 'search',
                'dialog': 'dialog',
                'alertdialog': 'alert-dialog'
            };
            
            var current = el;
            while (current && current !== document.body) {
                var role = current.getAttribute('role');
                if (role && rolesMap[role]) {
                    context.landmark = rolesMap[role];
                    break;
                }
                current = current.parentElement;
            }
            
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // MODAL/DIALOG CONTEXT
    // ========================================
    function getModalContext(el) {
        try {
            var context = {};
            
            // Check for dialog/modal
            var dialog = el.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]');
            if (dialog) {
                context.inModal = true;
                if (dialog.id) context.modalId = dialog.id;
                if (dialog.getAttribute('aria-label')) {
                    context.modalTitle = dialog.getAttribute('aria-label');
                }
                var heading = dialog.querySelector('h1, h2, h3, [role="heading"]');
                if (heading) {
                    context.modalTitle = getText(heading);
                }
            }
            
            // Check for common modal class patterns
            var modalPatterns = el.closest('.modal, .dialog, .popup, .overlay, [class*="modal"], [class*="dialog"]');
            if (modalPatterns && !context.inModal) {
                context.inModal = true;
                context.modalType = 'css-based';
            }
            
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // SIBLING CONTEXT
    // ========================================
    function getSiblingContext(el) {
        try {
            var context = {};
            var parent = el.parentElement;
            if (!parent) return context;
            
            var siblings = [];
            var children = parent.children;
            for (var i = 0; i < children.length; i++) {
                if (children[i].nodeType === Node.ELEMENT_NODE) {
                    siblings.push(children[i]);
                }
            }
            
            var index = arrayIndexOf(siblings, el);
            context.siblingIndex = index + 1;
            context.totalSiblings = siblings.length;
            
            if (index > 0) {
                var prev = siblings[index - 1];
                context.prevSibling = getShortSelector(prev);
                var prevText = getText(prev);
                if (prevText) context.prevText = prevText;
            }
            
            if (index < siblings.length - 1) {
                var next = siblings[index + 1];
                context.nextSibling = getShortSelector(next);
                var nextText = getText(next);
                if (nextText) context.nextText = nextText;
            }
            
            return context;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // PARENT HIERARCHY
    // ========================================
    function getParentHierarchy(el) {
        try {
            var hierarchy = [];
            var current = el.parentElement;
            var depth = 0;
            var maxDepth = 5;
            
            while (current && current !== document.body && depth < maxDepth) {
                var info = getShortSelector(current);
                var role = current.getAttribute('role');
                if (role) info += '[role=' + role + ']';
                hierarchy.push(info);
                current = current.parentElement;
                depth++;
            }
            
            return hierarchy;
        } catch (e) {
            return [];
        }
    }

    // ========================================
    // PREDICTED ACTION
    // ========================================
    function getPredictedAction(el) {
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            var role = el.getAttribute('role');
            
            // Form submissions
            if (tag === 'button' && type === 'submit') return 'submit-form';
            if (tag === 'input' && type === 'submit') return 'submit-form';
            if (tag === 'form') return 'container-form';
            
            // Navigation - href can be SVGAnimatedString on SVG <a> elements
            var hrefStr = getSafeHref(el);
            if (tag === 'a' && hrefStr) {
                if (hrefStr.indexOf('#') !== -1) return 'scroll-to-anchor';
                if (el.target === '_blank') return 'open-new-tab';
                return 'navigate';
            }
            
            // Toggles
            if (el.getAttribute('aria-expanded') !== null) return 'toggle-expand';
            if (el.getAttribute('aria-pressed') !== null) return 'toggle-press';
            if (role === 'checkbox' || type === 'checkbox') return 'toggle-check';
            if (role === 'switch') return 'toggle-switch';
            if (role === 'radio' || type === 'radio') return 'select-option';
            
            // Inputs
            if (tag === 'input') {
                if (type === 'text' || type === 'email' || type === 'password' || type === 'search' || type === 'tel' || type === 'url') return 'text-input';
                if (type === 'number') return 'number-input';
                if (type === 'date' || type === 'datetime-local' || type === 'time') return 'date-input';
                if (type === 'file') return 'file-upload';
                if (type === 'range') return 'slider-input';
                if (type === 'color') return 'color-picker';
            }
            if (tag === 'textarea') return 'text-input';
            if (tag === 'select') return 'dropdown-select';
            
            // Media
            if (tag === 'video') return 'video-player';
            if (tag === 'audio') return 'audio-player';
            if (tag === 'img') return 'image';
            
            // Tabs
            if (role === 'tab') return 'switch-tab';
            if (role === 'tabpanel') return 'tab-content';
            
            // Menu
            if (role === 'menuitem') return 'menu-action';
            if (role === 'menu' || role === 'menubar') return 'menu-container';
            
            // Generic button
            if (tag === 'button' || role === 'button') return 'click-action';
            
            // Clickable div/span
            var cs = window.getComputedStyle(el);
            if (cs.cursor === 'pointer') return 'click-action';
            
            return null;
        } catch (e) {
            return null;
        }
    }

    // ========================================
    // LOADING/ERROR STATES
    // ========================================
    function getLoadingState(el) {
        var state = {};
        
        try {
            // Check for loading indicators
            var loadingPatterns = ['loading', 'spinner', 'skeleton', 'shimmer', 'pending'];
            // Handle SVG className (SVGAnimatedString) and regular className, with null safety
            var classStr = getSafeClassName(el);
            // Length limit to prevent performance issues
            if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
            var ariaLabel = el.getAttribute('aria-label') || '';
            // Sanitize aria-label
            if (ariaLabel.length > 200) ariaLabel = ariaLabel.substring(0, 200);
            var ariaBusy = el.getAttribute('aria-busy');
            
            var classLower = classStr.toLowerCase();
            var ariaLower = ariaLabel.toLowerCase();
            
            if (ariaBusy === 'true') {
                state.loading = true;
            }
            
            for (var i = 0; i < loadingPatterns.length; i++) {
                if (classLower.indexOf(loadingPatterns[i]) !== -1 ||
                    ariaLower.indexOf(loadingPatterns[i]) !== -1) {
                    state.loading = true;
                    state.loadingType = loadingPatterns[i];
                    break;
                }
            }
            
            // Check for error states
            var errorPatterns = ['error', 'invalid', 'danger', 'alert'];
            for (var j = 0; j < errorPatterns.length; j++) {
                if (classLower.indexOf(errorPatterns[j]) !== -1) {
                    state.hasError = true;
                    break;
                }
            }
            
            // Check aria-invalid
            if (el.getAttribute('aria-invalid') === 'true') {
                state.hasError = true;
            }
            
            // Find nearby error message
            var errorMsg = el.parentElement ? el.parentElement.querySelector('.error, .error-message, [role="alert"], .invalid-feedback') : null;
            if (errorMsg) {
                state.errorMessage = getText(errorMsg);
            }
        } catch (e) {
            // Silently fail - don't crash the host site
        }
        
        return state;
    }

    // ========================================
    // EXPECTED OUTCOMES (Generative)
    // ========================================
    function getExpectedOutcomes(el) {
        var expected = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            var role = el.getAttribute('role');
            
            // Determine outcome type based on element
            var form = el.closest('form');
            
            // Form submission outcomes
            if ((tag === 'button' && type === 'submit') || 
                (tag === 'input' && type === 'submit') ||
                (tag === 'button' && form && !type)) {
                expected.outcome = 'form-submit';
                if (form) {
                    var action = form.action || '';
                    try {
                        var url = new URL(action);
                        expected.target = url.pathname;
                    } catch (e) {
                        expected.target = action.split('?')[0] || window.location.pathname;
                    }
                    expected.method = (form.method || 'GET').toUpperCase();
                    
                    // Check if AJAX submission (common patterns)
                    var formClass = getSafeClassName(form);
                    var hasAjaxPattern = formClass.indexOf('ajax') !== -1 || 
                                        formClass.indexOf('remote') !== -1 ||
                                        form.getAttribute('data-remote') === 'true' ||
                                        form.getAttribute('data-ajax') === 'true';
                    expected.willNavigate = !hasAjaxPattern;
                    expected.isAjax = hasAjaxPattern;
                }
            }
            
            // Link navigation outcomes
            var href = getSafeHref(el);
            if (tag === 'a' && href) {
                var isExternal = false;
                var isAnchor = href.indexOf('#') !== -1 && href.indexOf(window.location.pathname + '#') !== -1;
                var isNewTab = el.target === '_blank';
                
                try {
                    var linkUrl = new URL(href);
                    isExternal = linkUrl.origin !== window.location.origin;
                } catch (e) {}
                
                if (isAnchor) {
                    expected.outcome = 'scroll-to-anchor';
                    expected.willNavigate = false;
                } else if (isNewTab) {
                    expected.outcome = 'open-new-tab';
                    expected.willNavigate = false;
                    expected.isExternal = isExternal;
                } else {
                    expected.outcome = 'navigate';
                    expected.willNavigate = true;
                    expected.isExternal = isExternal;
                }
            }
            
            // Modal/dialog triggers
            var ariaControls = el.getAttribute('aria-controls');
            var dataTarget = el.getAttribute('data-target') || el.getAttribute('data-bs-target');
            var dataToggle = el.getAttribute('data-toggle') || el.getAttribute('data-bs-toggle');
            
            if (dataToggle === 'modal' || dataToggle === 'dialog') {
                expected.outcome = 'open-modal';
                expected.willNavigate = false;
                if (dataTarget) expected.modalTarget = dataTarget;
            }
            
            if (ariaControls) {
                var controlledEl = document.getElementById(ariaControls);
                if (controlledEl) {
                    var controlledRole = controlledEl.getAttribute('role');
                    if (controlledRole === 'dialog' || controlledRole === 'alertdialog') {
                        expected.outcome = 'open-modal';
                        expected.modalTarget = '#' + ariaControls;
                    } else if (controlledRole === 'menu' || controlledRole === 'listbox') {
                        expected.outcome = 'open-dropdown';
                        expected.dropdownTarget = '#' + ariaControls;
                    } else if (controlledRole === 'tabpanel') {
                        expected.outcome = 'switch-tab';
                        expected.tabTarget = '#' + ariaControls;
                    }
                }
            }
            
            // Expand/collapse outcomes
            var ariaExpanded = el.getAttribute('aria-expanded');
            if (ariaExpanded !== null) {
                expected.outcome = ariaExpanded === 'true' ? 'collapse' : 'expand';
                expected.willNavigate = false;
                if (ariaControls) expected.toggleTarget = '#' + ariaControls;
            }
            
            // Toggle outcomes
            var ariaPressed = el.getAttribute('aria-pressed');
            if (ariaPressed !== null) {
                expected.outcome = ariaPressed === 'true' ? 'deactivate' : 'activate';
            }
            
            // Checkbox/radio outcomes
            if (type === 'checkbox' || role === 'checkbox') {
                expected.outcome = el.checked ? 'uncheck' : 'check';
            }
            if (type === 'radio' || role === 'radio') {
                expected.outcome = 'select-option';
            }
            
            // Find related loader/spinner
            var parent = el.parentElement;
            if (parent) {
                var loader = parent.querySelector('.spinner, .loader, .loading, [class*="spin"], [class*="load"]');
                if (loader) {
                    expected.willShowLoader = true;
                    expected.loaderElement = getShortSelector(loader);
                }
                
                // Find success/error containers
                var successEl = parent.querySelector('.success, .success-message, [class*="success"]');
                var errorEl = parent.querySelector('.error, .error-message, [role="alert"], [class*="error"]');
                if (successEl) expected.successElement = getShortSelector(successEl);
                if (errorEl) expected.errorElement = getShortSelector(errorEl);
            }
            
            // Confirmation detection
            var dataConfirm = el.getAttribute('data-confirm') || el.getAttribute('data-confirmation');
            if (dataConfirm) {
                expected.requiresConfirmation = true;
                expected.confirmMessage = dataConfirm;
            }
            
        } catch (e) {
            // Silently fail
        }
        
        return expected;
    }

    // ========================================
    // INTERACTION HINTS (Generative)
    // ========================================
    function getInteractionHints(el) {
        var hints = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            var role = el.getAttribute('role');
            var cs = window.getComputedStyle(el);
            
            // Clickability
            hints.clickable = cs.cursor === 'pointer' || 
                             tag === 'button' || 
                             tag === 'a' || 
                             role === 'button' || 
                             role === 'link' ||
                             el.onclick !== null ||
                             el.tabIndex >= 0;
            
            // Click method
            if (hints.clickable) {
                hints.clickMethod = 'left-click';
                if (tag === 'a' && el.target === '_blank') {
                    hints.altClickMethod = 'middle-click opens in new tab';
                }
            }
            
            // Keyboard shortcuts
            var accessKey = el.accessKey;
            if (accessKey) {
                hints.accessKey = accessKey;
            }
            
            if (tag === 'button' && type === 'submit') {
                hints.keyboard = 'Enter (when form focused)';
            } else if (tag === 'a' || role === 'button' || role === 'link') {
                hints.keyboard = 'Enter or Space';
            } else if (type === 'checkbox' || role === 'checkbox') {
                hints.keyboard = 'Space to toggle';
            } else if (role === 'tab') {
                hints.keyboard = 'Arrow keys to navigate tabs';
            } else if (role === 'menuitem') {
                hints.keyboard = 'Arrow keys, Enter to select';
            } else if (role === 'slider' || type === 'range') {
                hints.keyboard = 'Arrow keys to adjust';
            }
            
            // Input type hints
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                hints.inputType = type || 'text';
                
                // Input format detection
                var inputMode = el.inputMode || '';
                var autocomplete = el.autocomplete || '';
                var name = (el.name || '').toLowerCase();
                var id = (el.id || '').toLowerCase();
                var placeholder = (el.placeholder || '').toLowerCase();
                
                if (type === 'email' || autocomplete === 'email' || name.indexOf('email') !== -1) {
                    hints.inputFormat = 'email';
                } else if (type === 'tel' || autocomplete === 'tel' || name.indexOf('phone') !== -1) {
                    hints.inputFormat = 'phone';
                } else if (type === 'url' || name.indexOf('url') !== -1 || name.indexOf('website') !== -1) {
                    hints.inputFormat = 'url';
                } else if (type === 'date' || type === 'datetime-local') {
                    hints.inputFormat = 'date';
                } else if (type === 'number' || inputMode === 'numeric') {
                    hints.inputFormat = 'number';
                } else if (autocomplete.indexOf('cc-') === 0 || name.indexOf('card') !== -1 || name.indexOf('credit') !== -1) {
                    hints.inputFormat = 'credit-card';
                } else if (name.indexOf('zip') !== -1 || name.indexOf('postal') !== -1) {
                    hints.inputFormat = 'postal-code';
                } else if (type === 'password') {
                    hints.inputFormat = 'password';
                } else {
                    hints.inputFormat = 'free-text';
                }
            }
            
            // Drag and drop
            if (el.draggable === true) {
                hints.draggable = true;
                hints.dragMethod = 'click and drag';
            }
            
            // Drop zone detection
            var classStr = getSafeClassName(el);
            if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
            if (classStr.indexOf('drop') !== -1 || classStr.indexOf('upload') !== -1) {
                hints.dropZone = true;
            }
            
            // Resizable
            if (cs.resize && cs.resize !== 'none') {
                hints.resizable = true;
                hints.resizeDirection = cs.resize;
            }
            
            // Scrollable
            if (cs.overflow === 'auto' || cs.overflow === 'scroll' ||
                cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
                hints.scrollable = true;
            }
            
            // Form dependency
            var form = el.closest('form');
            if (form && (tag === 'button' && type === 'submit')) {
                var requiredFields = form.querySelectorAll('[required], [aria-required="true"]');
                if (requiredFields.length > 0) {
                    hints.requiresFormValid = true;
                    var deps = [];
                    for (var i = 0; i < requiredFields.length && i < 5; i++) {
                        deps.push(getShortSelector(requiredFields[i]));
                    }
                    hints.dependsOn = deps;
                }
            }
            
        } catch (e) {
            // Silently fail
        }
        
        return hints;
    }

    // ========================================
    // ELEMENT RELATIONSHIPS (Generative)
    // ========================================
    function getElementRelationships(el) {
        var relationships = {};
        
        try {
            // aria-controls
            var controls = el.getAttribute('aria-controls');
            if (controls) {
                var controlIds = controls.split(/\s+/);
                relationships.controls = [];
                for (var i = 0; i < controlIds.length; i++) {
                    relationships.controls.push('#' + controlIds[i]);
                }
            }
            
            // aria-owns
            var owns = el.getAttribute('aria-owns');
            if (owns) {
                relationships.owns = '#' + owns;
            }
            
            // aria-flowto
            var flowto = el.getAttribute('aria-flowto');
            if (flowto) {
                relationships.flowsTo = '#' + flowto;
            }
            
            // Label associations
            if (el.id) {
                var label = document.querySelector('label[for="' + el.id + '"]');
                if (label) {
                    relationships.labelledBy = getShortSelector(label);
                }
            }
            
            // aria-labelledby
            var labelledBy = el.getAttribute('aria-labelledby');
            if (labelledBy) {
                relationships.labelledBy = '#' + labelledBy;
            }
            
            // aria-describedby
            var describedBy = el.getAttribute('aria-describedby');
            if (describedBy) {
                relationships.describedBy = '#' + describedBy;
                var descEl = document.getElementById(describedBy);
                if (descEl) {
                    relationships.description = getText(descEl);
                }
            }
            
            // Find error display for inputs
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                var parent = el.parentElement;
                if (parent) {
                    var errorEl = parent.querySelector('.error, .error-message, .invalid-feedback, [class*="error"]');
                    if (errorEl) {
                        relationships.errorDisplay = getShortSelector(errorEl);
                    }
                    var helpEl = parent.querySelector('.help, .help-text, .form-text, [class*="help"]');
                    if (helpEl) {
                        relationships.helpText = getShortSelector(helpEl);
                    }
                }
            }
            
            // Toggle target (for buttons with data-target)
            var dataTarget = el.getAttribute('data-target') || el.getAttribute('data-bs-target') || el.getAttribute('href');
            if (dataTarget && dataTarget.indexOf('#') === 0) {
                relationships.toggleTarget = dataTarget;
            }
            
            // Tab panel relationship
            if (el.getAttribute('role') === 'tab') {
                var tabControls = el.getAttribute('aria-controls');
                if (tabControls) {
                    relationships.tabPanel = '#' + tabControls;
                }
            }
            
            // Find related buttons (siblings that are also buttons)
            var parent = el.parentElement;
            if (parent && (tag === 'button' || el.getAttribute('role') === 'button')) {
                var siblingButtons = parent.querySelectorAll('button, [role="button"]');
                var related = [];
                for (var j = 0; j < siblingButtons.length && j < 5; j++) {
                    if (siblingButtons[j] !== el) {
                        related.push(getShortSelector(siblingButtons[j]));
                    }
                }
                if (related.length > 0) {
                    relationships.relatedButtons = related;
                }
            }
            
            // Form relationship
            var form = el.closest('form');
            if (form) {
                relationships.form = form.id ? '#' + form.id : getShortSelector(form);
            }
            
        } catch (e) {
            // Silently fail
        }
        
        return relationships;
    }

    // ========================================
    // WORKFLOW CONTEXT (Generative)
    // ========================================
    function getWorkflowContext(el) {
        var workflow = {};
        
        try {
            // Look for wizard/stepper patterns in ancestors
            var wizardPatterns = ['wizard', 'stepper', 'steps', 'multi-step', 'checkout', 'onboarding'];
            var current = el;
            var wizardContainer = null;
            
            while (current && current !== document.body) {
                var classStr = typeof current.className === 'string' ? current.className : 
                              (current.className && current.className.baseVal) ? current.className.baseVal : '';
                var classLower = classStr.toLowerCase();
                
                for (var i = 0; i < wizardPatterns.length; i++) {
                    if (classLower.indexOf(wizardPatterns[i]) !== -1) {
                        wizardContainer = current;
                        workflow.inWizard = true;
                        workflow.wizardType = wizardPatterns[i];
                        break;
                    }
                }
                if (wizardContainer) break;
                current = current.parentElement;
            }
            
            if (wizardContainer) {
                // Find step indicators
                var stepIndicators = wizardContainer.querySelectorAll('[class*="step"], [role="tab"], .nav-item, .breadcrumb-item');
                if (stepIndicators.length > 1) {
                    workflow.totalSteps = stepIndicators.length;
                    
                    // Find current step
                    for (var j = 0; j < stepIndicators.length; j++) {
                        var stepClass = typeof stepIndicators[j].className === 'string' ? stepIndicators[j].className : '';
                        var isActive = stepClass.indexOf('active') !== -1 || 
                                      stepClass.indexOf('current') !== -1 ||
                                      stepIndicators[j].getAttribute('aria-selected') === 'true' ||
                                      stepIndicators[j].getAttribute('aria-current') === 'step';
                        if (isActive) {
                            workflow.currentStep = j + 1;
                            var stepText = getText(stepIndicators[j]);
                            if (stepText) workflow.stepName = stepText;
                            break;
                        }
                    }
                }
                
                // Find prev/next buttons
                var prevBtn = wizardContainer.querySelector('[class*="prev"], [class*="back"], button:contains("Back"), button:contains("Previous")');
                var nextBtn = wizardContainer.querySelector('[class*="next"], [class*="continue"], button:contains("Next"), button:contains("Continue")');
                
                // Fallback: look for buttons with common text
                var allButtons = wizardContainer.querySelectorAll('button, [role="button"], a.btn');
                for (var k = 0; k < allButtons.length; k++) {
                    var btnText = getText(allButtons[k]).toLowerCase();
                    if (!prevBtn && (btnText.indexOf('back') !== -1 || btnText.indexOf('prev') !== -1)) {
                        prevBtn = allButtons[k];
                    }
                    if (!nextBtn && (btnText.indexOf('next') !== -1 || btnText.indexOf('continue') !== -1 || btnText.indexOf('proceed') !== -1)) {
                        nextBtn = allButtons[k];
                    }
                }
                
                if (prevBtn) {
                    workflow.prevStep = getShortSelector(prevBtn);
                    workflow.canGoBack = !prevBtn.disabled;
                }
                if (nextBtn) {
                    workflow.nextStep = getShortSelector(nextBtn);
                }
                
                // Progress bar detection
                var progressBar = wizardContainer.querySelector('[role="progressbar"], .progress-bar, progress, [class*="progress"]');
                if (progressBar) {
                    var progressValue = progressBar.getAttribute('aria-valuenow') || 
                                       progressBar.value || 
                                       progressBar.style.width;
                    if (progressValue) {
                        workflow.progressPercent = parseInt(progressValue, 10);
                    }
                }
            }
            
            // Check for "Step X of Y" text patterns
            var bodyText = document.body.innerText || '';
            var stepMatch = bodyText.match(/step\s+(\d+)\s+(?:of|\/)\s+(\d+)/i);
            if (stepMatch && !workflow.currentStep) {
                workflow.currentStep = parseInt(stepMatch[1], 10);
                workflow.totalSteps = parseInt(stepMatch[2], 10);
            }
            
        } catch (e) {
            // Silently fail
        }
        
        return workflow;
    }

    // ========================================
    // VALIDATION EXPECTATIONS (Generative)
    // ========================================
    function getValidationExpectations(el) {
        var validation = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            
            if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
                return validation;
            }
            
            // Required
            if (el.required || el.getAttribute('aria-required') === 'true') {
                validation.required = true;
            }
            
            // Format based on type
            var type = getSafeType(el) || 'text';
            if (type === 'email') validation.format = 'email';
            else if (type === 'url') validation.format = 'url';
            else if (type === 'tel') validation.format = 'phone';
            else if (type === 'number') validation.format = 'number';
            else if (type === 'date') validation.format = 'date';
            
            // Length constraints
            if (el.minLength > 0) validation.minLength = el.minLength;
            if (el.maxLength > 0 && el.maxLength < 524288) validation.maxLength = el.maxLength;
            
            // Value constraints
            if (el.min) validation.min = el.min;
            if (el.max) validation.max = el.max;
            if (el.step) validation.step = el.step;
            
            // Pattern
            if (el.pattern) {
                validation.pattern = el.pattern;
                validation.hasPatternValidation = true;
            }
            
            // Custom validation (check for common validation library attributes)
            var hasCustom = el.getAttribute('data-validate') || 
                           el.getAttribute('data-validation') ||
                           el.getAttribute('data-parsley-type') ||
                           el.getAttribute('data-vv-rules');
            if (hasCustom) {
                validation.customValidation = true;
            }
            
            // Current validity state
            if (el.validity) {
                validation.currentlyValid = el.validity.valid;
                if (!el.validity.valid) {
                    if (el.validity.valueMissing) validation.error = 'required';
                    else if (el.validity.typeMismatch) validation.error = 'format';
                    else if (el.validity.patternMismatch) validation.error = 'pattern';
                    else if (el.validity.tooShort) validation.error = 'too-short';
                    else if (el.validity.tooLong) validation.error = 'too-long';
                    else if (el.validity.rangeUnderflow) validation.error = 'below-min';
                    else if (el.validity.rangeOverflow) validation.error = 'above-max';
                }
            }
            
            // Find where error will display
            var parent = el.parentElement;
            if (parent) {
                var errorEl = parent.querySelector('.error, .error-message, .invalid-feedback, [class*="error"]');
                if (errorEl) {
                    validation.errorLocation = getShortSelector(errorEl);
                }
            }
            
            // Live validation detection
            var hasBlurHandler = el.onblur !== null;
            var hasInputHandler = el.oninput !== null;
            var hasChangeHandler = el.onchange !== null;
            if (hasBlurHandler || hasInputHandler || hasChangeHandler) {
                validation.liveValidation = true;
            }
            
        } catch (e) {
            // Silently fail
        }
        
        return validation;
    }

    // ========================================
    // DATA BINDING (reactive framework detection)
    // ========================================
    function getDataBinding(el) {
        var binding = {};
        
        try {
            // Vue.js bindings
            var vModel = el.getAttribute('v-model');
            var vBind = el.getAttribute('v-bind') || el.getAttribute(':value');
            if (vModel) binding.vueModel = vModel;
            if (vBind) binding.vueBind = vBind;
            
            // Angular bindings
            var ngModel = el.getAttribute('ng-model') || el.getAttribute('[(ngModel)]');
            var ngBind = el.getAttribute('ng-bind') || el.getAttribute('[value]');
            if (ngModel) binding.angularModel = ngModel;
            if (ngBind) binding.angularBind = ngBind;
            
            // React patterns (data attributes commonly used)
            var reactKey = el.getAttribute('data-reactid') || el.getAttribute('data-react-checksum');
            if (reactKey) binding.reactManaged = true;
            
            // Alpine.js
            var xModel = el.getAttribute('x-model');
            var xBind = el.getAttribute('x-bind:value');
            if (xModel) binding.alpineModel = xModel;
            if (xBind) binding.alpineBind = xBind;
            
            // Generic data binding attributes
            var dataBind = el.getAttribute('data-bind'); // Knockout.js
            if (dataBind) binding.knockoutBind = dataBind;
            
            // Check for __vue__ or __reactFiber (runtime detection)
            if (el.__vue__) binding.vueInstance = true;
            if (el._reactRootContainer || el.__reactFiber$) binding.reactRoot = true;
            
        } catch (e) {}
        
        return binding;
    }

    // ========================================
    // TIMING CONTEXT (delays, animations, transitions)
    // ========================================
    function getTimingContext(el) {
        var timing = {};
        
        try {
            var cs = window.getComputedStyle(el);
            
            // CSS Transitions
            var transition = cs.transition || cs.webkitTransition;
            if (transition && transition !== 'none' && transition !== 'all 0s ease 0s') {
                timing.hasTransition = true;
                // Extract duration
                var match = transition.match(/(\d+\.?\d*)(s|ms)/);
                if (match) {
                    var duration = parseFloat(match[1]);
                    if (match[2] === 's') duration *= 1000;
                    timing.transitionMs = duration;
                }
            }
            
            // CSS Animations
            var animation = cs.animation || cs.webkitAnimation;
            if (animation && animation !== 'none') {
                timing.hasAnimation = true;
                var animMatch = animation.match(/(\d+\.?\d*)(s|ms)/);
                if (animMatch) {
                    var animDuration = parseFloat(animMatch[1]);
                    if (animMatch[2] === 's') animDuration *= 1000;
                    timing.animationMs = animDuration;
                }
            }
            
            // Debounce/throttle hints from data attributes
            var debounce = el.getAttribute('data-debounce') || el.getAttribute('debounce');
            var throttle = el.getAttribute('data-throttle') || el.getAttribute('throttle');
            if (debounce) timing.debounceMs = parseInt(debounce, 10);
            if (throttle) timing.throttleMs = parseInt(throttle, 10);
            
            // Loading delay hints
            var delay = el.getAttribute('data-delay') || el.getAttribute('data-loading-delay');
            if (delay) timing.delayMs = parseInt(delay, 10);
            
        } catch (e) {}
        
        return timing;
    }

    // ========================================
    // ERROR STATE (current error display)
    // ========================================
    function getErrorState(el) {
        var errorState = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            
            // Check validity state for inputs
            if (el.validity && !el.validity.valid) {
                errorState.hasError = true;
                if (el.validity.valueMissing) errorState.errorType = 'required';
                else if (el.validity.typeMismatch) errorState.errorType = 'format';
                else if (el.validity.patternMismatch) errorState.errorType = 'pattern';
                else if (el.validity.tooShort) errorState.errorType = 'too-short';
                else if (el.validity.tooLong) errorState.errorType = 'too-long';
                else if (el.validity.rangeUnderflow) errorState.errorType = 'below-min';
                else if (el.validity.rangeOverflow) errorState.errorType = 'above-max';
                
                if (el.validationMessage) {
                    errorState.message = el.validationMessage;
                }
            }
            
            // Check for error classes
            var classStr = getSafeClassName(el);
            if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
            var classLower = classStr.toLowerCase();
            if (classLower.indexOf('error') !== -1 || classLower.indexOf('invalid') !== -1) {
                errorState.hasErrorClass = true;
            }
            
            // Check aria-invalid
            if (el.getAttribute('aria-invalid') === 'true') {
                errorState.ariaInvalid = true;
            }
            
            // Find associated error message
            var describedBy = el.getAttribute('aria-describedby');
            if (describedBy && errorState.hasError) {
                var errorEl = document.getElementById(describedBy);
                if (errorEl) {
                    var errorText = getText(errorEl);
                    if (errorText) errorState.errorMessage = errorText;
                }
            }
            
        } catch (e) {}
        
        return errorState;
    }

    // ========================================
    // PERMISSION REQUIREMENTS (what's needed to interact)
    // ========================================
    function getPermissionRequirements(el) {
        var perms = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            
            // File inputs may need file system access
            if (tag === 'input' && type === 'file') {
                perms.requiresFileAccess = true;
                var accept = el.getAttribute('accept');
                if (accept) perms.acceptedTypes = accept;
                if (el.multiple) perms.multipleFiles = true;
            }
            
            // Camera/microphone
            if (el.getAttribute('capture')) {
                var capture = el.getAttribute('capture');
                if (capture === 'user' || capture === 'environment') {
                    perms.requiresCamera = true;
                }
            }
            
            // Geolocation hints
            var onclick = el.getAttribute('onclick') || '';
            // Limit onclick length to prevent ReDoS
            if (onclick.length > 1000) onclick = onclick.substring(0, 1000);
            var classStr = getSafeClassName(el);
            if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
            if (onclick.indexOf('geolocation') !== -1 || 
                classStr.indexOf('location') !== -1 ||
                classStr.indexOf('gps') !== -1) {
                perms.mayRequireLocation = true;
            }
            
            // Clipboard
            if (onclick.indexOf('clipboard') !== -1 || 
                onclick.indexOf('copy') !== -1 ||
                classStr.indexOf('copy') !== -1) {
                perms.mayRequireClipboard = true;
            }
            
            // Notifications
            if (onclick.indexOf('Notification') !== -1 ||
                classStr.indexOf('notification') !== -1 ||
                classStr.indexOf('subscribe') !== -1) {
                perms.mayRequireNotifications = true;
            }
            
        } catch (e) {}
        
        return perms;
    }

    // ========================================
    // ASYNC BEHAVIOR (loading patterns)
    // ========================================
    function getAsyncBehavior(el) {
        var async = {};
        
        try {
            var classStr = getSafeClassName(el);
            if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
            var classLower = classStr.toLowerCase();
            
            // Check for async/ajax indicators
            var dataRemote = el.getAttribute('data-remote');
            var dataAsync = el.getAttribute('data-async');
            var dataAjax = el.getAttribute('data-ajax');
            
            if (dataRemote === 'true' || dataAsync === 'true' || dataAjax === 'true') {
                async.isAsync = true;
            }
            
            // Loading state indicators
            if (classLower.indexOf('loading') !== -1) async.currentlyLoading = true;
            if (classLower.indexOf('pending') !== -1) async.isPending = true;
            
            // Lazy loading
            var loading = el.getAttribute('loading');
            if (loading === 'lazy') async.lazyLoaded = true;
            
            // Infinite scroll hints
            if (classLower.indexOf('infinite') !== -1 || 
                classLower.indexOf('load-more') !== -1 ||
                el.getAttribute('data-infinite-scroll')) {
                async.infiniteScroll = true;
            }
            
            // Pagination
            if (classLower.indexOf('pagination') !== -1 ||
                classLower.indexOf('paginate') !== -1 ||
                el.getAttribute('data-page')) {
                async.pagination = true;
                var page = el.getAttribute('data-page');
                if (page) async.currentPage = parseInt(page, 10);
            }
            
            // Polling/refresh
            var refresh = el.getAttribute('data-refresh') || el.getAttribute('data-poll');
            if (refresh) {
                async.autoRefresh = true;
                async.refreshInterval = parseInt(refresh, 10);
            }
            
        } catch (e) {}
        
        return async;
    }

    // ========================================
    // KEYBOARD SHORTCUTS (accelerators)
    // ========================================
    function getKeyboardShortcuts(el) {
        var shortcuts = {};
        
        try {
            // Access key
            if (el.accessKey) {
                shortcuts.accessKey = el.accessKey;
                // Platform-specific modifier
                var isMac = navigator.platform.indexOf('Mac') !== -1;
                shortcuts.shortcut = (isMac ? 'Ctrl+Option+' : 'Alt+') + el.accessKey;
            }
            
            // Data attributes for shortcuts
            var hotkey = el.getAttribute('data-hotkey') || 
                        el.getAttribute('data-shortcut') ||
                        el.getAttribute('data-keyboard-shortcut');
            if (hotkey) shortcuts.hotkey = hotkey;
            
            // Common implicit shortcuts
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            
            if (tag === 'button' && type === 'submit') {
                shortcuts.implicit = 'Enter (when form focused)';
            }
            if (tag === 'a') {
                shortcuts.implicit = 'Enter (when focused)';
            }
            if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                shortcuts.implicit = 'Space (when focused)';
            }
            if (tag === 'select') {
                shortcuts.implicit = 'Space/Arrow keys (when focused)';
            }
            
            // Escape key handling
            var role = el.getAttribute('role');
            if (role === 'dialog' || role === 'alertdialog' || role === 'menu') {
                shortcuts.escape = 'Escape closes';
            }
            
        } catch (e) {}
        
        return shortcuts;
    }

    // ========================================
    // CONTENT TYPE (what kind of content)
    // ========================================
    function getContentType(el) {
        var content = {};
        
        try {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var type = getSafeType(el);
            var role = el.getAttribute('role');
            
            // Media type
            if (tag === 'img') {
                content.type = 'image';
                if (el.alt) content.hasAlt = true;
                if (el.src && typeof el.src === 'string') {
                    var src = el.src.toLowerCase();
                    if (src.indexOf('.svg') !== -1) content.format = 'svg';
                    else if (src.indexOf('.gif') !== -1) content.format = 'gif';
                    else if (src.indexOf('.png') !== -1) content.format = 'png';
                    else if (src.indexOf('.jpg') !== -1 || src.indexOf('.jpeg') !== -1) content.format = 'jpeg';
                    else if (src.indexOf('.webp') !== -1) content.format = 'webp';
                }
            }
            if (tag === 'video') {
                content.type = 'video';
                if (el.controls) content.hasControls = true;
                if (el.autoplay) content.autoplay = true;
            }
            if (tag === 'audio') {
                content.type = 'audio';
                if (el.controls) content.hasControls = true;
            }
            if (tag === 'iframe') {
                content.type = 'embedded';
                var src = el.src || '';
                if (src.indexOf('youtube') !== -1) content.source = 'youtube';
                else if (src.indexOf('vimeo') !== -1) content.source = 'vimeo';
                else if (src.indexOf('maps.google') !== -1) content.source = 'google-maps';
            }
            if (tag === 'canvas') {
                content.type = 'canvas';
            }
            if (tag === 'svg') {
                content.type = 'svg';
            }
            
            // Text content type
            if (tag === 'p' || tag === 'span' || tag === 'div') {
                var text = getText(el);
                if (text.length > 200) content.type = 'long-text';
                else if (text.length > 0) content.type = 'text';
            }
            if (tag === 'code' || tag === 'pre') {
                content.type = 'code';
            }
            if (tag === 'blockquote') {
                content.type = 'quote';
            }
            
            // Editable content
            if (el.contentEditable === 'true' || el.isContentEditable) {
                content.editable = true;
            }
            
        } catch (e) {}
        
        return content;
    }

    // ========================================
    // VISIBILITY DETAILS
    // ========================================
    function getVisibilityDetails(el) {
        try {
            var details = {};
            var rect = el.getBoundingClientRect();
            
            // Viewport visibility
            var fullyVisible = rect.top >= 0 && rect.left >= 0 && 
                              rect.bottom <= vh && rect.right <= vw;
            var partiallyVisible = rect.top < vh && rect.bottom > 0 && 
                                   rect.left < vw && rect.right > 0;
            
            if (fullyVisible) {
                details.visibility = 'fully-visible';
            } else if (partiallyVisible) {
                details.visibility = 'partially-visible';
                if (rect.top < 0) details.clipped = 'top';
                else if (rect.bottom > vh) details.clipped = 'bottom';
                else if (rect.left < 0) details.clipped = 'left';
                else if (rect.right > vw) details.clipped = 'right';
            } else {
                details.visibility = 'off-screen';
                if (rect.bottom < 0) details.direction = 'above';
                else if (rect.top > vh) details.direction = 'below';
                else if (rect.right < 0) details.direction = 'left';
                else if (rect.left > vw) details.direction = 'right';
            }
            
            return details;
        } catch (e) {
            return {};
        }
    }

    // ========================================
    // ELEMENT COLLECTION
    // ========================================
    function getElementsInRect(rect) {
        var elements = [];
        var seen = new SimpleSet();
        var step = 8; // Finer granularity

        // Polyfill for elementsFromPoint (IE11 fallback to elementFromPoint)
        var getElementsAtPoint = document.elementsFromPoint ? 
            function(x, y) { return document.elementsFromPoint(x, y); } :
            function(x, y) { 
                var el = document.elementFromPoint(x, y);
                return el ? [el] : [];
            };

        for (var x = rect.left; x <= rect.right; x += step) {
            for (var y = rect.top; y <= rect.bottom; y += step) {
                var elsAtPoint = getElementsAtPoint(x, y);
                for (var j = 0; j < elsAtPoint.length; j++) {
                    var el = elsAtPoint[j];
                    if (el === overlay || el === box || el === document.body || el === document.documentElement) continue;
                    if (seen.has(el)) continue;
                    seen.add(el);

                    var elRect = el.getBoundingClientRect();
                    var overlapLeft = Math.max(rect.left, elRect.left);
                    var overlapRight = Math.min(rect.right, elRect.right);
                    var overlapTop = Math.max(rect.top, elRect.top);
                    var overlapBottom = Math.min(rect.bottom, elRect.bottom);

                    if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
                        var overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
                        var elArea = elRect.width * elRect.height;
                        var coverage = elArea > 0 ? overlapArea / elArea : 0;

                        if (coverage > 0.2) {
                            elements.push({
                                el: el,
                                rect: elRect,
                                area: elArea,
                                coverage: coverage
                            });
                        }
                    }
                }
            }
        }

        // Sort by area (smallest first = most specific)
        elements.sort(function(a, b) { return a.area - b.area; });
        return elements;
    }

    // ========================================
    // FORMAT OBJECT AS LINES
    // ========================================
    function formatObject(obj, prefix) {
        prefix = prefix || '';
        var lines = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var val = obj[key];
                if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                    lines.push(prefix + key + ':');
                    lines = lines.concat(formatObject(val, prefix + '  '));
                } else if (Array.isArray(val)) {
                    lines.push(prefix + key + ': ' + val.join(', '));
                } else {
                    lines.push(prefix + key + ': ' + val);
                }
            }
        }
        return lines;
    }

    // ========================================
    // BUILD OUTPUT
    // ========================================
    function buildOutput(rect, elements) {
        var NL = String.fromCharCode(10);
        var lines = [];
        var divider = '+' + new Array(66).join('-');

        // Header
        lines.push(divider);
        lines.push('| DOM EXTRACT');
        lines.push('| url: ' + window.location.origin + window.location.pathname);
        lines.push('| viewport: ' + vw + 'x' + vh + '  scroll: ' + scrollX + ',' + scrollY);
        lines.push(divider);

        // Selection info
        var selLeft = rect.left.toFixed(0);
        var selTop = rect.top.toFixed(0);
        var selWidth = (rect.right - rect.left).toFixed(0);
        var selHeight = (rect.bottom - rect.top).toFixed(0);
        var leftPct = vw > 0 ? (rect.left / vw * 100).toFixed(1) : '0';
        var topPct = vh > 0 ? (rect.top / vh * 100).toFixed(1) : '0';

        lines.push('| SELECTION');
        lines.push('| region: ' + getRegionName(parseFloat(leftPct), parseFloat(topPct)));
        lines.push('| position: ' + leftPct + '%, ' + topPct + '%');
        lines.push('| pixels: ' + selLeft + ',' + selTop + ' -> ' + (parseInt(selLeft) + parseInt(selWidth)) + ',' + (parseInt(selTop) + parseInt(selHeight)) + ' (' + selWidth + 'x' + selHeight + ')');
        lines.push(divider);

        if (elements.length === 0) {
            lines.push('| No elements found in selection');
            lines.push(divider);
            return lines.join(NL);
        }

        // Primary element (smallest/most specific)
        var primary = elements[0];
        var el = primary.el;

        lines.push('| PRIMARY ELEMENT');
        lines.push('| tag: ' + getShortSelector(el));
        var text = getText(el);
        if (text) lines.push('| text: "' + text + '"');
        lines.push('| selector: ' + getUniqueSelector(el));

        // Position
        var posInfo = getPositionInfo(el);
        lines.push('|--- position');
        lines.push('|    viewport: ' + posInfo.viewport.left + ',' + posInfo.viewport.top + ' (' + posInfo.viewport.width + 'x' + posInfo.viewport.height + ')');
        if (posInfo.inParent) {
            lines.push('|    in-parent: ' + posInfo.inParent.leftPct + '%, ' + posInfo.inParent.topPct + '% of ' + posInfo.inParent.selector);
        }

        // Visual
        var visual = getVisualInfo(el);
        if (Object.keys(visual).length > 0) {
            lines.push('|--- visual');
            var visualLines = formatObject(visual, '|    ');
            lines = lines.concat(visualLines);
        }

        // Design
        var design = getDesignInfo(el);
        if (Object.keys(design).length > 0) {
            lines.push('|--- design');
            var designLines = formatObject(design, '|    ');
            lines = lines.concat(designLines);
        }

        // Semantic
        var semantic = getSemanticInfo(el);
        if (Object.keys(semantic).length > 0) {
            lines.push('|--- semantic');
            var semanticLines = formatObject(semantic, '|    ');
            lines = lines.concat(semanticLines);
        }

        // State
        var state = getInteractiveState(el);
        if (Object.keys(state).length > 0) {
            lines.push('|--- state');
            var stateLines = formatObject(state, '|    ');
            lines = lines.concat(stateLines);
        }

        // Constraints (for inputs)
        var constraints = getInputConstraints(el);
        if (Object.keys(constraints).length > 0) {
            lines.push('|--- constraints');
            var constraintLines = formatObject(constraints, '|    ');
            lines = lines.concat(constraintLines);
        }

        // Interactive
        var interactive = hasInteractivity(el);
        if (interactive.length > 0) {
            lines.push('|--- interactive: ' + interactive.join(', '));
        }

        // Scroll
        var scroll = getScrollContext(el);
        if (scroll.scrollParent) {
            lines.push('|--- scroll');
            lines.push('|    parent: ' + scroll.scrollParent);
            lines.push('|    position: ' + scroll.scrollTop + '/' + scroll.scrollHeight);
        }

        // Pseudo content
        var pseudo = getPseudoContent(el);
        if (Object.keys(pseudo).length > 0) {
            lines.push('|--- pseudo');
            if (pseudo.before) lines.push('|    before: "' + pseudo.before + '"');
            if (pseudo.after) lines.push('|    after: "' + pseudo.after + '"');
        }

        // Form context
        var formCtx = getFormContext(el);
        if (Object.keys(formCtx).length > 0) {
            lines.push('|--- form');
            var formLines = formatObject(formCtx, '|    ');
            lines = lines.concat(formLines);
        }

        // Table context
        var tableCtx = getTableContext(el);
        if (Object.keys(tableCtx).length > 0) {
            lines.push('|--- table');
            var tableLines = formatObject(tableCtx, '|    ');
            lines = lines.concat(tableLines);
        }

        // List context
        var listCtx = getListContext(el);
        if (Object.keys(listCtx).length > 0) {
            lines.push('|--- list');
            var listLines = formatObject(listCtx, '|    ');
            lines = lines.concat(listLines);
        }

        // Landmark context
        var landmarkCtx = getLandmarkContext(el);
        if (Object.keys(landmarkCtx).length > 0) {
            lines.push('|--- landmark');
            var landmarkLines = formatObject(landmarkCtx, '|    ');
            lines = lines.concat(landmarkLines);
        }

        // Modal context
        var modalCtx = getModalContext(el);
        if (Object.keys(modalCtx).length > 0) {
            lines.push('|--- modal');
            var modalLines = formatObject(modalCtx, '|    ');
            lines = lines.concat(modalLines);
        }

        // Sibling context
        var siblingCtx = getSiblingContext(el);
        if (Object.keys(siblingCtx).length > 0) {
            lines.push('|--- siblings');
            var siblingLines = formatObject(siblingCtx, '|    ');
            lines = lines.concat(siblingLines);
        }

        // Parent hierarchy
        var hierarchy = getParentHierarchy(el);
        if (hierarchy.length > 0) {
            lines.push('|--- hierarchy: ' + hierarchy.join(' < '));
        }

        // Predicted action
        var action = getPredictedAction(el);
        if (action) {
            lines.push('|--- action: ' + action);
        }

        // Loading/error state
        var loadState = getLoadingState(el);
        if (Object.keys(loadState).length > 0) {
            lines.push('|--- status');
            var loadLines = formatObject(loadState, '|    ');
            lines = lines.concat(loadLines);
        }

        // Visibility details
        var visDetails = getVisibilityDetails(el);
        if (Object.keys(visDetails).length > 0) {
            lines.push('|--- viewport');
            var visLines = formatObject(visDetails, '|    ');
            lines = lines.concat(visLines);
        }

        // ========================================
        // AUTOMATION CONTEXT (semantic extraction for agents)
        // ========================================
        var hasAutoContext = false;
        var autoLines = [];

        // Behavior - what this element does when activated
        var expected = getExpectedOutcomes(el);
        if (Object.keys(expected).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- behavior (on activation)');
            var expectedLines = formatObject(expected, '|    ');
            autoLines = autoLines.concat(expectedLines);
        }

        // Input method - how to interact with this element
        var hints = getInteractionHints(el);
        if (Object.keys(hints).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- input-method');
            var hintLines = formatObject(hints, '|    ');
            autoLines = autoLines.concat(hintLines);
        }

        // Dependencies - elements this one controls or is controlled by
        var relationships = getElementRelationships(el);
        if (Object.keys(relationships).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- dependencies');
            var relLines = formatObject(relationships, '|    ');
            autoLines = autoLines.concat(relLines);
        }

        // Constraints - validation rules and input requirements
        var validationExp = getValidationExpectations(el);
        if (Object.keys(validationExp).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- constraints');
            var valLines = formatObject(validationExp, '|    ');
            autoLines = autoLines.concat(valLines);
        }

        // Step context - position in multi-step flow (wizard, checkout, etc)
        var workflowCtx = getWorkflowContext(el);
        if (Object.keys(workflowCtx).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- step-context');
            var workflowLines = formatObject(workflowCtx, '|    ');
            autoLines = autoLines.concat(workflowLines);
        }

        // Data binding - reactive framework bindings (Vue, React, Angular, etc)
        var dataBinding = getDataBinding(el);
        if (Object.keys(dataBinding).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- data-binding');
            var bindLines = formatObject(dataBinding, '|    ');
            autoLines = autoLines.concat(bindLines);
        }

        // Timing - transitions, animations, debounce delays
        var timing = getTimingContext(el);
        if (Object.keys(timing).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- timing');
            var timingLines = formatObject(timing, '|    ');
            autoLines = autoLines.concat(timingLines);
        }

        // Error state - current validation errors
        var errorState = getErrorState(el);
        if (Object.keys(errorState).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- error-state');
            var errorLines = formatObject(errorState, '|    ');
            autoLines = autoLines.concat(errorLines);
        }

        // Permissions - browser permissions that may be required
        var permissions = getPermissionRequirements(el);
        if (Object.keys(permissions).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- permissions');
            var permLines = formatObject(permissions, '|    ');
            autoLines = autoLines.concat(permLines);
        }

        // Async behavior - loading, pagination, polling patterns
        var asyncBehavior = getAsyncBehavior(el);
        if (Object.keys(asyncBehavior).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- async');
            var asyncLines = formatObject(asyncBehavior, '|    ');
            autoLines = autoLines.concat(asyncLines);
        }

        // Keyboard shortcuts - access keys and hotkeys
        var shortcuts = getKeyboardShortcuts(el);
        if (Object.keys(shortcuts).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- shortcuts');
            var shortcutLines = formatObject(shortcuts, '|    ');
            autoLines = autoLines.concat(shortcutLines);
        }

        // Content type - media type, format, editability
        var contentType = getContentType(el);
        if (Object.keys(contentType).length > 0) {
            hasAutoContext = true;
            autoLines.push('|--- content');
            var contentLines = formatObject(contentType, '|    ');
            autoLines = autoLines.concat(contentLines);
        }

        // Add automation context section with header if any data exists
        if (hasAutoContext) {
            lines.push('|');
            lines.push('| AUTOMATION CONTEXT');
            lines = lines.concat(autoLines);
        }

        lines.push(divider);

        return lines.join(NL);
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================
    function onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        createBox();
        box.style.left = startX + 'px';
        box.style.top = startY + 'px';
        box.style.width = '0';
        box.style.height = '0';
    }

    function onMouseMove(e) {
        if (!box) return;
        var l = Math.min(startX, e.clientX);
        var t = Math.min(startY, e.clientY);
        var w = Math.abs(e.clientX - startX);
        var h = Math.abs(e.clientY - startY);
        Object.assign(box.style, {
            left: l + 'px',
            top: t + 'px',
            width: w + 'px',
            height: h + 'px'
        });
    }

    function onMouseUp(e) {
        if (!box) return;
        var rect = {
            left: Math.min(startX, e.clientX),
            top: Math.min(startY, e.clientY),
            right: Math.max(startX, e.clientX),
            bottom: Math.max(startY, e.clientY)
        };

        // Hide overlay to get elements underneath
        overlay.style.display = 'none';
        var elements = getElementsInRect(rect);
        overlay.style.display = 'block';

        var output = buildOutput(rect, elements);

        // Copy to clipboard with fallback for older browsers (no Promise dependency)
        function copyToClipboardFallback(text) {
            try {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.top = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                var success = document.execCommand('copy');
                textarea.remove();
                return success;
            } catch (err) {
                return false;
            }
        }
        
        function onCopySuccess() {
            var preview = output.length > 100 ? output.substring(0, 100) + '...' : output;
            showToast('Copied to clipboard!' + String.fromCharCode(10) + String.fromCharCode(10) + preview, 3500);
        }
        
        function onCopyError(err) {
            showToast('Failed to copy: ' + (err && err.message ? err.message : 'Unknown error'), 3000);
        }
        
        // Try modern API first, fallback to execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output)
                .then(onCopySuccess)
                .catch(onCopyError);
        } else {
            // Synchronous fallback for IE11 and older browsers
            if (copyToClipboardFallback(output)) {
                onCopySuccess();
            } else {
                onCopyError(null);
            }
        }

        overlay.remove();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            overlay.remove();
        }
    }

    // ========================================
    // INITIALIZE
    // ========================================
    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    } catch (e) {
        console.error('DOM Extractor error:', e);
    }
})();
