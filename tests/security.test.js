import { describe, expect, it } from 'vitest';
import security from '../src/utils/security.js';

const {
  canonicalize,
  createBudgetEditToken,
  escapeHtml,
  verifyBudgetEditToken
} = security;

describe('security helpers', () => {
  it('escapes executable HTML in stored customer fields', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('detects nested state changes even when totals match', () => {
    const first = canonicalize({ selections: { networking: 'good' }, total: 100 });
    const second = canonicalize({ selections: { networking: 'best' }, total: 100 });
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });

  it('requires the budget-specific edit token', () => {
    const secret = 'test-secret';
    const token = createBudgetEditToken(secret, 'budget-a');
    expect(verifyBudgetEditToken(secret, 'budget-a', token)).toBe(true);
    expect(verifyBudgetEditToken(secret, 'budget-b', token)).toBe(false);
    expect(verifyBudgetEditToken(secret, 'budget-a', 'wrong')).toBe(false);
  });
});
