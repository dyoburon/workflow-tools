// Background service worker for DOM Extractor extension

console.log('[DOMExtractor] Background service worker loaded');

// Inject scripts and activate mode
async function injectAndActivate(tabId, mode) {
  try {
    // First inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/styles.css']
    });

    // Then inject JS files in order
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'content/extractors.js',
        'content/drag-mode.js',
        'content/precision-mode.js',
        'content/content.js'
      ]
    });

    // Finally, activate the requested mode
    const action = mode === 'drag' ? 'activate-drag-mode' : 'activate-precision-mode';
    await chrome.tabs.sendMessage(tabId, { action });

    console.log('[DOMExtractor] Injected and activated', mode, 'mode on tab', tabId);
  } catch (err) {
    console.error('[DOMExtractor] Failed to inject scripts:', err);
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[DOMExtractor] *** COMMAND RECEIVED ***:', command);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    console.error('[DOMExtractor] No active tab found');
    return;
  }

  console.log('[DOMExtractor] Active tab:', tab.id, tab.url);

  // Skip chrome:// and other restricted URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('[DOMExtractor] Cannot run on restricted pages');
    return;
  }

  if (command === 'activate-drag-mode') {
    await injectAndActivate(tab.id, 'drag');
  } else if (command === 'activate-precision-mode') {
    await injectAndActivate(tab.id, 'precision');
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activate-mode-from-popup') {
    activateModeInCurrentTab(message.mode);
    sendResponse({ success: true });
  }
});

async function activateModeInCurrentTab(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    console.error('No active tab found');
    return;
  }

  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('Cannot run on restricted pages');
    return;
  }

  await injectAndActivate(tab.id, mode);
}
