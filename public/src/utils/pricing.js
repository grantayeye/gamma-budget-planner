// ============================================================
// PRICING CALCULATIONS
// ============================================================

/**
 * Calculate size multiplier based on square footage
 * @param {number} sqft - Home size in sq ft
 * @param {number} scaleFactor - How much this category scales with size
 * @returns {number} Multiplier
 */
export function getSizeMultiplier(sqft, scaleFactor) {
  if (scaleFactor === 0) return 1;
  
  const effectiveSqft = Math.max(sqft, 2500);
  const baseline = 4000;
  const ratio = effectiveSqft / baseline;
  
  return 1 + (ratio - 1) * scaleFactor;
}

/**
 * Calculate price for a category tier
 * @param {Object} cat - Category object
 * @param {string} tier - Tier name (good, better, best, etc.)
 * @param {number} homeSize - Home size in sq ft
 * @returns {number} Calculated price
 */
export function getCategoryPrice(cat, tier, homeSize = 4000) {
  if (!tier) return 0;
  
  const tierData = cat.tiers[tier];
  if (!tierData) return 0;
  
  const base = tierData.price;
  
  // If category is customized, use fixed price (no scaling)
  if (cat.isCustomized) {
    return base;
  }
  
  // Skip size scaling for base tier if category opts out
  const skipSize = cat.baseTierNoScale && tier === 'good';
  const scaleToUse = tierData.sizeScale !== undefined ? tierData.sizeScale : cat.sizeScale;
  const sizeMult = skipSize ? 1 : getSizeMultiplier(homeSize, scaleToUse);
  
  return Math.round(base * sizeMult / 100) * 100;
}

/**
 * Calculate price for an extra item
 * @param {Object} extra - Extra item object
 * @param {number} homeSize - Home size in sq ft
 * @returns {number} Calculated price
 */
export function getExtraPrice(extra, homeSize = 4000) {
  if (extra.sizeScale !== undefined) {
    const mult = getSizeMultiplier(homeSize, extra.sizeScale);
    return Math.round(extra.price * mult / 100) * 100;
  }
  return extra.price;
}

/**
 * Calculate total budget
 * @param {Object} params - Calculation parameters
 * @returns {Object} Breakdown of costs
 */
export function calculateTotal({
  categories,
  selections,
  extras,
  extrasData,
  modifiers,
  catMods,
  homeSize
}) {
  let subtotal = 0;
  let selectedCount = 0;
  
  // Category prices
  categories.forEach(cat => {
    const tier = selections[cat.id];
    if (tier) {
      subtotal += getCategoryPrice(cat, tier, homeSize);
      const mod = catMods[cat.id];
      if (mod?.amount) subtotal += mod.amount;
      selectedCount++;
    }
  });
  
  // Extras
  let extrasTotal = 0;
  extrasData.forEach(e => {
    if (extras[e.id]) {
      extrasTotal += getExtraPrice(e, homeSize);
    }
  });
  
  // Modifiers
  let modifiersTotal = 0;
  modifiers.forEach(m => {
    modifiersTotal += m.amount || 0;
  });
  
  const equipmentSubtotal = subtotal + extrasTotal + modifiersTotal;
  const taxEstimate = Math.round(equipmentSubtotal * 0.07);
  const grandTotal = equipmentSubtotal + taxEstimate;
  
  return {
    subtotal,
    extrasTotal,
    modifiersTotal,
    equipmentSubtotal,
    taxEstimate,
    grandTotal,
    selectedCount
  };
}

/**
 * Determine dominant tier for labeling
 * @param {Object} selections - Category selections
 * @returns {string} Dominant tier label
 */
export function getDominantTier(selections) {
  const tierCounts = { good: 0, standard: 0, better: 0, best: 0 };
  
  Object.values(selections).forEach(t => {
    if (t && tierCounts.hasOwnProperty(t)) {
      tierCounts[t]++;
    }
  });
  
  const maxCount = Math.max(...Object.values(tierCounts));
  if (maxCount === 0) return '';
  
  const dominant = Object.keys(tierCounts).find(k => tierCounts[k] === maxCount);
  const labels = {
    good: 'Good Tier',
    standard: 'Standard Tier',
    better: 'Better Tier',
    best: 'Best Tier'
  };
  
  return labels[dominant] || '';
}
