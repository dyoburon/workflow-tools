// DOM Extractor - Drag Mode Module
// Handles drag selection for extracting DOM elements

(function(window) {
  'use strict';

  console.log('[DOMExtractor] Drag mode module loading...');

  window.DOMExtractor = window.DOMExtractor || {};

  var state = {
    active: false,
    overlay: null,
    box: null,
    startX: 0,
    startY: 0
  };

  // Debug: Check if modules are loaded
  console.log('[DOMExtractor] Checking modules:', {
    extractors: !!window.DOMExtractor.extractors,
    selectors: !!window.DOMExtractor.selectors,
    position: !!window.DOMExtractor.position,
    helpers: !!window.DOMExtractor.helpers,
    format: !!window.DOMExtractor.format
  });

  var E = window.DOMExtractor.extractors;
  var S = window.DOMExtractor.selectors;
  var P = window.DOMExtractor.position;
  var H = window.DOMExtractor.helpers;
  var F = window.DOMExtractor.format;

  // ========================================
  // ACTIVATE / DEACTIVATE
  // ========================================

  function activate() {
    console.log('[DOMExtractor] Drag mode activate() called');

    if (state.active) {
      console.log('[DOMExtractor] Already active, deactivating');
      deactivate();
      return;
    }

    // Verify modules are available
    if (!E || !S || !P || !H || !F) {
      console.error('[DOMExtractor] MODULES NOT LOADED!', { E: !!E, S: !!S, P: !!P, H: !!H, F: !!F });
      alert('DOM Extractor: Modules not loaded. Check console.');
      return;
    }

    state.active = true;
    createOverlay();
    document.addEventListener('keydown', onKeyDown);
    console.log('[DOMExtractor] Drag mode activated, overlay created');
  }

  function deactivate() {
    state.active = false;
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
    if (state.box) {
      state.box = null;
    }
    document.removeEventListener('keydown', onKeyDown);
  }

  // ========================================
  // UI CREATION
  // ========================================

  function createOverlay() {
    state.overlay = document.createElement('div');
    state.overlay.className = 'dom-extractor-overlay';
    state.overlay.addEventListener('mousedown', onMouseDown);
    state.overlay.addEventListener('mousemove', onMouseMove);
    state.overlay.addEventListener('mouseup', onMouseUp);
    document.body.appendChild(state.overlay);
  }

  function createBox() {
    state.box = document.createElement('div');
    state.box.className = 'dom-extractor-box';
    state.overlay.appendChild(state.box);
  }

  function showToast(msg, type, duration) {
    duration = duration || 2000;
    var t = document.createElement('div');
    t.className = 'dom-extractor-toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, duration);
  }

  // ========================================
  // ELEMENT COLLECTION
  // ========================================

  function getElementsInRect(rect) {
    var elements = [];
    var seen = new H.SimpleSet();
    var step = 8;

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
          if (el === state.overlay || el === state.box || el === document.body || el === document.documentElement) continue;
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

    elements.sort(function(a, b) { return a.area - b.area; });
    return elements;
  }

  // ========================================
  // BUILD OUTPUT
  // ========================================

  function buildOutput(rect, elements) {
    var NL = '\n';
    var lines = [];
    var divider = '+' + new Array(66).join('-');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scrollX = window.scrollX || window.pageXOffset;
    var scrollY = window.scrollY || window.pageYOffset;

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
    lines.push('| region: ' + P.getRegionName(parseFloat(leftPct), parseFloat(topPct)));
    lines.push('| position: ' + leftPct + '%, ' + topPct + '%');
    lines.push('| pixels: ' + selLeft + ',' + selTop + ' -> ' + (parseInt(selLeft) + parseInt(selWidth)) + ',' + (parseInt(selTop) + parseInt(selHeight)) + ' (' + selWidth + 'x' + selHeight + ')');
    lines.push(divider);

    if (elements.length === 0) {
      lines.push('| No elements found in selection');
      lines.push(divider);
      return lines.join(NL);
    }

    // Primary element
    var primary = elements[0];
    var el = primary.el;

    lines.push('| PRIMARY ELEMENT');
    lines.push('| tag: ' + S.getShortSelector(el));
    var text = S.getText(el);
    if (text) lines.push('| text: "' + text + '"');
    lines.push('| selector: ' + S.getUniqueSelector(el));

    // Position
    var posInfo = P.getPositionInfo(el);
    lines.push('|--- position');
    lines.push('|    viewport: ' + posInfo.viewport.left + ',' + posInfo.viewport.top + ' (' + posInfo.viewport.width + 'x' + posInfo.viewport.height + ')');
    if (posInfo.inParent) {
      lines.push('|    in-parent: ' + posInfo.inParent.leftPct + '%, ' + posInfo.inParent.topPct + '% of ' + posInfo.inParent.selector);
    }

    // Visual
    var visual = E.getVisualInfo(el);
    if (Object.keys(visual).length > 0) {
      lines.push('|--- visual');
      lines = lines.concat(F.formatObject(visual, '|    '));
    }

    // Design
    var design = E.getDesignInfo(el);
    if (Object.keys(design).length > 0) {
      lines.push('|--- design');
      lines = lines.concat(F.formatObject(design, '|    '));
    }

    // Semantic
    var semantic = E.getSemanticInfo(el);
    if (Object.keys(semantic).length > 0) {
      lines.push('|--- semantic');
      lines = lines.concat(F.formatObject(semantic, '|    '));
    }

    // State
    var elState = E.getInteractiveState(el);
    if (Object.keys(elState).length > 0) {
      lines.push('|--- state');
      lines = lines.concat(F.formatObject(elState, '|    '));
    }

    // Constraints
    var constraints = E.getInputConstraints(el);
    if (Object.keys(constraints).length > 0) {
      lines.push('|--- constraints');
      lines = lines.concat(F.formatObject(constraints, '|    '));
    }

    // Interactive
    var interactive = E.hasInteractivity(el);
    if (interactive.length > 0) {
      lines.push('|--- interactive: ' + interactive.join(', '));
    }

    // Scroll
    var scroll = E.getScrollContext(el);
    if (scroll.scrollParent) {
      lines.push('|--- scroll');
      lines.push('|    parent: ' + scroll.scrollParent);
      lines.push('|    position: ' + scroll.scrollTop + '/' + scroll.scrollHeight);
    }

    // Pseudo
    var pseudo = E.getPseudoContent(el);
    if (Object.keys(pseudo).length > 0) {
      lines.push('|--- pseudo');
      if (pseudo.before) lines.push('|    before: "' + pseudo.before + '"');
      if (pseudo.after) lines.push('|    after: "' + pseudo.after + '"');
    }

    // Form context
    var formCtx = E.getFormContext(el);
    if (Object.keys(formCtx).length > 0) {
      lines.push('|--- form');
      lines = lines.concat(F.formatObject(formCtx, '|    '));
    }

    // Table context
    var tableCtx = E.getTableContext(el);
    if (Object.keys(tableCtx).length > 0) {
      lines.push('|--- table');
      lines = lines.concat(F.formatObject(tableCtx, '|    '));
    }

    // List context
    var listCtx = E.getListContext(el);
    if (Object.keys(listCtx).length > 0) {
      lines.push('|--- list');
      lines = lines.concat(F.formatObject(listCtx, '|    '));
    }

    // Landmark
    var landmarkCtx = E.getLandmarkContext(el);
    if (Object.keys(landmarkCtx).length > 0) {
      lines.push('|--- landmark');
      lines = lines.concat(F.formatObject(landmarkCtx, '|    '));
    }

    // Modal
    var modalCtx = E.getModalContext(el);
    if (Object.keys(modalCtx).length > 0) {
      lines.push('|--- modal');
      lines = lines.concat(F.formatObject(modalCtx, '|    '));
    }

    // Siblings
    var siblingCtx = E.getSiblingContext(el);
    if (Object.keys(siblingCtx).length > 0) {
      lines.push('|--- siblings');
      lines = lines.concat(F.formatObject(siblingCtx, '|    '));
    }

    // Hierarchy
    var hierarchy = E.getParentHierarchy(el);
    if (hierarchy.length > 0) {
      lines.push('|--- hierarchy: ' + hierarchy.join(' < '));
    }

    // Predicted action
    var action = E.getPredictedAction(el);
    if (action) {
      lines.push('|--- action: ' + action);
    }

    // Loading state
    var loadState = E.getLoadingState(el);
    if (Object.keys(loadState).length > 0) {
      lines.push('|--- status');
      lines = lines.concat(F.formatObject(loadState, '|    '));
    }

    // Visibility
    var visDetails = E.getVisibilityDetails(el);
    if (Object.keys(visDetails).length > 0) {
      lines.push('|--- viewport');
      lines = lines.concat(F.formatObject(visDetails, '|    '));
    }

    lines.push(divider);

    // Additional elements
    if (elements.length > 1) {
      lines.push('| ADDITIONAL ELEMENTS (' + (elements.length - 1) + ')');
      for (var i = 1; i < Math.min(elements.length, 6); i++) {
        var addEl = elements[i].el;
        lines.push('| ' + i + '. ' + S.getShortSelector(addEl));
        var addText = S.getText(addEl, 50);
        if (addText) lines.push('|    text: "' + addText + '"');
      }
      if (elements.length > 6) {
        lines.push('|    ... and ' + (elements.length - 6) + ' more');
      }
      lines.push(divider);
    }

    return lines.join(NL);
  }

  // ========================================
  // CLIPBOARD
  // ========================================

  function copyToClipboard(text, callback) {
    function fallback() {
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

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { callback(true); })
        .catch(function() {
          callback(fallback());
        });
    } else {
      callback(fallback());
    }
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    state.startX = e.clientX;
    state.startY = e.clientY;
    createBox();
    state.box.style.left = state.startX + 'px';
    state.box.style.top = state.startY + 'px';
    state.box.style.width = '0';
    state.box.style.height = '0';
  }

  function onMouseMove(e) {
    if (!state.box) return;
    var l = Math.min(state.startX, e.clientX);
    var t = Math.min(state.startY, e.clientY);
    var w = Math.abs(e.clientX - state.startX);
    var h = Math.abs(e.clientY - state.startY);
    state.box.style.left = l + 'px';
    state.box.style.top = t + 'px';
    state.box.style.width = w + 'px';
    state.box.style.height = h + 'px';
  }

  function onMouseUp(e) {
    console.log('[DOMExtractor] onMouseUp called');
    if (!state.box) {
      console.log('[DOMExtractor] No box, returning');
      return;
    }

    var rect = {
      left: Math.min(state.startX, e.clientX),
      top: Math.min(state.startY, e.clientY),
      right: Math.max(state.startX, e.clientX),
      bottom: Math.max(state.startY, e.clientY)
    };

    console.log('[DOMExtractor] Selection rect:', rect);

    // Hide overlay to get elements underneath
    state.overlay.style.display = 'none';

    try {
      var elements = getElementsInRect(rect);
      console.log('[DOMExtractor] Found elements:', elements.length);
      if (elements.length > 0) {
        console.log('[DOMExtractor] First element:', elements[0].el.tagName, elements[0].el);
      }

      state.overlay.style.display = 'block';

      var output = buildOutput(rect, elements);
      console.log('[DOMExtractor] Output length:', output.length);
      console.log('[DOMExtractor] Output preview:', output.substring(0, 500));

      copyToClipboard(output, function(success) {
        console.log('[DOMExtractor] Copy result:', success);
        if (success) {
          var preview = output.length > 80 ? output.substring(0, 80) + '...' : output;
          showToast('Copied to clipboard!\n\n' + preview, 'success', 3000);

          // Notify background script
          chrome.runtime.sendMessage({
            action: 'extraction-complete',
            mode: 'drag',
            elementCount: elements.length,
            url: window.location.pathname
          });
        } else {
          showToast('Failed to copy to clipboard', 'error', 3000);
        }
      });
    } catch (err) {
      console.error('[DOMExtractor] Error in onMouseUp:', err);
      state.overlay.style.display = 'block';
      showToast('Error: ' + err.message, 'error', 3000);
    }

    deactivate();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      deactivate();
    }
  }

  // ========================================
  // EXPORT
  // ========================================

  window.DOMExtractor.dragMode = {
    activate: activate,
    deactivate: deactivate,
    isActive: function() { return state.active; }
  };

  console.log('[DOMExtractor] Drag mode module exported:', !!window.DOMExtractor.dragMode);

})(window);
