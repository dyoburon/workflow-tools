(function() {
    // Remove existing overlay if present
    if (document.getElementById('page-measure-overlay')) {
        document.getElementById('page-measure-overlay').remove();
        return;
    }

    let startX, startY, box;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Create overlay
    const overlay = document.createElement('div');
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
            background: 'rgba(0, 102, 255, 0.1)',
            pointerEvents: 'none',
            zIndex: '2147483647'
        });
        overlay.appendChild(box);
    }

    function showToast(msg, duration = 2000) {
        const t = document.createElement('div');
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
        setTimeout(() => t.remove(), duration);
    }

    // Generate a unique CSS selector for an element
    function getSelector(el) {
        if (el.id) return '#' + el.id;

        let path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                selector = '#' + el.id;
                path.unshift(selector);
                break;
            } else if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':'));
                if (classes.length > 0) {
                    selector += '.' + classes.slice(0, 2).join('.');
                }
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.slice(-4).join(' > ');
    }

    // Get short selector (just the element itself)
    function getShortSelector(el) {
        let selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
                selector += '.' + classes.slice(0, 3).join('.');
            }
        }
        return selector;
    }

    // Get text content, truncated
    function getText(el) {
        const text = el.textContent || '';
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 60) {
            return cleaned.substring(0, 60) + '...';
        }
        return cleaned;
    }

    // Get position within parent container
    function getPositionInParent(el) {
        const parent = el.offsetParent || el.parentElement;
        if (!parent) return null;

        const elRect = el.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        const leftPct = ((elRect.left - parentRect.left) / parentRect.width * 100).toFixed(1);
        const topPct = ((elRect.top - parentRect.top) / parentRect.height * 100).toFixed(1);

        return { left: leftPct, top: topPct, parentSelector: getShortSelector(parent) };
    }

    // Find elements in selection rectangle
    function getElementsInRect(rect) {
        const elements = [];
        const seen = new Set();

        // Sample points within the rectangle
        const step = 10;
        for (let x = rect.left; x <= rect.right; x += step) {
            for (let y = rect.top; y <= rect.bottom; y += step) {
                const elsAtPoint = document.elementsFromPoint(x, y);
                for (const el of elsAtPoint) {
                    if (el === overlay || el === box || el === document.body || el === document.documentElement) continue;
                    if (seen.has(el)) continue;
                    seen.add(el);

                    const elRect = el.getBoundingClientRect();
                    // Check if element is mostly within our selection
                    const overlapLeft = Math.max(rect.left, elRect.left);
                    const overlapRight = Math.min(rect.right, elRect.right);
                    const overlapTop = Math.max(rect.top, elRect.top);
                    const overlapBottom = Math.min(rect.bottom, elRect.bottom);

                    if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
                        const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
                        const elArea = elRect.width * elRect.height;
                        const coverage = elArea > 0 ? overlapArea / elArea : 0;

                        if (coverage > 0.3) { // At least 30% of element is in selection
                            elements.push({
                                el,
                                rect: elRect,
                                area: elArea,
                                coverage
                            });
                        }
                    }
                }
            }
        }

        // Sort by area (smallest first - most specific elements)
        elements.sort((a, b) => a.area - b.area);
        return elements;
    }

    // Build the output
    function buildOutput(rect, elements) {
        const lines = [];

        // Viewport position
        const leftPct = (rect.left / vw * 100).toFixed(1);
        const topPct = (rect.top / vh * 100).toFixed(1);
        const widthPct = ((rect.right - rect.left) / vw * 100).toFixed(1);
        const heightPct = ((rect.bottom - rect.top) / vh * 100).toFixed(1);

        lines.push(`SELECTION`);
        lines.push(`Position: ${leftPct}% left, ${topPct}% top`);
        lines.push(`Size: ${widthPct}% x ${heightPct}%`);
        lines.push(``);

        if (elements.length === 0) {
            lines.push(`No elements found in selection`);
        } else {
            // Primary element (smallest/most specific)
            const primary = elements[0];
            lines.push(`PRIMARY ELEMENT`);
            lines.push(`Tag: ${getShortSelector(primary.el)}`);

            const text = getText(primary.el);
            if (text) {
                lines.push(`Text: "${text}"`);
            }

            lines.push(`Selector: ${getSelector(primary.el)}`);

            const posInParent = getPositionInParent(primary.el);
            if (posInParent) {
                lines.push(`In parent (${posInParent.parentSelector}): ${posInParent.left}% left, ${posInParent.top}% top`);
            }

            // Other elements in selection
            if (elements.length > 1) {
                lines.push(``);
                lines.push(`OTHER ELEMENTS (${elements.length - 1}):`);
                for (let i = 1; i < Math.min(elements.length, 6); i++) {
                    const el = elements[i];
                    const text = getText(el.el);
                    const textPart = text ? ` "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"` : '';
                    lines.push(`- ${getShortSelector(el.el)}${textPart}`);
                }
                if (elements.length > 6) {
                    lines.push(`  ... and ${elements.length - 6} more`);
                }
            }
        }

        return lines.join('\n');
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
        const l = Math.min(startX, e.clientX);
        const t = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        Object.assign(box.style, {
            left: l + 'px',
            top: t + 'px',
            width: w + 'px',
            height: h + 'px'
        });
    }

    function onMouseUp(e) {
        if (!box) return;

        const rect = {
            left: Math.min(startX, e.clientX),
            top: Math.min(startY, e.clientY),
            right: Math.max(startX, e.clientX),
            bottom: Math.max(startY, e.clientY)
        };

        // Hide overlay temporarily to get elements underneath
        overlay.style.display = 'none';
        const elements = getElementsInRect(rect);
        overlay.style.display = 'block';

        const output = buildOutput(rect, elements);

        navigator.clipboard.writeText(output)
            .then(() => showToast('Copied!\n\n' + output.substring(0, 200) + (output.length > 200 ? '...' : ''), 3000))
            .catch(() => showToast('Failed to copy'));

        overlay.remove();
    }

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') overlay.remove();
    });

    document.body.appendChild(overlay);
})();
