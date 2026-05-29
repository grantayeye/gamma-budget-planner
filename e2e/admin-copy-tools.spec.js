const { test, expect } = require('@playwright/test');

test.describe('Admin copy/customization tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForFunction(() => typeof renderCategoryEditor === 'function');
  });

  test('clone posts a new budget name and opens the clone', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const calls = [];
      budgets = [{ id: 'src12345', clientName: 'Williams Residence', builder: 'Potter Homes' }];
      prompt = () => 'Williams Residence Copy';
      openCustomizeModal = id => { window.__openedCloneId = id; };
      fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body || null });
        if (String(url).endsWith('/api/admin/budgets/src12345/clone')) {
          return { ok: true, json: async () => ({ success: true, id: 'clone987', url: '/b/clone987' }) };
        }
        if (String(url).endsWith('/api/admin/budgets')) {
          return { status: 200, ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => ({}) };
      };

      await cloneBudget('src12345');
      await new Promise(resolve => setTimeout(resolve, 300));
      return { calls, opened: window.__openedCloneId };
    });

    const cloneCall = result.calls.find(call => call.url.endsWith('/api/admin/budgets/src12345/clone'));
    expect(cloneCall).toBeTruthy();
    expect(cloneCall.method).toBe('POST');
    expect(JSON.parse(cloneCall.body)).toEqual({ clientName: 'Williams Residence Copy' });
    expect(result.opened).toBe('clone987');
  });

  test('copies a source section into the target customize editor', async ({ page }) => {
    const result = await page.evaluate(() => {
      const targetCat = {
        id: 'networking',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: {
          good: { price: 1000, label: 'Old Good', features: ['old'], brands: 'Old Brand' },
          better: { price: 2000, label: 'Old Better', features: ['old better'], brands: 'Old Brand' }
        }
      };
      catData = {
        residential_categories: [targetCat],
        residential_extras: [],
        condo_categories: [],
        condo_extras: []
      };
      document.body.insertAdjacentHTML('beforeend', `<div id="copy-target">${renderCategoryEditor(targetCat, null, null, 4000)}</div>`);

      const sourceBudget = {
        id: 'source',
        currentState: { propertyType: 'residential', homeSize: 4000 },
        categoryConfig: {
          networking: {
            hidden: false,
            tiers: {
              good: { enabled: true, label: 'Copied Good', price: 3100, features: ['copied good'], brands: 'Copied Brand' },
              better: { enabled: true, label: 'Copied Better', price: 5200, features: ['copied better'], brands: 'Better Brand' },
              best: { enabled: false, label: 'Copied Best', price: 7300, features: ['copied best'], brands: 'Best Brand' }
            }
          }
        }
      };

      const override = buildCategoryOverrideFromBudget(sourceBudget, 'networking');
      const applied = applyCategoryOverrideToEditor('networking', override);
      const row = document.querySelector('.category-editor[data-cat-id="networking"] .tier-row[data-tier="better"]');
      const disabledRow = document.querySelector('.category-editor[data-cat-id="networking"] .tier-row[data-tier="best"]');
      return {
        applied,
        betterLabel: row.querySelector('.tier-label').value,
        betterPrice: row.querySelector('.tier-price').value,
        betterFeatures: JSON.parse(row.dataset.features),
        betterBrands: row.dataset.brands,
        bestEnabled: disabledRow.querySelector('.tier-enabled').checked,
        bestInputDisabled: disabledRow.querySelector('.tier-label').disabled
      };
    });

    expect(result.applied).toBe(true);
    expect(result.betterLabel).toBe('Copied Better');
    expect(result.betterPrice).toBe('5200');
    expect(result.betterFeatures).toEqual(['copied better']);
    expect(result.betterBrands).toBe('Better Brand');
    expect(result.bestEnabled).toBe(false);
    expect(result.bestInputDisabled).toBe(true);
  });

  test('swaps adjacent standard category tiers including labels, price, features, brands, and enabled state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cat = {
        id: 'swap-cat',
        name: 'Swap Category',
        icon: 'S',
        sizeScale: 0,
        tiers: {
          good: { price: 1000, label: 'Good Original', features: ['good feature'], brands: 'Good Brand' },
          better: { price: 2000, label: 'Better Original', features: ['better feature'], brands: 'Better Brand' }
        }
      };
      document.body.insertAdjacentHTML('beforeend', `<div id="swap-target">${renderCategoryEditor(cat, null, null, 4000)}</div>`);
      swapTierWithNeighbor('swap-cat', 'good', 1);
      const goodRow = document.querySelector('.category-editor[data-cat-id="swap-cat"] .tier-row[data-tier="good"]');
      const standardRow = document.querySelector('.category-editor[data-cat-id="swap-cat"] .tier-row[data-tier="standard"]');
      return {
        goodLabel: goodRow.querySelector('.tier-label').value,
        goodPrice: goodRow.querySelector('.tier-price').value,
        goodFeatures: JSON.parse(goodRow.dataset.features),
        goodBrands: goodRow.dataset.brands,
        goodEnabled: goodRow.querySelector('.tier-enabled').checked,
        standardLabel: standardRow.querySelector('.tier-label').value,
        standardPrice: standardRow.querySelector('.tier-price').value,
        standardFeatures: JSON.parse(standardRow.dataset.features),
        standardBrands: standardRow.dataset.brands,
        standardEnabled: standardRow.querySelector('.tier-enabled').checked
      };
    });

    expect(result.goodEnabled).toBe(false);
    expect(result.goodLabel).toBe('Standard');
    expect(result.goodPrice).toBe('');
    expect(result.standardEnabled).toBe(true);
    expect(result.standardLabel).toBe('Good Original');
    expect(result.standardPrice).toBe('1000');
    expect(result.standardFeatures).toEqual(['good feature']);
    expect(result.standardBrands).toBe('Good Brand');
  });

  test('swaps adjacent custom category tiers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const custom = {
        id: 'custom-swap',
        icon: 'C',
        name: 'Custom Swap',
        tiers: {
          good: { enabled: true, label: 'Custom Good', price: 111, features: ['cg'], brands: 'CB1' },
          standard: { enabled: true, label: 'Custom Standard', price: 222, features: ['cs'], brands: 'CB2' }
        }
      };
      document.body.insertAdjacentHTML('beforeend', `<div id="custom-swap-target">${renderCustomCategoryEditor(custom, 0, null)}</div>`);
      swapCustomTierWithNeighbor(0, 'good', 1);
      const goodRow = document.querySelector('.custom-category-editor[data-index="0"] .cc-tier-row[data-tier="good"]');
      const standardRow = document.querySelector('.custom-category-editor[data-index="0"] .cc-tier-row[data-tier="standard"]');
      return {
        goodLabel: goodRow.querySelector('.cc-tier-label').value,
        goodPrice: goodRow.querySelector('.cc-tier-price').value,
        goodFeatures: JSON.parse(goodRow.dataset.features),
        goodBrands: goodRow.dataset.brands,
        standardLabel: standardRow.querySelector('.cc-tier-label').value,
        standardPrice: standardRow.querySelector('.cc-tier-price').value,
        standardFeatures: JSON.parse(standardRow.dataset.features),
        standardBrands: standardRow.dataset.brands
      };
    });

    expect(result.goodLabel).toBe('Custom Standard');
    expect(result.goodPrice).toBe('222');
    expect(result.goodFeatures).toEqual(['cs']);
    expect(result.goodBrands).toBe('CB2');
    expect(result.standardLabel).toBe('Custom Good');
    expect(result.standardPrice).toBe('111');
    expect(result.standardFeatures).toEqual(['cg']);
    expect(result.standardBrands).toBe('CB1');
  });
});
