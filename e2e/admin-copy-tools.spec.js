const { test, expect } = require('@playwright/test');

test.describe('Admin copy/customization tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForFunction(() => typeof renderCategoryEditor === 'function');
  });

  test('normalizes legacy section strings into stable section ids', async ({ page }) => {
    const result = await page.evaluate(() => {
      const normalized = normalizeCategoryList([
        { id: 'networking', section: 'Infrastructure', name: 'Networking', tiers: {} },
        { id: 'audio', section: 'Audio', name: 'Audio', tiers: {} },
        { id: 'speakers', section: 'Audio', name: 'Speakers', tiers: {} }
      ]);
      return {
        sections: normalized.sections,
        categories: normalized.categories.map(cat => ({
          id: cat.id,
          section: cat.section,
          sectionId: cat.section_id,
          sortOrder: cat.sortOrder
        }))
      };
    });

    expect(result.sections).toEqual([
      { id: 'infrastructure', name: 'Infrastructure', order: 0 },
      { id: 'audio', name: 'Audio', order: 1 }
    ]);
    expect(result.categories).toEqual([
      { id: 'networking', section: 'Infrastructure', sectionId: 'infrastructure', sortOrder: 0 },
      { id: 'audio', section: 'Audio', sectionId: 'audio', sortOrder: 0 },
      { id: 'speakers', section: 'Audio', sectionId: 'audio', sortOrder: 1 }
    ]);
  });

  test('category editor creates stable section ids for typed new headers', async ({ page }) => {
    const result = await page.evaluate(() => {
      catData = {
        residential_categories: [
          { id: 'networking', section: 'Infrastructure', name: 'Networking', icon: 'N', sizeScale: 0, tiers: { good: { price: 1000, label: 'Good' } } }
        ],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [],
        condo_categories: [],
        condo_sections: [],
        condo_extras: [],
        base_sqft: 4000
      };
      document.getElementById('catPropertyType').value = 'residential';
      loadCategoryEditor();
      document.querySelector('.cat-editor-card [data-field="section"]').value = 'Design Services';
      collectCategoryEditorData();
      return {
        sections: catData.residential_sections,
        category: catData.residential_categories[0]
      };
    });

    expect(result.sections).toContainEqual({ id: 'design-services', name: 'Design Services', order: 1 });
    expect(result.category.section).toBe('Design Services');
    expect(result.category.section_id).toBe('design-services');
    expect(result.category.sectionId).toBe('design-services');
  });

  test('customize layout does not duplicate old name-based section ids', async ({ page }) => {
    const result = await page.evaluate(() => {
      const model = getCustomizeLayoutModel(
        [
          { id: 'networking', section: 'Infrastructure', section_id: 'infrastructure', name: 'Networking', tiers: {} },
          { id: 'audio', section: 'Audio', section_id: 'audio', name: 'Audio', tiers: {} }
        ],
        [],
        {
          __layout: {
            sections: [
              { id: 'Infrastructure', name: 'Infrastructure', order: 0 },
              { id: 'Audio', name: 'Audio', order: 1 }
            ]
          }
        }
      );
      return {
        sections: model.sections,
        items: model.items.map(item => ({ id: item.id, sectionId: item.sectionId, section: item.section }))
      };
    });

    expect(result.sections).toEqual([
      { id: 'infrastructure', name: 'Infrastructure', order: 0 },
      { id: 'audio', name: 'Audio', order: 1 }
    ]);
    expect(result.items).toEqual([
      { id: 'networking', sectionId: 'infrastructure', section: 'Infrastructure' },
      { id: 'audio', sectionId: 'audio', section: 'Audio' }
    ]);
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
          standard: { price: 1500, label: 'Standard Original', features: ['standard feature'], brands: 'Standard Brand' },
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

    expect(result.goodEnabled).toBe(true);
    expect(result.goodLabel).toBe('Standard Original');
    expect(result.goodPrice).toBe('1500');
    expect(result.goodFeatures).toEqual(['standard feature']);
    expect(result.goodBrands).toBe('Standard Brand');
    expect(result.standardEnabled).toBe(true);
    expect(result.standardLabel).toBe('Good Original');
    expect(result.standardPrice).toBe('1000');
    expect(result.standardFeatures).toEqual(['good feature']);
    expect(result.standardBrands).toBe('Good Brand');
  });

  test('skips disabled standard tier when showing and applying swap arrows', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cat = {
        id: 'skip-disabled-standard',
        name: 'Skip Disabled Standard',
        icon: 'S',
        sizeScale: 0,
        tiers: {
          good: { price: 1000, label: 'Good Original', features: ['good feature'], brands: 'Good Brand' },
          better: { price: 2000, label: 'Better Original', features: ['better feature'], brands: 'Better Brand' },
          best: { price: 3000, label: 'Best Original', features: ['best feature'], brands: 'Best Brand' }
        }
      };
      const override = {
        tiers: {
          standard: { enabled: false, label: 'Standard', price: 0 }
        }
      };
      document.body.insertAdjacentHTML('beforeend', `<div id="skip-disabled-target">${renderCategoryEditor(cat, override, null, 4000)}</div>`);
      const editor = document.querySelector('.category-editor[data-cat-id="skip-disabled-standard"]');
      const visibilityBefore = Object.fromEntries(TIER_ORDER.flatMap(tier => {
        const row = editor.querySelector(`.tier-row[data-tier="${tier}"]`);
        return Array.from(row.querySelectorAll('.tier-swap-btn')).map(btn => [`${tier}:${btn.dataset.direction}`, getComputedStyle(btn).visibility]);
      }));

      swapTierWithNeighbor('skip-disabled-standard', 'good', 1);
      const goodRow = editor.querySelector('.tier-row[data-tier="good"]');
      const standardRow = editor.querySelector('.tier-row[data-tier="standard"]');
      const betterRow = editor.querySelector('.tier-row[data-tier="better"]');
      return {
        visibilityBefore,
        goodLabel: goodRow.querySelector('.tier-label').value,
        goodPrice: goodRow.querySelector('.tier-price').value,
        standardEnabled: standardRow.querySelector('.tier-enabled').checked,
        betterLabel: betterRow.querySelector('.tier-label').value,
        betterPrice: betterRow.querySelector('.tier-price').value,
        betterFeatures: JSON.parse(betterRow.dataset.features),
        betterBrands: betterRow.dataset.brands
      };
    });

    expect(result.visibilityBefore['good:1']).toBe('visible');
    expect(result.visibilityBefore['standard:-1']).toBe('hidden');
    expect(result.visibilityBefore['standard:1']).toBe('hidden');
    expect(result.visibilityBefore['better:-1']).toBe('visible');
    expect(result.visibilityBefore['better:1']).toBe('visible');
    expect(result.visibilityBefore['best:-1']).toBe('visible');
    expect(result.goodLabel).toBe('Better Original');
    expect(result.goodPrice).toBe('2000');
    expect(result.standardEnabled).toBe(false);
    expect(result.betterLabel).toBe('Good Original');
    expect(result.betterPrice).toBe('1000');
    expect(result.betterFeatures).toEqual(['good feature']);
    expect(result.betterBrands).toBe('Good Brand');
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

  test('custom tier swap arrows refresh when a neighboring tier is enabled', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      host.style.width = '840px';
      document.body.appendChild(host);
      const controls = renderCustomizeItemControls(
        { type: 'custom', id: 'qa-custom', sectionId: 'custom' },
        { sections: [{ id: 'custom', name: 'Custom' }] },
        0,
        3
      );
      host.innerHTML = renderCustomCategoryEditor({
        id: 'qa-custom',
        name: 'New Custom Section (1)',
        tiers: {
          good: { enabled: true, label: 'Good', price: 1000 },
          standard: { enabled: false, label: 'Standard', price: 2000 },
          better: { enabled: true, label: 'Better', price: 3000 }
        }
      }, 99999, null, controls);

      const editor = host.querySelector('.custom-category-editor');
      const standardRow = editor.querySelector('.cc-tier-row[data-tier="standard"]');
      const goodDown = editor.querySelector('.cc-tier-row[data-tier="good"] .tier-swap-btn[data-direction="1"]');
      const standardUp = standardRow.querySelector('.tier-swap-btn[data-direction="-1"]');
      const betterUp = editor.querySelector('.cc-tier-row[data-tier="better"] .tier-swap-btn[data-direction="-1"]');
      const before = {
        goodDown: getComputedStyle(goodDown).visibility,
        standardUp: getComputedStyle(standardUp).visibility,
        betterUp: getComputedStyle(betterUp).visibility
      };

      standardRow.querySelector('.cc-tier-enabled').checked = true;
      refreshCustomTierSwapButtons(editor);
      await new Promise(resolve => requestAnimationFrame(resolve));

      const after = {
        goodDown: getComputedStyle(goodDown).visibility,
        standardUp: getComputedStyle(standardUp).visibility,
        goodDownClass: goodDown.className,
        standardUpClass: standardUp.className,
        goodDownStyle: goodDown.style.visibility,
        standardUpStyle: standardUp.style.visibility,
        goodDownDisabled: goodDown.disabled,
        standardUpDisabled: standardUp.disabled
      };
      host.remove();
      return { before, after };
    });

    expect(result.before.goodDown).toBe('visible');
    expect(result.before.standardUp).toBe('hidden');
    expect(result.before.betterUp).toBe('visible');
    expect(result.after.goodDownClass).not.toContain('is-hidden');
    expect(result.after.standardUpClass).not.toContain('is-hidden');
    expect(result.after.goodDownStyle).toBe('visible');
    expect(result.after.standardUpStyle).toBe('visible');
    expect(result.after.goodDownDisabled).toBe(false);
    expect(result.after.standardUpDisabled).toBe(false);
  });
});
