// DOM Extractor - Extractors Module
// All DOM data extraction functions

(function(window) {
  'use strict';

  console.log('[DOMExtractor] Extractors module loading...');

  // Create namespace
  window.DOMExtractor = window.DOMExtractor || {};

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  function arrayIndexOf(arr, item) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === item) return i;
    }
    return -1;
  }

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

  function getSafeHref(el) {
    var rawHref = el.href;
    if (!rawHref) return '';
    if (typeof rawHref === 'string') return rawHref;
    if (rawHref.baseVal) return rawHref.baseVal;
    return '';
  }

  function getSafeType(el) {
    var rawType = el.type;
    if (!rawType) return '';
    if (typeof rawType === 'string') return rawType.toLowerCase();
    if (rawType.baseVal) return rawType.baseVal.toLowerCase();
    return '';
  }

  function getSafeClassName(el) {
    var rawClass = el.className;
    if (!rawClass) return '';
    if (typeof rawClass === 'string') return rawClass;
    if (rawClass.baseVal) return rawClass.baseVal;
    return '';
  }

  // ========================================
  // SELECTOR HELPERS
  // ========================================

  function getShortSelector(el) {
    try {
      var selector = el.tagName ? el.tagName.toLowerCase() : 'unknown';
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

  function getText(el, maxLength) {
    maxLength = maxLength || 200;
    try {
      var text = '';
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
          text += el.childNodes[i].textContent;
        }
      }
      if (!text.trim()) {
        text = el.textContent || '';
      }
      if (text.length > 10000) {
        text = text.substring(0, 10000);
      }
      var cleaned = text.replace(/\s+/g, ' ').trim();
      if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + '...';
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
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var scrollX = window.scrollX || window.pageXOffset;
      var scrollY = window.scrollY || window.pageYOffset;
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

      if (cs.display === 'none') info.hidden = 'display:none';
      else if (cs.visibility === 'hidden') info.hidden = 'visibility:hidden';
      else if (parseFloat(cs.opacity) === 0) info.hidden = 'opacity:0';

      var opacity = parseFloat(cs.opacity);
      if (opacity < 1 && opacity > 0) info.opacity = opacity.toFixed(2);

      var bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        info.background = bg;
      }
      var color = cs.color;
      if (color) info.color = color;

      var fontFamily = cs.fontFamily || '';
      info.font = cs.fontSize + ' ' + (typeof fontFamily === 'string' ? fontFamily.split(',')[0].replace(/['"]/g, '') : '');
      if (cs.fontWeight !== '400' && cs.fontWeight !== 'normal') {
        info.fontWeight = cs.fontWeight;
      }

      if (cs.cursor !== 'auto' && cs.cursor !== 'default') {
        info.cursor = cs.cursor;
      }

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

      var br = cs.borderRadius;
      if (br && br !== '0px') info.borderRadius = br;

      var boxShadow = cs.boxShadow;
      if (boxShadow && boxShadow !== 'none') info.shadow = 'yes';

      var padding = cs.padding;
      if (padding && padding !== '0px') info.padding = padding;
      var margin = cs.margin;
      if (margin && margin !== '0px') info.margin = margin;

      if (cs.display === 'flex') {
        info.layout = 'flex';
        info.flexDirection = cs.flexDirection;
        if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') info.gap = cs.gap;
      } else if (cs.display === 'grid') {
        info.layout = 'grid';
        if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') info.gap = cs.gap;
      }

      if (cs.position !== 'static') {
        info.position = cs.position;
      }

      var transition = cs.transition;
      if (transition && transition !== 'none' && transition !== 'all 0s ease 0s') {
        info.animated = 'yes';
      }

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

      if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
        state.disabled = true;
      }

      if (el.checked) state.checked = true;
      if (el.selected) state.selected = true;
      if (el.getAttribute('aria-checked') === 'true') state.checked = true;
      if (el.getAttribute('aria-selected') === 'true') state.selected = true;

      var expanded = el.getAttribute('aria-expanded');
      if (expanded) state.expanded = expanded === 'true';

      if (document.activeElement === el) state.focused = true;

      if (el.required || el.getAttribute('aria-required') === 'true') {
        state.required = true;
      }

      if (el.validity && !el.validity.valid) state.invalid = true;
      if (el.getAttribute('aria-invalid') === 'true') state.invalid = true;

      if (el.readOnly) state.readonly = true;

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

      var role = el.getAttribute('role');
      if (role) info.role = role;

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

      if (el.id) {
        var label = document.querySelector('label[for="' + el.id + '"]');
        if (label) info.label = getText(label);
      }

      if (el.title) info.title = el.title;
      if (el.alt) info.alt = el.alt;

      var href = getSafeHref(el);
      if (href) {
        try {
          var url = new URL(href);
          info.href = url.origin + url.pathname;
        } catch (e2) {
          info.href = href.split('?')[0];
        }
      }

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

      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (['a', 'button', 'input', 'select', 'textarea'].indexOf(tag) !== -1) {
        interactive.push('native-' + tag);
      }

      if (el.tabIndex >= 0) interactive.push('focusable');

      if (el.onclick) interactive.push('onclick');

      var cs = window.getComputedStyle(el);
      if (cs.cursor === 'pointer') interactive.push('pointer');

      var role = el.getAttribute('role');
      if (role && ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option'].indexOf(role) !== -1) {
        interactive.push('role-' + role);
      }

      if (el.contentEditable === 'true') interactive.push('editable');

      if (el.draggable) interactive.push('draggable');

      return interactive;
    } catch (e) {
      return [];
    }
  }

  // ========================================
  // CONTEXT EXTRACTORS
  // ========================================

  function getScrollContext(el) {
    try {
      var context = {};
      var rect = el.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;

      context.inViewport = rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;

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

        var inputs = form.querySelectorAll('input, select, textarea');
        context.formFields = inputs.length;

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

  function getListContext(el) {
    try {
      var context = {};
      var listItem = el.closest('li');
      if (listItem) {
        var list = listItem.closest('ul, ol');
        if (list) {
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

  function getModalContext(el) {
    try {
      var context = {};

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

      if (tag === 'button' && type === 'submit') return 'submit-form';
      if (tag === 'input' && type === 'submit') return 'submit-form';
      if (tag === 'form') return 'container-form';

      var hrefStr = getSafeHref(el);
      if (tag === 'a' && hrefStr) {
        if (hrefStr.indexOf('#') !== -1) return 'scroll-to-anchor';
        if (el.target === '_blank') return 'open-new-tab';
        return 'navigate';
      }

      if (el.getAttribute('aria-expanded') !== null) return 'toggle-expand';
      if (el.getAttribute('aria-pressed') !== null) return 'toggle-press';
      if (role === 'checkbox' || type === 'checkbox') return 'toggle-check';
      if (role === 'switch') return 'toggle-switch';
      if (role === 'radio' || type === 'radio') return 'select-option';

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

      if (tag === 'video') return 'video-player';
      if (tag === 'audio') return 'audio-player';
      if (tag === 'img') return 'image';

      if (role === 'tab') return 'switch-tab';
      if (role === 'tabpanel') return 'tab-content';

      if (role === 'menuitem') return 'menu-action';
      if (role === 'menu' || role === 'menubar') return 'menu-container';

      if (tag === 'button' || role === 'button') return 'click-action';

      var cs = window.getComputedStyle(el);
      if (cs.cursor === 'pointer') return 'click-action';

      return null;
    } catch (e) {
      return null;
    }
  }

  // ========================================
  // DESTINATION DETECTION (for precision mode)
  // ========================================

  function getDestination(el) {
    try {
      var dest = {};
      var tag = el.tagName ? el.tagName.toLowerCase() : '';

      // Direct href
      var href = getSafeHref(el);
      if (href) {
        dest.type = 'link';
        try {
          var url = new URL(href, window.location.origin);
          if (url.origin !== window.location.origin) {
            dest.display = url.hostname + url.pathname;
            dest.external = true;
          } else {
            dest.display = url.pathname;
          }
          if (href.indexOf('#') !== -1 && href.indexOf(window.location.pathname) !== -1) {
            dest.type = 'anchor';
            dest.display = href.split('#')[1];
          }
        } catch (e) {
          dest.display = href.split('?')[0];
        }
        dest.url = href;
        return dest;
      }

      // Form action
      var formAction = el.getAttribute('formaction');
      if (formAction) {
        dest.type = 'form-action';
        dest.url = formAction;
        dest.display = formAction.split('?')[0] + ' [' + (el.getAttribute('formmethod') || 'POST').toUpperCase() + ']';
        return dest;
      }

      // Closest form
      var form = el.closest('form');
      if (form && (tag === 'button' || (tag === 'input' && getSafeType(el) === 'submit'))) {
        dest.type = 'form-action';
        dest.url = form.action || window.location.pathname;
        dest.method = (form.method || 'GET').toUpperCase();
        try {
          var formUrl = new URL(dest.url, window.location.origin);
          dest.display = formUrl.pathname + ' [' + dest.method + ']';
        } catch (e) {
          dest.display = dest.url.split('?')[0] + ' [' + dest.method + ']';
        }
        return dest;
      }

      // Data attributes
      var dataHref = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
      if (dataHref) {
        dest.type = 'data-link';
        dest.url = dataHref;
        dest.display = dataHref.split('?')[0];
        return dest;
      }

      // Router attributes (Next.js, React Router, etc.)
      var routerTo = el.getAttribute('to') || el.getAttribute('href');
      if (routerTo && tag !== 'a') {
        dest.type = 'router-link';
        dest.url = routerTo;
        dest.display = routerTo;
        return dest;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // ========================================
  // LOADING STATE
  // ========================================

  function getLoadingState(el) {
    var state = {};

    try {
      var loadingPatterns = ['loading', 'spinner', 'skeleton', 'shimmer', 'pending'];
      var classStr = getSafeClassName(el);
      if (classStr.length > 1000) classStr = classStr.substring(0, 1000);
      var ariaLabel = el.getAttribute('aria-label') || '';
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

      var errorPatterns = ['error', 'invalid', 'danger', 'alert'];
      for (var j = 0; j < errorPatterns.length; j++) {
        if (classLower.indexOf(errorPatterns[j]) !== -1) {
          state.hasError = true;
          break;
        }
      }

      if (el.getAttribute('aria-invalid') === 'true') {
        state.hasError = true;
      }

      var errorMsg = el.parentElement ? el.parentElement.querySelector('.error, .error-message, [role="alert"], .invalid-feedback') : null;
      if (errorMsg) {
        state.errorMessage = getText(errorMsg);
      }
    } catch (e) {}

    return state;
  }

  // ========================================
  // VISIBILITY DETAILS
  // ========================================

  function getVisibilityDetails(el) {
    try {
      var details = {};
      var rect = el.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;

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
  // FORMAT HELPERS
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
  // EXPORT TO NAMESPACE
  // ========================================

  window.DOMExtractor.helpers = {
    arrayIndexOf: arrayIndexOf,
    SimpleSet: SimpleSet,
    getSafeHref: getSafeHref,
    getSafeType: getSafeType,
    getSafeClassName: getSafeClassName
  };

  window.DOMExtractor.selectors = {
    getShortSelector: getShortSelector,
    getUniqueSelector: getUniqueSelector,
    getText: getText
  };

  window.DOMExtractor.position = {
    getRegionName: getRegionName,
    getPositionInfo: getPositionInfo
  };

  window.DOMExtractor.extractors = {
    getVisualInfo: getVisualInfo,
    getDesignInfo: getDesignInfo,
    getInteractiveState: getInteractiveState,
    getInputConstraints: getInputConstraints,
    getSemanticInfo: getSemanticInfo,
    hasInteractivity: hasInteractivity,
    getScrollContext: getScrollContext,
    getPseudoContent: getPseudoContent,
    getFormContext: getFormContext,
    getTableContext: getTableContext,
    getListContext: getListContext,
    getLandmarkContext: getLandmarkContext,
    getModalContext: getModalContext,
    getSiblingContext: getSiblingContext,
    getParentHierarchy: getParentHierarchy,
    getPredictedAction: getPredictedAction,
    getDestination: getDestination,
    getLoadingState: getLoadingState,
    getVisibilityDetails: getVisibilityDetails
  };

  window.DOMExtractor.format = {
    formatObject: formatObject
  };

  console.log('[DOMExtractor] Extractors module loaded successfully', {
    helpers: Object.keys(window.DOMExtractor.helpers),
    selectors: Object.keys(window.DOMExtractor.selectors),
    position: Object.keys(window.DOMExtractor.position),
    extractors: Object.keys(window.DOMExtractor.extractors),
    format: Object.keys(window.DOMExtractor.format)
  });

})(window);
