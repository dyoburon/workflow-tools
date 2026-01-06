(function() {
    if (document.getElementById('page-measure-overlay')) {
        document.getElementById('page-measure-overlay').remove();
        return;
    }

    var startX, startY, box;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var overlay = document.createElement('div');
    overlay.id = 'page-measure-overlay';
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
            background: '#333',
            color: '#fff',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            zIndex: '2147483647',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4'
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.remove(); }, duration);
    }

    function getShortSelector(el) {
        var selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            var classes = el.className.trim().split(/\s+/).filter(function(c) { return c && c.indexOf(':') === -1; });
            if (classes.length > 0) {
                selector += '.' + classes.slice(0, 3).join('.');
            }
        }
        return selector;
    }

    function getUniqueSelector(el) {
        if (el.id) return '#' + el.id;
        var path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
            var selector = el.tagName.toLowerCase();
            if (el.id) {
                path.unshift('#' + el.id);
                break;
            }
            if (el.className && typeof el.className === 'string') {
                var classes = el.className.trim().split(/\s+/).filter(function(c) { return c && c.indexOf(':') === -1; });
                if (classes.length > 0) selector += '.' + classes.slice(0, 2).join('.');
            }
            var parent = el.parentElement;
            if (parent) {
                var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === el.tagName; });
                if (siblings.length > 1) selector += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.slice(-5).join(' > ');
    }

    function getText(el, maxLen) {
        maxLen = maxLen || 100;
        var text = el.textContent || '';
        var cleaned = text.replace(/\s+/g, ' ').trim();
        return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
    }

    function getRegion(rect) {
        var cx = (rect.left + rect.right) / 2, cy = (rect.top + rect.bottom) / 2;
        var h = cx < vw * 0.33 ? 'left' : cx > vw * 0.66 ? 'right' : 'center';
        var v = cy < vh * 0.33 ? 'top' : cy > vh * 0.66 ? 'bottom' : 'middle';
        return v + '-' + h;
    }

    function getLandmark(el) {
        var landmarks = { header: 'header', nav: 'navigation', main: 'main', footer: 'footer', aside: 'sidebar', section: 'section', article: 'article', form: 'form' };
        var current = el;
        while (current && current !== document.body) {
            var tag = current.tagName.toLowerCase();
            if (landmarks[tag]) return { type: landmarks[tag], el: current };
            var role = current.getAttribute('role');
            if (role && ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'form', 'search', 'region'].indexOf(role) !== -1) {
                return { type: role, el: current };
            }
            current = current.parentElement;
        }
        return null;
    }

    function getSemanticInfo(el) {
        var info = {};
        var role = el.getAttribute('role');
        var ariaLabel = el.getAttribute('aria-label');
        var ariaDescribedby = el.getAttribute('aria-describedby');
        var testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy');
        
        if (role) info.role = role;
        if (ariaLabel) info.ariaLabel = ariaLabel;
        if (ariaDescribedby) {
            var desc = document.getElementById(ariaDescribedby);
            if (desc) info.ariaDescription = getText(desc, 60);
        }
        if (testId) info.testId = testId;
        
        // Interactive element attributes
        if (el.tagName === 'A' && el.href) info.href = el.href.length > 80 ? el.href.substring(0, 80) + '...' : el.href;
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') info.isButton = true;
        if (el.tagName === 'INPUT') {
            info.inputType = el.type;
            if (el.name) info.name = el.name;
            if (el.placeholder) info.placeholder = el.placeholder;
        }
        if (el.tagName === 'IMG') {
            info.alt = el.alt || '(no alt)';
            info.src = el.src.length > 60 ? '...' + el.src.slice(-50) : el.src;
        }
        
        return Object.keys(info).length > 0 ? info : null;
    }

    function getPositionContext(el, elRect) {
        var ctx = {};
        
        // Viewport position
        ctx.viewport = {
            x: (elRect.left / vw * 100).toFixed(1) + '%',
            y: (elRect.top / vh * 100).toFixed(1) + '%',
            w: (elRect.width / vw * 100).toFixed(1) + '%',
            h: (elRect.height / vh * 100).toFixed(1) + '%'
        };
        
        // Parent context
        var parent = el.offsetParent || el.parentElement;
        if (parent && parent !== document.body) {
            var pRect = parent.getBoundingClientRect();
            ctx.inParent = {
                selector: getShortSelector(parent),
                x: ((elRect.left - pRect.left) / pRect.width * 100).toFixed(1) + '%',
                y: ((elRect.top - pRect.top) / pRect.height * 100).toFixed(1) + '%'
            };
        }
        
        // Sibling context
        var siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
        if (siblings.length > 1) {
            var idx = siblings.indexOf(el);
            ctx.sibling = { position: idx + 1, total: siblings.length };
        }
        
        // Landmark context
        var landmark = getLandmark(el);
        if (landmark) {
            ctx.landmark = landmark.type;
            if (landmark.el !== el) ctx.landmarkSelector = getShortSelector(landmark.el);
        }
        
        return ctx;
    }

    function getAncestorPath(el) {
        var path = [];
        var current = el.parentElement;
        while (current && current !== document.body && path.length < 4) {
            path.push(getShortSelector(current));
            current = current.parentElement;
        }
        return path.reverse();
    }

    function getElementsInRect(rect) {
        var elements = [];
        var seen = new Set();
        var step = 10;
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
                        if (coverage > 0.3) {
                            elements.push({ el: el, rect: elRect, area: elArea, coverage: coverage });
                        }
                    }
                }
            }
        }
        elements.sort(function(a, b) { return a.area - b.area; });
        return elements;
    }

    function buildOutput(rect, elements) {
        var lines = [];
        var NL = String.fromCharCode(10);
        
        // Selection context
        lines.push('=== SELECTION ===');
        lines.push('Region: ' + getRegion(rect) + ' of viewport');
        lines.push('Position: ' + (rect.left / vw * 100).toFixed(1) + '% from left, ' + (rect.top / vh * 100).toFixed(1) + '% from top');
        lines.push('Size: ' + Math.round(rect.right - rect.left) + 'x' + Math.round(rect.bottom - rect.top) + 'px (' + ((rect.right - rect.left) / vw * 100).toFixed(1) + '% x ' + ((rect.bottom - rect.top) / vh * 100).toFixed(1) + '% of viewport)');

        if (elements.length === 0) {
            lines.push(NL + 'No elements found in selection');
            return lines.join(NL);
        }

        var primary = elements[0];
        var pos = getPositionContext(primary.el, primary.rect);
        var semantic = getSemanticInfo(primary.el);
        
        lines.push(NL + '=== PRIMARY ELEMENT ===');
        lines.push('Tag: ' + getShortSelector(primary.el));
        
        var text = getText(primary.el, 120);
        if (text) lines.push('Text: "' + text + '"');
        
        lines.push('Selector: ' + getUniqueSelector(primary.el));
        
        // Ancestor chain for context
        var ancestors = getAncestorPath(primary.el);
        if (ancestors.length > 0) lines.push('Path: ' + ancestors.join(' > ') + ' > [this]');
        
        // Position details
        lines.push(NL + '--- Position ---');
        lines.push('Viewport: ' + pos.viewport.x + ' left, ' + pos.viewport.y + ' top');
        lines.push('Size: ' + pos.viewport.w + ' x ' + pos.viewport.h);
        if (pos.inParent) lines.push('In ' + pos.inParent.selector + ': ' + pos.inParent.x + ' left, ' + pos.inParent.y + ' top');
        if (pos.sibling) lines.push('Child ' + pos.sibling.position + ' of ' + pos.sibling.total + ' siblings');
        if (pos.landmark) lines.push('Inside: <' + pos.landmark + '>' + (pos.landmarkSelector ? ' (' + pos.landmarkSelector + ')' : ''));
        
        // Semantic/accessibility info
        if (semantic) {
            lines.push(NL + '--- Attributes ---');
            if (semantic.role) lines.push('Role: ' + semantic.role);
            if (semantic.ariaLabel) lines.push('Label: ' + semantic.ariaLabel);
            if (semantic.ariaDescription) lines.push('Description: ' + semantic.ariaDescription);
            if (semantic.testId) lines.push('Test ID: ' + semantic.testId);
            if (semantic.href) lines.push('Href: ' + semantic.href);
            if (semantic.inputType) lines.push('Input type: ' + semantic.inputType);
            if (semantic.name) lines.push('Name: ' + semantic.name);
            if (semantic.placeholder) lines.push('Placeholder: ' + semantic.placeholder);
            if (semantic.alt !== undefined) lines.push('Alt: ' + semantic.alt);
            if (semantic.src) lines.push('Src: ' + semantic.src);
        }
        
        // Context elements - show ALL elements in selection
        if (elements.length > 1) {
            lines.push(NL + '=== NEARBY ELEMENTS (' + (elements.length - 1) + ') ===');
            for (var i = 1; i < elements.length; i++) {
                var el = elements[i];
                var elText = getText(el.el, 50);
                var line = '- ' + getShortSelector(el.el);
                if (elText) line += ': "' + elText + '"';
                lines.push(line);
            }
        }
        
        return lines.join(NL);
    }

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
        Object.assign(box.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    }

    function onMouseUp(e) {
        if (!box) return;
        var rect = {
            left: Math.min(startX, e.clientX),
            top: Math.min(startY, e.clientY),
            right: Math.max(startX, e.clientX),
            bottom: Math.max(startY, e.clientY)
        };
        overlay.style.display = 'none';
        var elements = getElementsInRect(rect);
        overlay.style.display = 'block';
        var output = buildOutput(rect, elements);
        navigator.clipboard.writeText(output)
            .then(function() { showToast('Copied!' + String.fromCharCode(10) + String.fromCharCode(10) + output.substring(0, 300) + (output.length > 300 ? '...' : ''), 3500); })
            .catch(function() { showToast('Failed to copy'); });
        overlay.remove();
    }

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') overlay.remove(); });
    document.body.appendChild(overlay);
})();
