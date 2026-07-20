import { describe, expect, it } from 'vitest';
import budgetAi from '../src/utils/budget-ai.js';

const { aiBudgetDraftSchema, buildBudgetDraftInput, normalizeAiDraft } = budgetAi;

const categories = [{
  id: 'networking',
  name: 'Networking',
  section: 'Infrastructure',
  tiers: {
    good: { enabled: true, label: 'Good', price: 10000, features: ['WiFi'] },
    best: { enabled: false, label: 'Best', price: 25000 }
  }
}];

const library = [{
  id: 'golf-simulator',
  name: 'Golf Simulator',
  description: 'A proven simulator allowance',
  payload: {
    name: 'Golf Simulator',
    section: 'Entertainment',
    tiers: { standard: { enabled: true, label: 'Simulator Allowance', price: 50000 } }
  }
}];

function draft(overrides = {}) {
  return {
    summary: 'Preliminary draft',
    assumptions: [],
    questions: [],
    templateSelections: [],
    sections: [],
    ...overrides
  };
}

describe('AI budget draft helpers', () => {
  it('sends approved categories, reusable sections, and current project context', () => {
    const input = JSON.parse(buildBudgetDraftInput({
      prompt: 'Add reliable networking and a golf simulator.',
      budget: {
        clientName: 'Example Client',
        currentState: { homeSize: 6500, propertyType: 'residential', selections: { lighting: 'good' } },
        customCategories: [{ name: 'Existing One-Off' }]
      },
      categories,
      library
    }));

    expect(input.request).toContain('golf simulator');
    expect(input.project.homeSize).toBe(6500);
    expect(input.project).not.toHaveProperty('clientName');
    expect(input.project.currentCustomSections).toEqual(['Existing One-Off']);
    expect(input.approvedTemplateCategories[0].tiers).toHaveProperty('good');
    expect(input.approvedTemplateCategories[0].tiers).not.toHaveProperty('best');
    expect(input.reusableSectionLibrary[0].id).toBe('golf-simulator');
  });

  it('drops invalid, disabled, and duplicate references before review', () => {
    const normalized = normalizeAiDraft(draft({
      templateSelections: [
        { categoryId: 'networking', categoryName: 'Networking', tierKey: 'good', price: 10000, required: false, rationale: 'Needed' },
        { categoryId: 'networking', categoryName: 'Networking', tierKey: 'good', price: 10000, required: true, rationale: 'Duplicate' },
        { categoryId: 'networking', categoryName: 'Networking', tierKey: 'best', price: 25000, required: false, rationale: 'Disabled' },
        { categoryId: 'invented', categoryName: 'Invented', tierKey: 'good', price: 1000, required: false, rationale: 'Unknown' }
      ],
      sections: [
        { source: 'library', sourceId: 'golf-simulator', name: 'Golf', icon: '⛳', header: 'Entertainment', required: false, recommendedTier: 'standard', rationale: 'Requested', tiers: [{ key: 'standard', label: 'Allowance', price: 50000, features: [], brands: '' }] },
        { source: 'library', sourceId: 'golf-simulator', name: 'Duplicate', icon: '⛳', header: 'Entertainment', required: false, recommendedTier: 'standard', rationale: 'Duplicate', tiers: [{ key: 'standard', label: 'Allowance', price: 50000, features: [], brands: '' }] },
        { source: 'library', sourceId: 'invented', name: 'Unknown', icon: '📦', header: 'Other', required: false, recommendedTier: 'standard', rationale: 'Unknown', tiers: [{ key: 'standard', label: 'Allowance', price: 1000, features: [], brands: '' }] }
      ]
    }), categories, library);

    expect(normalized.templateSelections).toHaveLength(1);
    expect(normalized.sections).toHaveLength(1);
    expect(normalized.sections[0].sourceId).toBe('golf-simulator');
    expect(normalized.sections[0].tiers[0].price).toBe(50000);
  });

  it('rejects negative or excessive allowance pricing', () => {
    expect(() => aiBudgetDraftSchema.parse(draft({
      sections: [{ source: 'custom', sourceId: '', name: 'Bad', icon: '📦', header: 'Other', required: false, recommendedTier: 'good', rationale: '', tiers: [{ key: 'good', label: 'Bad', price: -1, features: [], brands: '' }] }]
    }))).toThrow();
    expect(() => aiBudgetDraftSchema.parse(draft({
      sections: [{ source: 'custom', sourceId: '', name: 'Bad', icon: '📦', header: 'Other', required: false, recommendedTier: 'good', rationale: '', tiers: [{ key: 'good', label: 'Bad', price: 10000001, features: [], brands: '' }] }]
    }))).toThrow();
  });

  it('preserves staff-reviewed names and prices when applying a draft', () => {
    const normalized = normalizeAiDraft(draft({
      templateSelections: [
        { categoryId: 'networking', categoryName: 'Networking', tierKey: 'good', price: 12500, required: false, rationale: 'Reviewed' }
      ],
      sections: [
        { source: 'library', sourceId: 'golf-simulator', name: 'Simulator Planning Allowance', icon: '⛳', header: 'Specialty Spaces', required: true, recommendedTier: 'standard', rationale: 'Reviewed', tiers: [{ key: 'standard', label: 'Reviewed Allowance', price: 57500, features: ['Reviewed scope'], brands: '' }] }
      ]
    }), categories, library, { preserveReviewedValues: true });

    expect(normalized.templateSelections[0].price).toBe(12500);
    expect(normalized.sections[0]).toMatchObject({
      name: 'Simulator Planning Allowance',
      header: 'Specialty Spaces',
      required: true
    });
    expect(normalized.sections[0].tiers[0]).toMatchObject({ label: 'Reviewed Allowance', price: 57500 });
  });
});
