const DEFAULT_CUSTOM_TIER = Object.freeze({
  enabled: true,
  label: 'Budget Allowance',
  price: 0,
  features: [],
  brands: ''
});

function ensureCustomCategoryTier(category = {}) {
  const tiers = category.tiers && typeof category.tiers === 'object' && !Array.isArray(category.tiers)
    ? category.tiers
    : {};
  if (Object.keys(tiers).length > 0) return { ...category, tiers };
  return {
    ...category,
    tiers: { good: { ...DEFAULT_CUSTOM_TIER } }
  };
}

module.exports = { DEFAULT_CUSTOM_TIER, ensureCustomCategoryTier };
