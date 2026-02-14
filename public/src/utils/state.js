// ============================================================
// APPLICATION STATE
// ============================================================

import { deepClone } from './formatters.js';

// Default state
export const defaultState = {
  selections: {},
  extras: {},
  modifiers: [],
  catMods: {},
  homeSize: 4000,
  propertyType: 'residential'
};

// Current state
let state = deepClone(defaultState);

// State change listeners
const listeners = new Set();

/**
 * Get current state (clone)
 * @returns {Object} Current state
 */
export function getState() {
  return deepClone(state);
}

/**
 * Get a specific state value
 * @param {string} key - State key
 * @returns {any} State value
 */
export function get(key) {
  return deepClone(state[key]);
}

/**
 * Set state value
 * @param {string} key - State key
 * @param {any} value - New value
 */
export function set(key, value) {
  state[key] = deepClone(value);
  notify();
}

/**
 * Update multiple state values
 * @param {Object} updates - Key-value pairs to update
 */
export function update(updates) {
  Object.assign(state, deepClone(updates));
  notify();
}

/**
 * Replace entire state
 * @param {Object} newState - New state object
 */
export function replace(newState) {
  state = deepClone(newState);
  notify();
}

/**
 * Subscribe to state changes
 * @param {Function} fn - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notify all listeners of state change
 */
function notify() {
  const snapshot = getState();
  listeners.forEach(fn => {
    try {
      fn(snapshot);
    } catch (err) {
      console.error('State listener error:', err);
    }
  });
}

/**
 * Initialize state for a property type
 * @param {Array} categories - Available categories
 * @param {Array} extras - Available extras
 */
export function initStateForConfig(categories, extras) {
  categories.forEach(c => {
    if (!(c.id in state.selections)) state.selections[c.id] = null;
    if (!(c.id in state.catMods)) state.catMods[c.id] = { name: '', amount: 0 };
  });
  
  extras.forEach(e => {
    if (!(e.id in state.extras)) state.extras[e.id] = e.default;
  });
}

/**
 * Reset state to defaults
 */
export function reset() {
  state = deepClone(defaultState);
  notify();
}

/**
 * Get state for API submission
 * @param {Object} options - Additional options
 * @returns {Object} State for API
 */
export function getStateForAPI(options = {}) {
  const { clientName, homeSize, propertyType, total } = options;
  
  return {
    selections: { ...state.selections },
    extras: { ...state.extras },
    modifiers: [...state.modifiers],
    catMods: { ...state.catMods },
    homeSize: homeSize || state.homeSize,
    propertyType: propertyType || state.propertyType,
    clientName: clientName || null,
    total: total || 0
  };
}

// Budget ID for live budgets
let currentBudgetId = null;

export function getBudgetId() {
  return currentBudgetId;
}

export function setBudgetId(id) {
  currentBudgetId = id;
}

// Customization state
let isCustomized = false;
let customConfig = null;
let customCats = null;

export function setCustomization(config, categories) {
  isCustomized = true;
  customConfig = config;
  customCats = categories;
}

export function isCustomizedBudget() {
  return isCustomized;
}

export function getCustomConfig() {
  return customConfig;
}

export function getCustomCategories() {
  return customCats;
}

export function clearCustomization() {
  isCustomized = false;
  customConfig = null;
  customCats = null;
}
