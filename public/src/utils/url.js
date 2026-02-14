// ============================================================
// URL STATE ENCODING/DECODING
// ============================================================

import { getState, update } from './state.js';

/**
 * Encode current state to URL parameters
 * @param {Object} options - Additional data to encode
 * @returns {string} URL-encoded string
 */
export function encodeState(options = {}) {
  const state = getState();
  const params = new URLSearchParams();
  
  // Project details
  if (options.clientName) params.set('client', options.clientName);
  if (options.builder) params.set('builder', options.builder);
  params.set('sqft', state.homeSize);
  params.set('prop', state.propertyType);
  
  // Category selections
  const sel = {};
  Object.entries(state.selections).forEach(([id, tier]) => {
    if (tier) sel[id] = tier;
  });
  if (Object.keys(sel).length > 0) {
    params.set('sel', JSON.stringify(sel));
  }
  
  // Extras
  const ext = {};
  Object.entries(state.extras).forEach(([id, val]) => {
    ext[id] = val;
  });
  if (Object.keys(ext).length > 0) {
    params.set('ext', JSON.stringify(ext));
  }
  
  // Modifiers
  if (state.modifiers.length > 0) {
    const mods = state.modifiers
      .filter(m => m.name || m.amount)
      .map(m => ({ n: m.name, a: m.amount }));
    if (mods.length > 0) {
      params.set('mods', JSON.stringify(mods));
    }
  }
  
  // Per-category adjustments
  const cm = {};
  Object.entries(state.catMods).forEach(([id, m]) => {
    if (m && (m.name || m.amount)) {
      cm[id] = { n: m.name, a: m.amount };
    }
  });
  if (Object.keys(cm).length > 0) {
    params.set('cm', JSON.stringify(cm));
  }
  
  return params.toString();
}

/**
 * Decode URL parameters and update state
 * @param {string} search - URL search string
 * @param {Object} options - Callbacks for field updates
 * @returns {boolean} Whether any state was loaded
 */
export function decodeState(search, options = {}) {
  const params = new URLSearchParams(search);
  let loaded = false;
  const updates = {};
  
  // Property type
  if (params.has('prop')) {
    const p = params.get('prop');
    if (['residential', 'condo'].includes(p)) {
      updates.propertyType = p;
      loaded = true;
    }
  }
  
  // Project details
  if (params.has('client') && options.onClientName) {
    options.onClientName(params.get('client'));
    loaded = true;
  }
  if (params.has('builder') && options.onBuilder) {
    options.onBuilder(params.get('builder'));
    loaded = true;
  }
  if (params.has('sqft')) {
    const sqft = parseInt(params.get('sqft'));
    if (sqft >= 1500 && sqft <= 20000) {
      updates.homeSize = sqft;
      loaded = true;
    }
  }
  
  // Category selections
  if (params.has('sel')) {
    try {
      const sel = JSON.parse(params.get('sel'));
      const validTiers = ['good', 'standard', 'better', 'best'];
      const selections = {};
      
      Object.entries(sel).forEach(([catId, tier]) => {
        if (validTiers.includes(tier)) {
          selections[catId] = tier;
          loaded = true;
        }
      });
      
      updates.selections = selections;
    } catch (e) {
      console.warn('Failed to parse selections from URL');
    }
  }
  
  // Extras
  if (params.has('ext')) {
    try {
      const ext = JSON.parse(params.get('ext'));
      updates.extras = ext;
      loaded = true;
    } catch (e) {
      console.warn('Failed to parse extras from URL');
    }
  }
  
  // Modifiers
  if (params.has('mods')) {
    try {
      const mods = JSON.parse(params.get('mods'));
      if (Array.isArray(mods)) {
        updates.modifiers = mods.map(m => ({
          name: String(m.n || ''),
          amount: parseFloat(m.a) || 0
        }));
        loaded = true;
      }
    } catch (e) {
      console.warn('Failed to parse modifiers from URL');
    }
  }
  
  // Per-category adjustments
  if (params.has('cm')) {
    try {
      const cm = JSON.parse(params.get('cm'));
      updates.catMods = {};
      Object.entries(cm).forEach(([catId, m]) => {
        updates.catMods[catId] = {
          name: String(m.n || ''),
          amount: parseFloat(m.a) || 0
        };
      });
      loaded = true;
    } catch (e) {
      console.warn('Failed to parse category mods from URL');
    }
  }
  
  if (Object.keys(updates).length > 0) {
    update(updates);
  }
  
  return loaded;
}
