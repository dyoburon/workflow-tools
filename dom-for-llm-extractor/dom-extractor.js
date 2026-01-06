(function() {
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
            maxWidth: '500px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
            border: '1px solid #333'
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.remove(); }, duration);
    }

    // ========================================
    // SELECTOR HELPERS
    // ========================================
    function getShortSelector(el) {
        var selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            var classes = el.className.trim().split(/\s+/).filter(function(c) {
                return c && c.indexOf(':') === -1 && !c.startsWith('_');
            });
            if (classes.length > 0) {
                selector += '.' + classes.slice(0, 3).join('.');
            }
        }
        return selector;
    }

    function getUniqueSelector(el) {
        if (el.id) return '#' + el.id;
        var path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            var selector = el.tagName.toLowerCase();
            if (el.id) {
                path.unshift('#' + el.id);
                break;
            } else if (el.className && typeof el.className === 'string') {
                var classes = el.className.trim().split(/\s+/).filter(function(c) {
                    return c && c.indexOf(':') === -1 && !c.startsWith('_');
                });
                if (classes.length > 0) {
                    selector += '.' + classes.slice(0, 2).join('.');
                }
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.slice(-4).join(' > ');
    }

    function getText(el) {
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
        var cleaned = text.replace(/\s+/g, ' ').trim();
        return cleaned;
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
                left: (rect.left / vw * 100).toFixed(1),
                top: (rect.top / vh * 100).toFixed(1)
            }
        };
        if (parent && parent !== document.body) {
            var parentRect = parent.getBoundingClientRect();
            info.inParent = {
                selector: getShortSelector(parent),
                leftPct: ((rect.left - parentRect.left) / parentRect.width * 100).toFixed(1),
                topPct: ((rect.top - parentRect.top) / parentRect.height * 100).toFixed(1)
            };
        }
        return info;
    }

    // ========================================
    // VISUAL INFO EXTRACTION
    // ========================================
    function getVisualInfo(el) {
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
    }

    // ========================================
    // DESIGN INFO EXTRACTION
    // ========================================
    function getDesignInfo(el) {
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
    }

    // ========================================
    // INTERACTIVE STATE EXTRACTION
    // ========================================
    function getInteractiveState(el) {
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
            if (el.value && el.type !== 'password') {
                state.value = el.value;
            }
            if (el.placeholder) state.placeholder = el.placeholder;
        }

        return state;
    }

    // ========================================
    // INPUT CONSTRAINTS EXTRACTION
    // ========================================
    function getInputConstraints(el) {
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
    }

    // ========================================
    // SEMANTIC INFO EXTRACTION
    // ========================================
    function getSemanticInfo(el) {
        var info = {};

        // Role
        var role = el.getAttribute('role');
        if (role) info.role = role;

        // ARIA label
        var ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) info.ariaLabel = ariaLabel;

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
        var rawHref = el.href;
        var href = (rawHref && typeof rawHref === 'string') ? rawHref : (rawHref && rawHref.baseVal) ? rawHref.baseVal : '';
        if (href) {
            // Sanitize - remove query params for privacy
            try {
                var url = new URL(href);
                info.href = url.origin + url.pathname;
            } catch (e) {
                info.href = href.split('?')[0];
            }
        }

        // Data attributes (non-sensitive)
        var dataAttrs = {};
        for (var i = 0; i < el.attributes.length; i++) {
            var attr = el.attributes[i];
            if (attr.name.startsWith('data-') &&
                !attr.name.includes('token') &&
                !attr.name.includes('key') &&
                !attr.name.includes('secret') &&
                !attr.name.includes('auth')) {
                dataAttrs[attr.name] = attr.value;
            }
        }
        if (Object.keys(dataAttrs).length > 0) {
            info.data = dataAttrs;
        }

        return info;
    }

    // ========================================
    // INTERACTIVITY DETECTION
    // ========================================
    function hasInteractivity(el) {
        var interactive = [];

        // Native interactive elements
        var tag = el.tagName.toLowerCase();
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
    }

    // ========================================
    // SCROLL CONTEXT
    // ========================================
    function getScrollContext(el) {
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
    }

    // ========================================
    // PSEUDO CONTENT
    // ========================================
    function getPseudoContent(el) {
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
    }

    // ========================================
    // FORM CONTEXT
    // ========================================
    function getFormContext(el) {
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
                } catch (e) {
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
    }

    // ========================================
    // TABLE CONTEXT
    // ========================================
    function getTableContext(el) {
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
    }

    // ========================================
    // LIST CONTEXT
    // ========================================
    function getListContext(el) {
        var context = {};
        var listItem = el.closest('li');
        if (listItem) {
            var list = listItem.closest('ul, ol');
            if (list) {
                var items = list.querySelectorAll(':scope > li');
                context.inList = true;
                context.listType = list.tagName.toLowerCase();
                context.position = Array.prototype.indexOf.call(items, listItem) + 1;
                context.totalItems = items.length;
            }
        }
        return context;
    }

    // ========================================
    // LANDMARK/REGION CONTEXT
    // ========================================
    function getLandmarkContext(el) {
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
    }

    // ========================================
    // MODAL/DIALOG CONTEXT
    // ========================================
    function getModalContext(el) {
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
    }

    // ========================================
    // SIBLING CONTEXT
    // ========================================
    function getSiblingContext(el) {
        var context = {};
        var parent = el.parentElement;
        if (!parent) return context;
        
        var siblings = Array.prototype.filter.call(parent.children, function(child) {
            return child.nodeType === Node.ELEMENT_NODE;
        });
        
        var index = siblings.indexOf(el);
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
    }

    // ========================================
    // PARENT HIERARCHY
    // ========================================
    function getParentHierarchy(el) {
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
    }

    // ========================================
    // PREDICTED ACTION
    // ========================================
    function getPredictedAction(el) {
        var tag = el.tagName.toLowerCase();
        var rawType = el.type;
        var type = (rawType && typeof rawType === 'string') ? rawType.toLowerCase() : '';
        var role = el.getAttribute('role');

        // Form submissions
        if (tag === 'button' && type === 'submit') return 'submit-form';
        if (tag === 'input' && type === 'submit') return 'submit-form';
        if (tag === 'form') return 'container-form';

        // Navigation - href can be SVGAnimatedString on SVG <a> elements
        var href = el.href;
        var hrefStr = (href && typeof href === 'string') ? href : (href && href.baseVal) ? href.baseVal : '';
        if (tag === 'a' && hrefStr) {
            if (hrefStr.includes('#')) return 'scroll-to-anchor';
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
    }

    // ========================================
    // LOADING/ERROR STATES
    // ========================================
    function getLoadingState(el) {
        var state = {};
        
        // Check for loading indicators
        var loadingPatterns = ['loading', 'spinner', 'skeleton', 'shimmer', 'pending'];
        var className = (el.className && typeof el.className === 'string') ? el.className : '';
        var ariaLabel = el.getAttribute('aria-label') || '';
        var ariaBusy = el.getAttribute('aria-busy');
        
        if (ariaBusy === 'true') {
            state.loading = true;
        }
        
        for (var i = 0; i < loadingPatterns.length; i++) {
            if (className.toLowerCase().includes(loadingPatterns[i]) ||
                ariaLabel.toLowerCase().includes(loadingPatterns[i])) {
                state.loading = true;
                state.loadingType = loadingPatterns[i];
                break;
            }
        }
        
        // Check for error states
        var errorPatterns = ['error', 'invalid', 'danger', 'alert'];
        for (var j = 0; j < errorPatterns.length; j++) {
            if (className.toLowerCase().includes(errorPatterns[j])) {
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
        
        return state;
    }

    // ========================================
    // VISIBILITY DETAILS
    // ========================================
    function getVisibilityDetails(el) {
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
    }

    // ========================================
    // ELEMENT COLLECTION
    // ========================================
    function getElementsInRect(rect) {
        var elements = [];
        var seen = new Set();
        var step = 8; // Finer granularity

        for (var x = rect.left; x <= rect.right; x += step) {
            for (var y = rect.top; y <= rect.bottom; y += step) {
                var elsAtPoint = document.elementsFromPoint(x, y);
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
        var leftPct = (rect.left / vw * 100).toFixed(1);
        var topPct = (rect.top / vh * 100).toFixed(1);

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

        lines.push(divider);

        // Nearby elements (ALL of them, no truncation)
        if (elements.length > 1) {
            lines.push('| NEARBY (' + (elements.length - 1) + ')');
            for (var i = 1; i < elements.length; i++) {
                var nearby = elements[i];
                var nearbyText = getText(nearby.el);
                var nearbyInteractive = hasInteractivity(nearby.el);
                var interactiveMarker = nearbyInteractive.length > 0 ? ' [interactive]' : '';

                var line = '| ' + (i) + '. ' + getShortSelector(nearby.el);
                if (nearbyText) {
                    line += ' "' + nearbyText + '"';
                }
                line += interactiveMarker;
                lines.push(line);
            }
            lines.push(divider);
        }

        return lines.join(NL);
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================
    function onMouseDown(e) {
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

        navigator.clipboard.writeText(output)
            .then(function() {
                var preview = output.length > 300 ? output.substring(0, 300) + '...' : output;
                showToast('Copied to clipboard!' + String.fromCharCode(10) + String.fromCharCode(10) + preview, 3500);
            })
            .catch(function(err) {
                showToast('Failed to copy: ' + err.message, 3000);
            });

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
})();
