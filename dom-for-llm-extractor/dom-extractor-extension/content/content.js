// DOM Extractor - Content Script Orchestrator
// Handles messages from background script and coordinates modes

(function() {
  'use strict';

  console.log('[DOMExtractor] Content script loading...');

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[DOMExtractor] Content script init, DOMExtractor object:', {
      exists: !!window.DOMExtractor,
      dragMode: !!(window.DOMExtractor && window.DOMExtractor.dragMode),
      precisionMode: !!(window.DOMExtractor && window.DOMExtractor.precisionMode)
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      console.log('[DOMExtractor] Received message:', message);

      if (message.action === 'activate-drag-mode') {
        activateDragMode();
        sendResponse({ success: true });
      } else if (message.action === 'activate-precision-mode') {
        activatePrecisionMode();
        sendResponse({ success: true });
      }
      return true;
    });

    console.log('[DOMExtractor] Message listener registered');
  }

  function activateDragMode() {
    // Deactivate precision mode if active
    if (window.DOMExtractor && window.DOMExtractor.precisionMode && window.DOMExtractor.precisionMode.isActive()) {
      window.DOMExtractor.precisionMode.deactivate();
    }

    // Activate drag mode
    if (window.DOMExtractor && window.DOMExtractor.dragMode) {
      window.DOMExtractor.dragMode.activate();
    }
  }

  function activatePrecisionMode() {
    console.log('[DOMExtractor] activatePrecisionMode() called');
    console.log('[DOMExtractor] precisionMode exists?', !!(window.DOMExtractor && window.DOMExtractor.precisionMode));

    // Deactivate drag mode if active
    if (window.DOMExtractor && window.DOMExtractor.dragMode && window.DOMExtractor.dragMode.isActive()) {
      window.DOMExtractor.dragMode.deactivate();
    }

    // Activate precision mode
    if (window.DOMExtractor && window.DOMExtractor.precisionMode) {
      console.log('[DOMExtractor] Calling precisionMode.activate()');
      window.DOMExtractor.precisionMode.activate();
    } else {
      console.error('[DOMExtractor] precisionMode not found!', window.DOMExtractor);
    }
  }
})();
