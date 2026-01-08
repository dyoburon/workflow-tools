// DOM Extractor - Precision Mode Module
// Hover-to-inspect with click-to-capture

(function(window) {
  'use strict';

  console.log('[DOMExtractor] Precision mode module loading...');

  window.DOMExtractor = window.DOMExtractor || {};

  var E = window.DOMExtractor.extractors;
  var S = window.DOMExtractor.selectors;
  var P = window.DOMExtractor.position;
  var H = window.DOMExtractor.helpers;

  console.log('[DOMExtractor] Precision mode checking modules:', { E: !!E, S: !!S, P: !!P, H: !!H });

  // ========================================
  // STATE
  // ========================================

  var state = {
    active: false,
    hoveredElement: null,
    startTime: 0,
    lastMoveTime: 0,
    rafPending: false,
    networkLog: [],
    overlay: null,
    highlight: null,
    label: null,
    statusBar: null,
    originalFetch: null,
    originalXHROpen: null,
    originalXHRSend: null
  };

  var TIMING = {
    throttleMs: 16,
    flashDurationMs: 120,
    toastDurationMs: 1500
  };

  var LIMITS = {
    maxNetworkEntries: 100
  };

  var SENSITIVE_PARAMS = [
    'token', 'key', 'secret', 'auth', 'password',
    'api_key', 'apikey', 'access_token', 'refresh_token',
    'session', 'sid', 'jwt', 'bearer', 'credential'
  ];

  // ========================================
  // ACTIVATE / DEACTIVATE
  // ========================================

  function activate() {
    console.log('[DOMExtractor] Precision activate() called');

    if (state.active) {
      console.log('[DOMExtractor] Precision already active, deactivating');
      deactivate();
      return;
    }

    // Check modules
    if (!E || !S || !P) {
      console.error('[DOMExtractor] Precision mode - modules not loaded!', { E: !!E, S: !!S, P: !!P });
      alert('DOM Extractor: Precision mode modules not loaded. Check console.');
      return;
    }

    state.active = true;
    state.startTime = Date.now();
    state.networkLog = [];

    console.log('[DOMExtractor] Precision creating UI...');
    createUI();
    console.log('[DOMExtractor] Precision setting up network interception...');
    setupNetworkInterception();
    console.log('[DOMExtractor] Precision attaching event listeners...');
    attachEventListeners();
    console.log('[DOMExtractor] Precision mode activated successfully');
  }

  function deactivate() {
    state.active = false;
    state.hoveredElement = null;

    removeEventListeners();
    restoreNetworkInterception();
    removeUI();
  }

  // ========================================
  // UI CREATION
  // ========================================

  function createUI() {
    // Overlay
    state.overlay = document.createElement('div');
    state.overlay.className = 'dom-extractor-overlay';
    state.overlay.style.cursor = 'crosshair';
    document.body.appendChild(state.overlay);

    // Highlight box
    state.highlight = document.createElement('div');
    state.highlight.className = 'dom-extractor-highlight';
    document.body.appendChild(state.highlight);

    // Floating label
    state.label = document.createElement('div');
    state.label.className = 'dom-extractor-label';
    document.body.appendChild(state.label);

    // Status bar
    state.statusBar = document.createElement('div');
    state.statusBar.className = 'dom-extractor-statusbar';
    state.statusBar.innerHTML = '<span class="mode">PRECISION</span><span id="precision-element-info">Hover to inspect</span><span class="hint">Click to capture | Esc to exit</span>';
    document.body.appendChild(state.statusBar);
  }

  function removeUI() {
    if (state.overlay) { state.overlay.remove(); state.overlay = null; }
    if (state.highlight) { state.highlight.remove(); state.highlight = null; }
    if (state.label) { state.label.remove(); state.label = null; }
    if (state.statusBar) { state.statusBar.remove(); state.statusBar = null; }
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
  // UI UPDATES
  // ========================================

  function updateHighlight(el) {
    if (!state.highlight) return;

    if (!el || el === document.body || el === document.documentElement) {
      state.highlight.style.display = 'none';
      state.label.style.display = 'none';
      updateStatusBar(null);
      return;
    }

    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      state.highlight.style.display = 'none';
      state.label.style.display = 'none';
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
  }

  function updateLabel(el, rect) {
    if (!state.label) return;

    var selector = S.getShortSelector(el);
    var dims = Math.round(rect.width) + 'x' + Math.round(rect.height);
    var action = E.getPredictedAction(el);
    var dest = E.getDestination(el);
    var text = S.getText(el, 50);

    var content = '<span class="selector">' + selector + '</span><span class="dimensions">' + dims + '</span>';

    if (dest && dest.display) {
      content += '<span class="destination"> -> ' + dest.display + '</span>';
    } else if (action) {
      content += '<span class="destination"> -> ' + action + '</span>';
    }

    if (text) {
      content += '<span class="text-preview">"' + text + '"</span>';
    }

    state.label.innerHTML = content;
    state.label.style.display = 'block';

    // Position label
    var labelRect = state.label.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var left = rect.left;
    var top = rect.bottom + 8;

    if (top + labelRect.height > vh - 10) {
      top = rect.top - labelRect.height - 8;
    }
    if (top < 10) top = 10;
    if (left + labelRect.width > vw - 10) {
      left = vw - labelRect.width - 10;
    }
    if (left < 10) left = 10;

    state.label.style.left = left + 'px';
    state.label.style.top = top + 'px';
  }

  function updateStatusBar(el) {
    var info = document.getElementById('precision-element-info');
    if (!info) return;

    if (!el) {
      info.textContent = 'Hover to inspect';
      return;
    }

    var selector = S.getShortSelector(el);
    var rect = el.getBoundingClientRect();
    var dims = Math.round(rect.width) + 'x' + Math.round(rect.height);
    info.textContent = selector + ' | ' + dims;
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  function onMouseMove(e) {
    if (!state.active) return;

    var now = Date.now();
    if (now - state.lastMoveTime < TIMING.throttleMs) return;
    state.lastMoveTime = now;

    // Must use setProperty with 'important' to override CSS !important
    if (state.overlay) state.overlay.style.setProperty('pointer-events', 'none', 'important');
    if (state.highlight) state.highlight.style.setProperty('display', 'none', 'important');
    if (state.label) state.label.style.setProperty('display', 'none', 'important');
    if (state.statusBar) state.statusBar.style.setProperty('display', 'none', 'important');

    var el = document.elementFromPoint(e.clientX, e.clientY);

    // Restore UI elements
    if (state.overlay) state.overlay.style.setProperty('pointer-events', 'auto', 'important');
    if (state.highlight) state.highlight.style.setProperty('display', 'block', 'important');
    if (state.label) state.label.style.setProperty('display', 'block', 'important');
    if (state.statusBar) state.statusBar.style.setProperty('display', 'flex', 'important');

    // Skip our UI elements (className can be SVGAnimatedString, so use getAttribute)
    if (el) {
      var classStr = el.getAttribute ? el.getAttribute('class') : '';
      if (classStr && classStr.indexOf('dom-extractor') !== -1) {
        console.log('[DOMExtractor] Skipping our own element:', classStr);
        return;
      }
    }

    if (el === state.hoveredElement) return;

    console.log('[DOMExtractor] Detected element:', el ? el.tagName : null, el);
    state.hoveredElement = el;

    if (!state.rafPending) {
      state.rafPending = true;
      requestAnimationFrame(function() {
        state.rafPending = false;
        updateHighlight(state.hoveredElement);
      });
    }
  }

  function onClick(e) {
    if (!state.active) return;

    e.preventDefault();
    e.stopPropagation();

    if (!state.hoveredElement) {
      showToast('No element selected', 'info', TIMING.toastDurationMs);
      return;
    }

    captureElement(state.hoveredElement);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }
  }

  function attachEventListeners() {
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function removeEventListeners() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  // ========================================
  // NETWORK INTERCEPTION
  // ========================================

  function sanitizeUrl(url) {
    try {
      var u = new URL(url, window.location.origin);
      SENSITIVE_PARAMS.forEach(function(param) {
        u.searchParams.delete(param);
      });
      return u.pathname + (u.search || '');
    } catch (e) {
      return '[url]';
    }
  }

  function setupNetworkInterception() {
    try {
      state.originalFetch = window.fetch;
      state.originalXHROpen = XMLHttpRequest.prototype.open;
      state.originalXHRSend = XMLHttpRequest.prototype.send;

      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input.url || '');
        var method = (init && init.method) ? init.method.toUpperCase() : 'GET';

        var entry = {
          type: 'fetch',
          method: method,
          url: sanitizeUrl(url),
          timestamp: Date.now(),
          status: null,
          duration: null
        };

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
            entry.duration = Date.now() - entry.timestamp;
            throw error;
          });
      };

      XMLHttpRequest.prototype.open = function(method, url) {
        this._domExtractorEntry = {
          type: 'xhr',
          method: method.toUpperCase(),
          url: sanitizeUrl(url),
          timestamp: Date.now(),
          status: null,
          duration: null
        };
        if (state.networkLog.length >= LIMITS.maxNetworkEntries) {
          state.networkLog.shift();
        }
        state.networkLog.push(this._domExtractorEntry);
        return state.originalXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function() {
        var entry = this._domExtractorEntry;
        var xhr = this;
        if (entry) {
          this.addEventListener('loadend', function() {
            entry.status = xhr.status || 'error';
            entry.duration = Date.now() - entry.timestamp;
          });
        }
        return state.originalXHRSend.apply(this, arguments);
      };
    } catch (e) {
      // Network interception failed
    }
  }

  function restoreNetworkInterception() {
    try {
      if (state.originalFetch) window.fetch = state.originalFetch;
      if (state.originalXHROpen) XMLHttpRequest.prototype.open = state.originalXHROpen;
      if (state.originalXHRSend) XMLHttpRequest.prototype.send = state.originalXHRSend;
    } catch (e) {}
  }

  // ========================================
  // OUTPUT BUILDING
  // ========================================

  function getBoxModel(el) {
    try {
      var cs = window.getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      return {
        content: Math.round(parseFloat(cs.width)) + 'x' + Math.round(parseFloat(cs.height)),
        padding: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
        border: cs.borderTopWidth + ' ' + cs.borderRightWidth + ' ' + cs.borderBottomWidth + ' ' + cs.borderLeftWidth,
        margin: cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft,
        total: Math.round(rect.width) + 'x' + Math.round(rect.height),
        boxSizing: cs.boxSizing
      };
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
        if (current.id) selector += '#' + current.id;
        path.unshift(selector);
        current = current.parentElement;
      }
      return { path: path.join(' > '), depth: path.length };
    } catch (e) {
      return { path: '', depth: 0 };
    }
  }

  function formatOutput(el) {
    var lines = [];
    var now = new Date().toISOString();
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var divider = '+-----------------------------------------------------------------';

    lines.push(divider);
    lines.push('| PRECISION EXTRACT');
    lines.push('| url: ' + sanitizeUrl(window.location.href));
    lines.push('| viewport: ' + window.innerWidth + 'x' + window.innerHeight + '  scroll: ' + Math.round(scrollX) + ',' + Math.round(scrollY));
    lines.push('| mode: precision-hover');
    lines.push('| captured: ' + now);
    lines.push(divider);

    lines.push('| SELECTED ELEMENT');
    lines.push('| tag: ' + S.getShortSelector(el));
    var text = S.getText(el, 50);
    if (text) lines.push('| text: "' + text + '"');
    lines.push('| selector: ' + S.getUniqueSelector(el));
    lines.push(divider);

    var domPath = getDOMPath(el);
    lines.push('| DOM PATH');
    lines.push('| ' + domPath.path);
    lines.push('| depth: ' + domPath.depth);
    lines.push(divider);

    var boxModel = getBoxModel(el);
    if (boxModel.content) {
      lines.push('| BOX MODEL');
      lines.push('|--- content: ' + boxModel.content);
      lines.push('|--- padding: ' + boxModel.padding);
      lines.push('|--- border: ' + boxModel.border);
      lines.push('|--- margin: ' + boxModel.margin);
      lines.push('|--- total: ' + boxModel.total);
      lines.push('|--- box-sizing: ' + boxModel.boxSizing);
      lines.push(divider);
    }

    var posInfo = P.getPositionInfo(el);
    if (posInfo.viewport) {
      lines.push('| POSITION');
      lines.push('|--- viewport: ' + posInfo.viewport.left + ',' + posInfo.viewport.top + ' (' + posInfo.viewport.width + 'x' + posInfo.viewport.height + ')');
      if (posInfo.page) lines.push('|--- page: ' + posInfo.page.left + ',' + posInfo.page.top);
      if (posInfo.inParent) {
        lines.push('|--- in-parent: ' + posInfo.inParent.leftPct + '%, ' + posInfo.inParent.topPct + '% of ' + posInfo.inParent.selector);
      }
      lines.push(divider);
    }

    var visual = E.getVisualInfo(el);
    if (Object.keys(visual).length > 0) {
      lines.push('| VISUAL');
      for (var vk in visual) {
        if (visual.hasOwnProperty(vk)) lines.push('|--- ' + vk + ': ' + visual[vk]);
      }
      lines.push(divider);
    }

    var semantic = E.getSemanticInfo(el);
    if (Object.keys(semantic).length > 0) {
      lines.push('| SEMANTIC');
      for (var sk in semantic) {
        if (semantic.hasOwnProperty(sk) && sk !== 'data') lines.push('|--- ' + sk + ': ' + semantic[sk]);
      }
      lines.push(divider);
    }

    var interactive = E.hasInteractivity(el);
    if (interactive.length > 0) {
      lines.push('| INTERACTIVE');
      lines.push('|--- ' + interactive.join(', '));
      lines.push(divider);
    }

    var action = E.getPredictedAction(el);
    if (action) {
      lines.push('| PREDICTED ACTION');
      lines.push('|--- ' + action);
      lines.push(divider);
    }

    var dest = E.getDestination(el);
    if (dest) {
      lines.push('| DESTINATION');
      lines.push('|--- type: ' + dest.type);
      if (dest.url) lines.push('|--- url: ' + dest.url);
      if (dest.display) lines.push('|--- display: ' + dest.display);
      if (dest.method) lines.push('|--- method: ' + dest.method);
      lines.push(divider);
    }

    var formCtx = E.getFormContext(el);
    if (formCtx && formCtx.inForm) {
      lines.push('| FORM CONTEXT');
      if (formCtx.formId) lines.push('|--- form-id: ' + formCtx.formId);
      if (formCtx.formAction) lines.push('|--- action: ' + formCtx.formAction);
      if (formCtx.formMethod) lines.push('|--- method: ' + formCtx.formMethod);
      lines.push(divider);
    }

    if (state.networkLog.length > 0) {
      lines.push('| NETWORK CONTEXT (' + state.networkLog.length + ' requests)');
      state.networkLog.forEach(function(req, i) {
        var duration = req.duration ? req.duration + 'ms' : 'pending';
        lines.push('|--- ' + (i + 1) + '. ' + req.method + ' ' + req.url + ' -> ' + (req.status || 'pending') + ' (' + duration + ')');
      });
      lines.push(divider);
    }

    var duration = Date.now() - state.startTime;
    lines.push('| INSPECTOR ACTIVE: ' + (duration / 1000).toFixed(1) + 's');
    lines.push(divider);

    return lines.join('\n');
  }

  // ========================================
  // CAPTURE
  // ========================================

  function flashHighlight() {
    if (!state.highlight) return;
    state.highlight.classList.add('captured');
    setTimeout(function() {
      if (state.highlight) state.highlight.classList.remove('captured');
    }, TIMING.flashDurationMs);
  }

  function copyToClipboard(text, callback) {
    function fallback() {
      try {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        var success = document.execCommand('copy');
        textarea.remove();
        return success;
      } catch (e) {
        return false;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { callback(true); })
        .catch(function() { callback(fallback()); });
    } else {
      callback(fallback());
    }
  }

  function captureElement(el) {
    flashHighlight();

    var output = formatOutput(el);

    copyToClipboard(output, function(success) {
      if (success) {
        showToast('Copied to clipboard', 'success', TIMING.toastDurationMs);

        chrome.runtime.sendMessage({
          action: 'extraction-complete',
          mode: 'precision',
          elementCount: 1,
          url: window.location.pathname
        });
      } else {
        showToast('Copy failed', 'error', TIMING.toastDurationMs);
      }

      setTimeout(deactivate, 200);
    });
  }

  // ========================================
  // EXPORT
  // ========================================

  window.DOMExtractor.precisionMode = {
    activate: activate,
    deactivate: deactivate,
    isActive: function() { return state.active; }
  };

  console.log('[DOMExtractor] Precision mode module exported:', !!window.DOMExtractor.precisionMode);

})(window);
