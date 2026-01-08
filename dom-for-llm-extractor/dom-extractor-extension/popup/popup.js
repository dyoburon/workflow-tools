// Popup script for DOM Extractor

document.addEventListener('DOMContentLoaded', () => {
  // Mode buttons
  document.getElementById('drag-mode').addEventListener('click', () => {
    activateMode('drag');
  });

  document.getElementById('precision-mode').addEventListener('click', () => {
    activateMode('precision');
  });

  // Update shortcut display based on platform
  updateShortcutDisplay();
});

function activateMode(mode) {
  chrome.runtime.sendMessage({ action: 'activate-mode-from-popup', mode }, () => {
    // Close popup after activation
    window.close();
  });
}

function updateShortcutDisplay() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  document.querySelectorAll('.shortcut').forEach((el) => {
    if (isMac && el.dataset.mac) {
      el.textContent = el.dataset.mac;
    } else if (el.dataset.default) {
      el.textContent = el.dataset.default;
    }
  });
}
