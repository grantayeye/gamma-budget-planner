import { describe, it, expect } from 'vitest';
import { getSizeMultiplier } from '../public/src/utils/pricing.js';

describe('getSizeMultiplier', () => {
  it('returns 1 for baseline 4000 sqft', () => {
    expect(getSizeMultiplier(4000, 1.0)).toBe(1);
  });

  it('scales up for larger homes', () => {
    const mult = getSizeMultiplier(6000, 1.0);
    expect(mult).toBeGreaterThan(1);
  });

  it('scales down for smaller homes', () => {
    const mult = getSizeMultiplier(3000, 1.0);
    expect(mult).toBeLessThan(1);
  });

  it('returns 1 when scaleFactor is 0', () => {
    expect(getSizeMultiplier(6000, 0)).toBe(1);
    expect(getSizeMultiplier(2000, 0)).toBe(1);
  });

  it('uses minimum 2500 sqft for calculations', () => {
    const mult2000 = getSizeMultiplier(2000, 1.0);
    const mult2500 = getSizeMultiplier(2500, 1.0);
    expect(mult2000).toBe(mult2500);
  });
});
