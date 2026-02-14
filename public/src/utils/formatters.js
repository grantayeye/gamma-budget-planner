// ============================================================
// FORMATTING UTILITIES
// ============================================================

/**
 * Format a number as currency
 * @param {number} n - Number to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(n) {
  if (n === null || n === undefined) return '$0';
  if (n < 0) return '-$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  return '$' + Math.round(n).toLocaleString('en-US');
}

/**
 * Format a date to local string
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date with time
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date and time
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelative(dateStr) {
  if (!dateStr) return 'Never';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

/**
 * Generate a random code
 * @param {number} length - Length of code
 * @returns {string} Random alphanumeric code
 */
export function generateCode(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
