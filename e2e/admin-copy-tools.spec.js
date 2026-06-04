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

  test('default category comparison matrix saves legacy tier features for compatibility', async ({ page }) => {
    const result = await page.evaluate(() => {
      catData = {
        residential_categories: [{
          id: 'networking',
          section: 'Infrastructure',
          section_id: 'infrastructure',
          name: 'Whole-Home WiFi & Networking',
          icon: 'W',
          sizeScale: 0,
          tiers: {
            good: { price: 1000, label: 'Good', features: ['WiFi coverage'], brands: 'Brand A' },
            better: { price: 2000, label: 'Better', features: ['WiFi coverage', 'UPS backup'], brands: 'Brand B' },
            best: { price: 3000, label: 'Best', features: ['WiFi coverage', 'UPS backup', 'Enterprise switching'], brands: 'Brand C' }
          }
        }],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [],
        condo_categories: [],
        condo_sections: [],
        condo_extras: []
      };
      document.getElementById('catPropertyType').value = 'residential';
      loadCategoryEditor();
      const card = document.querySelector('.cat-editor-card[data-cat-idx="0"]');
      card.classList.add('open');
      const select = card.querySelector('.presentation-mode-select');
      select.value = 'matrix';
      setMatrixMode(select, 'networking');
      const upsRow = [...card.querySelectorAll('.feature-matrix-row')]
        .find(row => row.querySelector('.fm-label')?.value === 'UPS backup');
      upsRow.querySelector('.fm-description').value = 'Keeps the network alive during short power outages.';
      upsRow.querySelector('.fm-status[data-tier="good"]').value = 'addon';
      applyMatrixStatusRight(upsRow.querySelector('.fm-status[data-tier="good"] + .fm-apply-right'));
      card.querySelector('.feature-matrix-tier-card[data-tier="better"] .matrix-tier-label').value = 'Better Plus';
      card.querySelector('.feature-matrix-tier-card[data-tier="better"] .matrix-tier-price').value = '2400';
      collectCategoryEditorData();
      const cat = catData.residential_categories[0];
      return {
        mode: cat.presentationMode,
        visibleTierLabels: [...card.querySelectorAll('.feature-matrix-tier-card label')]
          .map(label => label.textContent.trim()),
        hasStandardStatusCells: !!card.querySelector('.fm-status[data-tier="standard"]'),
        bottomAddButton: card.querySelector('.feature-matrix-bottom-actions > button')?.textContent.trim(),
        matrixLabels: cat.featureMatrix.map(feature => feature.label),
        goodUpsStatus: cat.featureMatrix.find(feature => feature.label === 'UPS backup')?.tierStatus.good,
        betterUpsStatus: cat.featureMatrix.find(feature => feature.label === 'UPS backup')?.tierStatus.better,
        bestUpsStatus: cat.featureMatrix.find(feature => feature.label === 'UPS backup')?.tierStatus.best,
        hasTierOrder: Object.prototype.hasOwnProperty.call(cat, 'tierOrder'),
        betterLabel: cat.tiers.better.label,
        betterPrice: cat.tiers.better.price,
        betterFeatures: cat.tiers.better.features,
        goodFeatures: cat.tiers.good.features
      };
    });

    expect(result.mode).toBe('matrix');
    expect(result.visibleTierLabels).toEqual(['Good', 'Better', 'Best']);
    expect(result.hasStandardStatusCells).toBe(false);
    expect(result.bottomAddButton).toBe('+ Feature');
    expect(result.matrixLabels).toEqual(['WiFi coverage', 'UPS backup', 'Enterprise switching']);
    expect(result.goodUpsStatus).toBe('addon');
    expect(result.betterUpsStatus).toBe('addon');
    expect(result.bestUpsStatus).toBe('addon');
    expect(result.hasTierOrder).toBe(false);
    expect(result.betterLabel).toBe('Better Plus');
    expect(result.betterPrice).toBe(2400);
    expect(result.betterFeatures).toEqual(['WiFi coverage']);
    expect(result.goodFeatures).toEqual(['WiFi coverage']);
  });

  test('customize category comparison matrix is collected with generated legacy features', async ({ page }) => {
    const result = await page.evaluate(() => {
      const targetCat = {
        id: 'networking',
        section: 'Infrastructure',
        section_id: 'infrastructure',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: {
          good: { price: 1000, label: 'Good', features: ['WiFi coverage'], brands: 'Brand A' },
          better: { price: 2000, label: 'Better', features: ['WiFi coverage', 'UPS backup'], brands: 'Brand B' }
        }
      };
      customizeBudgetData = {
        id: 'matrix-budget',
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
        categoryConfig: {
          __defaultCategories: { residential: [targetCat], condo: [] },
          __defaultSections: { residential: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }], condo: [] },
          __layout: {
            sections: [
              { id: 'infrastructure', name: 'Infrastructure', order: 0 },
              { id: 'custom', name: 'Custom', order: 1 }
            ]
          }
        },
        customCategories: [{
          id: 'custom-matrix',
          name: 'Custom Matrix',
          icon: 'C',
          section_id: 'custom',
          sectionId: 'custom',
          section: 'Custom',
          sortOrder: 0,
          tiers: {
            good: { enabled: true, label: 'Good', price: 111, features: ['Custom base'], brands: 'CB1' },
            better: { enabled: true, label: 'Better', price: 222, features: ['Custom base', 'Custom upgrade'], brands: 'CB2' }
          }
        }]
      };
      renderCustomizeEditor();

      const defaultEditor = document.querySelector('.category-editor[data-cat-id="networking"]');
      const defaultSelect = defaultEditor.querySelector('.presentation-mode-select');
      defaultSelect.value = 'matrix';
      setMatrixMode(defaultSelect, 'networking');
      const upsRow = [...defaultEditor.querySelectorAll('.feature-matrix-row')]
        .find(row => row.querySelector('.fm-label')?.value === 'UPS backup');
      upsRow.querySelector('.fm-status[data-tier="good"]').value = 'addon';

      const customEditor = document.querySelector('.custom-category-editor[data-cc-id="custom-matrix"]');
      const customSelect = customEditor.querySelector('.presentation-mode-select');
      customSelect.value = 'matrix';
      setMatrixMode(customSelect, 'custom-matrix');
      const customUpgradeRow = [...customEditor.querySelectorAll('.feature-matrix-row')]
        .find(row => row.querySelector('.fm-label')?.value === 'Custom upgrade');
      customUpgradeRow.querySelector('.fm-status[data-tier="good"]').value = 'addon';

      const collected = collectCustomizationData();
      return {
        defaultMode: collected.categoryConfig.networking.presentationMode,
        defaultHasTierOrder: Object.prototype.hasOwnProperty.call(collected.categoryConfig.networking, 'tierOrder'),
        defaultGoodStatus: collected.categoryConfig.networking.featureMatrix.find(feature => feature.label === 'UPS backup')?.tierStatus.good,
        defaultGoodFeatures: collected.categoryConfig.networking.tiers.good.features,
        customMode: collected.customCategories[0].presentationMode,
        customHasTierOrder: Object.prototype.hasOwnProperty.call(collected.customCategories[0], 'tierOrder'),
        customGoodStatus: collected.customCategories[0].featureMatrix.find(feature => feature.label === 'Custom upgrade')?.tierStatus.good,
        customBetterFeatures: collected.customCategories[0].tiers.better.features
      };
    });

    expect(result.defaultMode).toBe('matrix');
    expect(result.defaultHasTierOrder).toBe(false);
    expect(result.defaultGoodStatus).toBe('addon');
    expect(result.defaultGoodFeatures).toEqual(['WiFi coverage']);
    expect(result.customMode).toBe('matrix');
    expect(result.customHasTierOrder).toBe(false);
    expect(result.customGoodStatus).toBe('addon');
    expect(result.customBetterFeatures).toEqual(['Custom base', 'Custom upgrade']);
  });

  test('customize matrix hides unchecked tiers and swaps package data within fixed tier slots', async ({ page }) => {
    const result = await page.evaluate(() => {
      const targetCat = {
        id: 'networking',
        section: 'Infrastructure',
        section_id: 'infrastructure',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: {
          good: { price: 1000, label: 'Good', features: ['WiFi coverage'], brands: 'Brand A' },
          standard: { price: 1500, label: 'Standard', features: ['WiFi coverage', 'Standard support'], brands: 'Brand S' },
          better: { price: 2000, label: 'Better', features: ['WiFi coverage', 'UPS backup'], brands: 'Brand B' },
          best: { price: 3000, label: 'Best', features: ['WiFi coverage', 'UPS backup', 'Enterprise switching'], brands: 'Brand C' }
        }
      };
      customizeBudgetData = {
        id: 'matrix-order-budget',
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
        categoryConfig: {
          __defaultCategories: { residential: [targetCat], condo: [] },
          __defaultSections: { residential: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }], condo: [] }
        },
        customCategories: []
      };
      renderCustomizeEditor();

      const editor = document.querySelector('.category-editor[data-cat-id="networking"]');
      const select = editor.querySelector('.presentation-mode-select');
      select.value = 'matrix';
      setMatrixMode(select, 'networking');

      swapMatrixTierWithNeighbor(
        editor.querySelector('.feature-matrix-tier-card[data-tier="better"] .matrix-tier-swap-btn[data-direction="-1"]'),
        'better',
        -1
      );
      const goodToggle = editor.querySelector('.feature-matrix-tier-card[data-tier="good"] .matrix-tier-enabled');
      goodToggle.checked = false;
      toggleMatrixTierEnabled(goodToggle, 'good', false);

      const collected = collectCustomizationData();
      const override = collected.categoryConfig.networking;
      return {
        visibleOrder: [...editor.querySelectorAll('.feature-matrix-tier-card[data-tier]')].map(card => card.dataset.tier),
        disabledButtons: [...editor.querySelectorAll('.matrix-disabled-tiers [data-tier]')].map(button => button.dataset.tier),
        standardPrice: override.tiers.standard.price,
        betterPrice: override.tiers.better.price,
        standardFeatures: override.tiers.standard.features,
        betterFeatures: override.tiers.better.features,
        standardLabel: override.tiers.standard.label,
        betterLabel: override.tiers.better.label,
        goodEnabled: override.tiers.good.enabled,
        goodStatusCellsVisible: !!editor.querySelector('.fm-status[data-tier="good"]')
      };
    });

    expect(result.visibleOrder).toEqual(['standard', 'better', 'best']);
    expect(result.disabledButtons).toContain('good');
    expect(result.standardLabel).toBe('Standard');
    expect(result.betterLabel).toBe('Better');
    expect(result.standardPrice).toBe(2000);
    expect(result.betterPrice).toBe(1500);
    expect(result.standardFeatures).toEqual(['WiFi coverage', 'UPS backup']);
    expect(result.betterFeatures).toEqual(['WiFi coverage', 'Standard support']);
    expect(result.goodEnabled).toBe(false);
    expect(result.goodStatusCellsVisible).toBe(false);
  });

  test('customize open ignores stale local drafts and keeps search menus closed', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const targetCat = {
        id: 'networking',
        section: 'Infrastructure',
        section_id: 'infrastructure',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: { good: { price: 1000, label: 'Good' } }
      };
      catData = {
        residential_categories: [targetCat],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [],
        condo_categories: [],
        condo_sections: [],
        condo_extras: []
      };
      budgets = [
        { id: 'draft123', clientName: 'Draft Test' },
        { id: 'source123', clientName: 'Source Residence' }
      ];
      localStorage.setItem('budgetCustomizeDraft:draft123', JSON.stringify({
        savedAt: '2026-06-03T15:19:00.000Z',
        customCategories: [{ id: 'stale-custom', name: 'Stale Custom', tiers: {} }],
        categoryConfig: { networking: { hidden: true } }
      }));
      let confirmCalled = false;
      confirm = () => {
        confirmCalled = true;
        return true;
      };
      fetch = async url => {
        if (String(url).endsWith('/api/admin/budgets/draft123')) {
          return {
            ok: true,
            json: async () => ({
              id: 'draft123',
              clientName: 'Draft Test',
              sqftLocked: 4000,
              propertyTypeLocked: 'residential',
              currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
              categoryConfig: {
                __defaultCategories: { residential: [targetCat], condo: [] },
                __defaultSections: { residential: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }], condo: [] }
              },
              customCategories: []
            })
          };
        }
        return { ok: false, json: async () => ({}) };
      };

      await openCustomizeModal('draft123');
      return {
        active: document.getElementById('customizeModal').classList.contains('active'),
        confirmCalled,
        draftExists: !!localStorage.getItem('budgetCustomizeDraft:draft123'),
        customCount: customizeBudgetData.customCategories.length,
        copySourceOpen: document.getElementById('copySourceBudgetComboWrap')?.classList.contains('open') || false,
        openMenus: document.querySelectorAll('.search-combo.open').length
      };
    });

    expect(result.active).toBe(true);
    expect(result.confirmCalled).toBe(false);
    expect(result.draftExists).toBe(false);
    expect(result.customCount).toBe(0);
    expect(result.copySourceOpen).toBe(false);
    expect(result.openMenus).toBe(0);
  });

  test('customize close only prompts when unsaved changes exist', async ({ page }) => {
    const result = await page.evaluate(() => {
      const targetCat = {
        id: 'networking',
        section: 'Infrastructure',
        section_id: 'infrastructure',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: { good: { price: 1000, label: 'Good' } }
      };
      customizeBudgetId = 'close123';
      customizeBudgetData = {
        id: 'close123',
        clientName: 'Close Test',
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
        categoryConfig: {
          __defaultCategories: { residential: [targetCat], condo: [] },
          __defaultSections: { residential: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }], condo: [] }
        },
        customCategories: []
      };
      renderCustomizeEditor();
      const modal = document.getElementById('customizeModal');
      modal.classList.add('active');

      const messages = [];
      confirm = message => {
        messages.push(message);
        return false;
      };

      const cleanCloseResult = closeCustomizeModal();
      const cleanClosed = !modal.classList.contains('active');
      customizeBudgetId = 'close123';
      customizeBudgetData = {
        id: 'close123',
        clientName: 'Close Test',
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
        categoryConfig: {
          __defaultCategories: { residential: [targetCat], condo: [] },
          __defaultSections: { residential: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }], condo: [] }
        },
        customCategories: []
      };
      renderCustomizeEditor();
      modal.classList.add('active');
      queueCustomizeDraftSave();
      const dirtyCloseResult = closeCustomizeModal();
      const stillOpenAfterCancel = modal.classList.contains('active');
      const draftExists = !!localStorage.getItem('budgetCustomizeDraft:close123');

      confirm = message => {
        messages.push(message);
        return true;
      };
      const confirmedCloseResult = closeCustomizeModal();
      const closedAfterConfirm = !modal.classList.contains('active');

      return {
        cleanCloseResult,
        cleanClosed,
        dirtyCloseResult,
        stillOpenAfterCancel,
        confirmedCloseResult,
        closedAfterConfirm,
        messages,
        draftExists
      };
    });

    expect(result.cleanCloseResult).toBe(true);
    expect(result.cleanClosed).toBe(true);
    expect(result.dirtyCloseResult).toBe(false);
    expect(result.stillOpenAfterCancel).toBe(true);
    expect(result.confirmedCloseResult).toBe(true);
    expect(result.closedAfterConfirm).toBe(true);
    expect(result.messages).toEqual([
      'Are you sure you want to close without saving?',
      'Are you sure you want to close without saving?'
    ]);
    expect(result.draftExists).toBe(false);
  });

  test('copy-from searchable combos select budget and section ids', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const targetCat = {
        id: 'networking',
        section: 'Infrastructure',
        section_id: 'infrastructure',
        name: 'Whole-Home WiFi & Networking',
        icon: 'W',
        sizeScale: 0,
        tiers: { good: { price: 1000, label: 'Old Good' } }
      };
      const sourceBudget = {
        id: 'source123',
        clientName: 'Source Residence',
        builder: 'Gamma Builder',
        currentState: { propertyType: 'residential', homeSize: 4000 },
        categoryConfig: {},
        customCategories: [{ id: 'custom-audio', name: 'Custom Audio', tiers: { good: { enabled: true, label: 'Good', price: 123 } } }]
      };
      budgets = [
        { id: 'target123', clientName: 'Target Residence' },
        { id: 'source123', clientName: 'Source Residence', builder: 'Gamma Builder' }
      ];
      customizeBudgetId = 'target123';
      catData = {
        residential_categories: [targetCat],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [],
        condo_categories: [],
        condo_sections: [],
        condo_extras: []
      };
      fetch = async url => {
        if (String(url).endsWith('/api/admin/budgets/source123')) {
          return { ok: true, json: async () => sourceBudget };
        }
        return { ok: false, json: async () => ({}) };
      };

      document.body.insertAdjacentHTML('beforeend', `
        <div id="combo-host">
          ${renderCopySectionControls()}
          ${renderCategoryEditor(targetCat, null, null, 4000)}
        </div>
      `);
      filterCopySourceBudgets();
      const budgetInput = document.getElementById('copySourceBudgetCombo');
      budgetInput.value = 'source';
      await handleCopySourceBudgetComboInput();
      const budgetOptionsBefore = [...document.querySelectorAll('#copySourceBudgetMenu .search-combo-option')].map(btn => btn.textContent.trim());
      document.querySelector('#copySourceBudgetMenu .search-combo-option')?.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      const sectionInput = document.getElementById('copySourceSectionCombo');
      sectionInput.value = 'custom';
      handleCopySourceSectionComboInput();
      const sectionOptionsBefore = [...document.querySelectorAll('#copySourceSectionMenu .search-combo-option')].map(btn => btn.textContent.trim());
      document.querySelector('#copySourceSectionMenu .search-combo-option')?.click();

      return {
        budgetOptionsBefore,
        selectedBudgetId: budgetInput.dataset.selectedId,
        sectionDisabled: sectionInput.disabled,
        sectionOptionsBefore,
        selectedSectionValue: sectionInput.dataset.selectedValue,
        sectionLabel: sectionInput.value
      };
    });

    expect(result.budgetOptionsBefore.join(' ')).toContain('Source Residence');
    expect(result.selectedBudgetId).toBe('source123');
    expect(result.sectionDisabled).toBe(false);
    expect(result.sectionOptionsBefore.join(' ')).toContain('Custom Audio');
    expect(result.selectedSectionValue).toBe('custom:custom-audio');
    expect(result.sectionLabel).toBe('Custom • Custom Audio');
  });

  test('copy-to searchable combo selects target budget id', async ({ page }) => {
    const result = await page.evaluate(() => {
      budgets = [
        { id: 'source123', clientName: 'Source Residence' },
        { id: 'target456', clientName: 'Target Residence', builder: 'Huffman' }
      ];
      customizeBudgetId = 'source123';
      document.body.insertAdjacentHTML('beforeend', `
        <div id="copyToHost">
          <div class="search-combo" id="copyToBudgetComboWrap">
            <input type="search" id="copyToBudgetCombo" oninput="handleCopyToBudgetComboInput()" class="customize-header-combo">
            <div class="search-combo-menu" id="copyToBudgetMenu"></div>
          </div>
          <div id="copyToStatus"></div>
        </div>
      `);

      const input = document.getElementById('copyToBudgetCombo');
      input.value = 'huffman';
      handleCopyToBudgetComboInput();
      const optionsBefore = [...document.querySelectorAll('#copyToBudgetMenu .search-combo-option')].map(btn => btn.textContent.trim());
      document.querySelector('#copyToBudgetMenu .search-combo-option')?.click();
      return {
        optionsBefore,
        selectedId: input.dataset.selectedId,
        value: input.value,
        status: document.getElementById('copyToStatus').textContent
      };
    });

    expect(result.optionsBefore.join(' ')).toContain('Target Residence');
    expect(result.selectedId).toBe('target456');
    expect(result.value).toContain('Target Residence');
    expect(result.status).toContain('Ready to copy');
  });

  test('moving a customize item keeps the current scroll position anchored', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const categories = Array.from({ length: 18 }, (_, i) => ({
        id: `cat-${i}`,
        section: i < 9 ? 'Infrastructure' : 'Audio',
        section_id: i < 9 ? 'infrastructure' : 'audio',
        name: `Category ${i}`,
        icon: 'C',
        sizeScale: 0,
        tiers: { good: { price: 1000 + i, label: `Good ${i}` } }
      }));
      customizeBudgetData = {
        id: 'scroll-budget',
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        currentState: { propertyType: 'residential', homeSize: 4000, selections: {}, extras: {} },
        categoryConfig: {
          __defaultCategories: { residential: categories, condo: [] },
          __defaultSections: {
            residential: [
              { id: 'infrastructure', name: 'Infrastructure', order: 0 },
              { id: 'audio', name: 'Audio', order: 1 }
            ],
            condo: []
          }
        },
        customCategories: []
      };
      const modal = document.getElementById('customizeModal');
      modal.classList.add('active');
      const body = document.getElementById('customizeBody');
      body.style.height = '520px';
      renderCustomizeEditor();
      const scrollArea = document.querySelector('#customizeBody .customize-scroll-area');
      scrollArea.style.height = '420px';
      scrollArea.scrollTop = 900;
      await new Promise(resolve => requestAnimationFrame(resolve));
      const item = document.querySelector('.customize-layout-item[data-item-id="cat-12"]');
      const beforeTop = Math.round(item.getBoundingClientRect().top);
      moveCustomizeItem('default', 'cat-12', 1);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const moved = document.querySelector('.customize-layout-item[data-item-id="cat-12"]');
      const afterTop = Math.round(moved.getBoundingClientRect().top);
      return { beforeTop, afterTop, delta: Math.abs(afterTop - beforeTop) };
    });

    expect(result.delta).toBeLessThanOrEqual(2);
  });

  test('swaps adjacent standard category tier packages while preserving tier labels', async ({ page }) => {
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
    expect(result.goodLabel).toBe('Good Original');
    expect(result.goodPrice).toBe('1500');
    expect(result.goodFeatures).toEqual(['standard feature']);
    expect(result.goodBrands).toBe('Standard Brand');
    expect(result.standardEnabled).toBe(true);
    expect(result.standardLabel).toBe('Standard Original');
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
    expect(result.goodLabel).toBe('Good Original');
    expect(result.goodPrice).toBe('2000');
    expect(result.standardEnabled).toBe(false);
    expect(result.betterLabel).toBe('Better Original');
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

    expect(result.goodLabel).toBe('Custom Good');
    expect(result.goodPrice).toBe('222');
    expect(result.goodFeatures).toEqual(['cs']);
    expect(result.goodBrands).toBe('CB2');
    expect(result.standardLabel).toBe('Custom Standard');
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
