(function() {
  // Prevent multiple instances
  if (document.getElementById('page-measure-overlay')) {
    document.getElementById('page-measure-overlay').remove();
    return;
  }

  let startX, startY, box;

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

  // Create selection box
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

  // Show toast notification
  function showToast(message) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#333',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // Mouse handlers
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

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    Object.assign(box.style, {
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px'
    });
  }

  function onMouseUp(e) {
    if (!box) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Format dimensions
    const result = `top: ${Math.round(top)}px; left: ${Math.round(left)}px; width: ${Math.round(width)}px; height: ${Math.round(height)}px;`;

    // Copy to clipboard
    navigator.clipboard.writeText(result).then(() => {
      showToast('Copied: ' + result);
    }).catch(() => {
      showToast('Failed to copy');
    });

    // Cleanup
    overlay.remove();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      overlay.remove();
    }
  }

  // Attach events
  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  // Add to page
  document.body.appendChild(overlay);
})();
