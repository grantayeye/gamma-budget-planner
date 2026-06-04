const { test, expect } = require('@playwright/test');

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false })
      });
    });
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('#loginView h1')).toContainText('Budget Admin');
    await expect(page.locator('#loginUsername')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid login' })
      });
    });

    await page.goto('/admin');
    await page.fill('#loginUsername', 'wrong@example.com');
    await page.fill('#loginPassword', 'wrongpass');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#loginError')).toBeVisible();
    await expect(page.locator('#loginError')).toContainText('Invalid login');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: 'test-admin', name: 'Test Admin', email: 'admin@example.com' }
        })
      });
    });
    await page.route('**/api/admin/budgets', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/admin/users', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/admin/categories', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ residential: [], condo: [], residential_sections: [], condo_sections: [] })
      });
    });

    await page.goto('/admin');
    await page.fill('#loginUsername', 'admin@example.com');
    await page.fill('#loginPassword', 'correct-password');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.locator('#userInfo')).toContainText('Test Admin');
  });
});
