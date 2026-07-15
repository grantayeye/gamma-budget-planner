const { z } = require('zod');

const TIER_KEYS = ['good', 'standard', 'better', 'best'];

const aiTemplateSelectionSchema = z.object({
  categoryId: z.string().max(100),
  tierKey: z.enum(TIER_KEYS),
  required: z.boolean(),
  rationale: z.string().max(500)
});

const aiTierSchema = z.object({
  key: z.enum(TIER_KEYS),
  label: z.string().max(120),
  price: z.number().int().min(0).max(10000000),
  features: z.array(z.string().max(300)).max(30),
  brands: z.string().max(500)
});

const aiSectionSchema = z.object({
  source: z.enum(['library', 'custom']),
  sourceId: z.string().max(100),
  name: z.string().max(200),
  icon: z.string().max(20),
  header: z.string().max(120),
  required: z.boolean(),
  recommendedTier: z.enum(TIER_KEYS),
  rationale: z.string().max(500),
  tiers: z.array(aiTierSchema).min(1).max(4)
});

const aiBudgetDraftSchema = z.object({
  summary: z.string().max(1200),
  assumptions: z.array(z.string().max(500)).max(15),
  questions: z.array(z.string().max(500)).max(15),
  templateSelections: z.array(aiTemplateSelectionSchema).max(40),
  sections: z.array(aiSectionSchema).max(20)
});

function compactTier(tier = {}) {
  return {
    label: String(tier.label || ''),
    price: Number(tier.price || 0),
    features: (tier.features || []).slice(0, 20),
    brands: String(tier.brands || '')
  };
}

function compactCategory(category = {}) {
  return {
    id: category.id,
    name: category.name,
    section: category.section,
    description: category.desc || '',
    tiers: Object.fromEntries(
      TIER_KEYS
        .filter(key => category.tiers?.[key] && category.tiers[key].enabled !== false)
        .map(key => [key, compactTier(category.tiers[key])])
    )
  };
}

function compactLibraryItem(item = {}) {
  const payload = item.payload || {};
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    header: payload.section || 'Custom',
    required: payload.required === true,
    tiers: Object.fromEntries(
      TIER_KEYS
        .filter(key => payload.tiers?.[key] && payload.tiers[key].enabled !== false)
        .map(key => [key, compactTier(payload.tiers[key])])
    )
  };
}

function buildBudgetDraftInput({ prompt, budget, categories, library }) {
  const currentSelections = budget.currentState?.selections || {};
  return JSON.stringify({
    request: prompt,
    project: {
      homeSize: budget.sqftLocked || budget.currentState?.homeSize || 4000,
      propertyType: budget.propertyTypeLocked || budget.currentState?.propertyType || 'residential',
      currentSelections,
      currentCustomSections: (budget.customCategories || []).map(category => category.name)
    },
    approvedTemplateCategories: (categories || []).map(compactCategory),
    reusableSectionLibrary: (library || []).map(compactLibraryItem)
  });
}

const BUDGET_DRAFT_INSTRUCTIONS = `You build preliminary residential technology budgets for Gamma Tech.

The budget tool is for customer priorities, options, allowances, and decisions. It is not proposal-writing software. Do not create product quantities, labor line items, contracts, payment schedules, or sales language.

Rules:
1. Prefer approved template categories for common systems. Put those choices in templateSelections using the exact category and tier keys supplied.
2. Prefer reusable library sections when one is a strong match. For a library section set source="library", use its exact sourceId, and keep its existing pricing and scope. The application will enforce the saved library payload.
3. Create a custom section only when the request is not adequately represented by the template or library.
4. Custom prices are preliminary customer allowances, rounded to the nearest $100. Do not use $0 unless the request explicitly calls for a no-cost option.
5. Use one tier for a fixed allowance; use Good/Better/Best only when meaningful alternatives help the customer decide.
6. Mark required only when the project cannot reasonably proceed without a choice in that section.
7. State material assumptions and unanswered questions. Never hide uncertainty.
8. Keep section names and features concise and customer-friendly.
9. Do not duplicate a system across templateSelections and sections.
10. Return a practical draft for human review; never claim it is final.`;

function normalizeAiDraft(draft, categories = [], library = []) {
  const parsed = aiBudgetDraftSchema.parse(draft);
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const libraryMap = new Map(library.map(item => [item.id, item]));
  const seenCategories = new Set();
  const templateSelections = parsed.templateSelections.filter(selection => {
    const category = categoryMap.get(selection.categoryId);
    if (!category?.tiers?.[selection.tierKey] || category.tiers[selection.tierKey].enabled === false) return false;
    if (seenCategories.has(selection.categoryId)) return false;
    seenCategories.add(selection.categoryId);
    return true;
  });

  const seenLibrary = new Set();
  const sections = parsed.sections.flatMap(section => {
    if (section.source !== 'library') return [section];
    const item = libraryMap.get(section.sourceId);
    if (!item || seenLibrary.has(section.sourceId)) return [];
    seenLibrary.add(section.sourceId);
    const payload = item.payload || {};
    const tiers = TIER_KEYS
      .filter(key => payload.tiers?.[key] && payload.tiers[key].enabled !== false)
      .map(key => ({ key, ...compactTier(payload.tiers[key]) }));
    if (!tiers.length) return [];
    const recommendedTier = tiers.some(tier => tier.key === section.recommendedTier)
      ? section.recommendedTier
      : tiers[0].key;
    return [{
      ...section,
      name: item.name || payload.name || section.name,
      icon: payload.icon || section.icon,
      header: payload.section || section.header,
      required: payload.required === true || section.required,
      recommendedTier,
      tiers
    }];
  });

  return { ...parsed, templateSelections, sections };
}

module.exports = {
  BUDGET_DRAFT_INSTRUCTIONS,
  TIER_KEYS,
  aiBudgetDraftSchema,
  buildBudgetDraftInput,
  compactCategory,
  compactLibraryItem,
  normalizeAiDraft
};
