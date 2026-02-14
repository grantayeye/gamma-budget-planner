// ============================================================
// API CLIENT
// ============================================================

// Detect base path for reverse proxy / Tailscale
const BASE_PATH = (() => {
  const path = window.location.pathname;
  const match = path.match(/^(\/[^\/]+)/);
  if (match && match[1] !== '/budget' && match[1] !== '/b' && !path.startsWith('/api')) {
    return match[1];
  }
  return '';
})();

/**
 * Build API URL
 * @param {string} endpoint - API endpoint
 * @returns {string} Full URL
 */
export function api(endpoint) {
  return BASE_PATH + endpoint;
}

/**
 * Make an API request with error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export async function request(endpoint, options = {}) {
  const url = api(endpoint);
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      // Handle specific status codes
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:required'));
      }
      if (response.status === 429) {
        window.dispatchEvent(new CustomEvent('rate:limited'));
      }
      
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new APIError(error.error || `HTTP ${response.status}`, response.status, error.details);
    }
    
    return response.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    if (err.name === 'TypeError' && !navigator.onLine) {
      throw new APIError('You are offline. Please check your connection.', 'OFFLINE');
    }
    throw new APIError(err.message || 'Network error', 'NETWORK');
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Safe API call wrapper with error handling
 * @param {Function} fn - API function to call
 * @param {Object} errorHandlers - Optional error handlers
 */
export async function safeCall(fn, errorHandlers = {}) {
  try {
    return await fn();
  } catch (err) {
    if (errorHandlers[err.code]) {
      return errorHandlers[err.code](err);
    }
    if (errorHandlers.onError) {
      return errorHandlers.onError(err);
    }
    throw err;
  }
}

// Budget API
export const budgets = {
  create: (data) => request('/api/budgets', { method: 'POST', body: data }),
  get: (id) => request(`/api/budgets/${id}`),
  update: (id, data) => request(`/api/budgets/${id}`, { method: 'PUT', body: data })
};

// Auth API
export const auth = {
  login: (username, password) => request('/api/auth/login', { 
    method: 'POST', 
    body: { username, password } 
  }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me')
};

// Short links API
export const links = {
  create: (data) => request('/api/shorten', { method: 'POST', body: data }),
  list: () => request('/api/links')
};

// Email API
export const email = {
  send: (data) => request('/api/send-proposal', { method: 'POST', body: data })
};

// Debug logging
export function debug(data) {
  return request('/api/debug', { method: 'POST', body: data });
}
