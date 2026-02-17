const { test, expect } = require('@playwright/test');

test.describe('Admin Dashboard', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('text=Budget Admin')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[type="text"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[type="text"]', 'bradd');
    await page.fill('input[type="password"]', 'your-password'); // Update with real password
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=Budget Dashboard')).toBeVisible();
  });
});
