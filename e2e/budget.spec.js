const { test, expect } = require('@playwright/test');

test.describe('Budget Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page).toHaveTitle(/Budget Planner/);
  });

  test('shows initial categories', async ({ page }) => {
    await expect(page.locator('.categories-header h2')).toHaveText('System Categories');
  });

  test('can expand category', async ({ page }) => {
    const firstCategory = page.locator('.category-header').first();
    await firstCategory.click();
    await expect(page.locator('.category-card.open')).toBeVisible();
  });

  test('selecting tier updates total', async ({ page }) => {
    const initialTotal = await page.locator('#headerTotal').textContent();
    
    // Click first category to expand
    await page.locator('.category-header').first().click();
    
    // Click a tier button
    await page.locator('.tier-btn.good-btn').first().click();
    
    // Check total changed
    const newTotal = await page.locator('#headerTotal').textContent();
    expect(newTotal).not.toBe(initialTotal);
  });

  test('expand all button works', async ({ page }) => {
    await page.click('text=Expand All');
    const openCards = await page.locator('.category-card.open').count();
    expect(openCards).toBeGreaterThan(0);
  });
});
