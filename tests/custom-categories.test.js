import { describe, expect, it } from 'vitest';
import customCategories from '../src/utils/custom-categories.js';

const { ensureCustomCategoryTier } = customCategories;

describe('custom category normalization', () => {
  it('adds a visible allowance option when a named category has no tiers yet', () => {
    expect(ensureCustomCategoryTier({ id: 'custom-mic', name: 'Microphones', tiers: {} })).toEqual({
      id: 'custom-mic',
      name: 'Microphones',
      tiers: {
        good: {
          enabled: true,
          label: 'Budget Allowance',
          price: 0,
          features: [],
          brands: ''
        }
      }
    });
  });

  it('does not replace configured custom options', () => {
    const category = {
      id: 'custom-mic',
      name: 'Microphones',
      tiers: { better: { enabled: true, label: 'Podium Microphone', price: 1800 } }
    };
    expect(ensureCustomCategoryTier(category)).toEqual(category);
  });
});
