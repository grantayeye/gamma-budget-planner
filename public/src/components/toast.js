// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

let toastEl = null;
let timer = null;

/**
 * Initialize toast element
 */
export function initToast() {
  if (!toastEl) {
    toastEl = document.getElementById('toast');
  }
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showToast(message, duration = 3000) {
  initToast();
  
  if (!toastEl) {
    console.warn('Toast element not found');
    return;
  }
  
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
}

/**
 * Hide the toast immediately
 */
export function hideToast() {
  initToast();
  if (toastEl) {
    toastEl.classList.remove('visible');
  }
  clearTimeout(timer);
}
