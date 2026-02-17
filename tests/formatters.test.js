import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../public/src/utils/formatters.js';

describe('formatCurrency', () => {
  it('formats positive numbers', () => {
    expect(formatCurrency(12000)).toBe('$12,000');
    expect(formatCurrency(50000)).toBe('$50,000');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats negative numbers', () => {
    expect(formatCurrency(-5000)).toBe('-$5,000');
  });

  it('rounds decimals', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatCurrency(1234.4)).toBe('$1,234');
  });
});
