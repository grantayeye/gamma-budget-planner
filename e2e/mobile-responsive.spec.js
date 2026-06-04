const { test, expect } = require('@playwright/test');

async function horizontalOverflow(page, selector = 'body') {
  return page.locator(selector).evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    overflow: el.scrollWidth > el.clientWidth + 4
  }));
}

test.describe('Mobile responsive layout', () => {
  test('customer budget actions fit mobile touch targets without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overflow = await horizontalOverflow(page, 'body');
    expect(overflow.overflow).toBe(false);

    const actionMetrics = await page.locator('.summary-actions .btn').evaluateAll(buttons => buttons.map(btn => {
      const rect = btn.getBoundingClientRect();
      return { text: btn.textContent.trim(), width: rect.width, height: rect.height };
    }));
    expect(actionMetrics.length).toBeGreaterThan(0);
    for (const metric of actionMetrics) {
      expect(metric.height, `${metric.text} height`).toBeGreaterThanOrEqual(44);
      expect(metric.width, `${metric.text} width`).toBeGreaterThanOrEqual(120);
    }
  });

  test('customer comparison matrix stays comparison-first on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      if (gate) gate.style.display = 'none';
      document.querySelector('header').style.display = '';
      document.querySelector('main').style.display = '';
      CONFIGS.residential = {
        categories: [{
          id: 'networking',
          section: 'Infrastructure',
          section_id: 'infrastructure',
          name: 'Whole-Home WiFi & Networking',
          icon: '📡',
          desc: 'Enterprise-grade WiFi coverage',
          sizeScale: 0,
          presentationMode: 'matrix',
          featureMatrix: [
            {
              id: 'wifi-coverage',
              label: 'Whole-home WiFi coverage',
              description: 'Reliable wireless coverage throughout the home.',
              tierStatus: { good: 'included', standard: 'included', better: 'included', best: 'included' }
            },
            {
              id: 'ups-backup',
              label: 'UPS backup',
              tierStatus: { good: 'addon', standard: 'addon', better: 'included', best: 'included' }
            },
            {
              id: 'dedicated-rack',
              label: 'Dedicated equipment rack',
              tierStatus: { good: 'not_included', standard: 'not_included', better: 'not_included', best: 'included' }
            }
          ],
          tiers: {
            good: { price: 1000, label: 'Reliable, Basic Coverage', tag: 'Good', features: ['Whole-home WiFi coverage'], brands: 'Brand A' },
            standard: { price: 1500, label: 'Standard', tag: 'Standard', features: ['Whole-home WiFi coverage'], brands: 'Brand B' },
            better: { price: 2000, label: 'Full Coverage', tag: 'Better', features: ['Whole-home WiFi coverage', 'UPS backup'], brands: 'Brand C' },
            best: { price: 3000, label: 'Enterprise Class', tag: 'Best', features: ['Whole-home WiFi coverage', 'UPS backup', 'Dedicated equipment rack'], brands: 'Brand D' }
          }
        }],
        sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.selections = { networking: 'good' };
      state.catMods = { networking: { name: '', amount: 0 } };
      renderCategories();
      document.getElementById('cat-networking').classList.add('open');

      const matrix = document.querySelector('.comparison-matrix');
      const mobile = matrix.querySelector('.comparison-mobile-focus');
      const table = matrix.querySelector('.comparison-table-scroll');
      const tierRail = matrix.querySelector('.comparison-mobile-tier-scroll');
      const missingRow = [...matrix.querySelectorAll('.mobile-feature-compare-card')]
        .find(card => card.textContent.includes('Dedicated equipment rack'));
      return {
        bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
        mobileDisplay: getComputedStyle(mobile).display,
        tableDisplay: getComputedStyle(table).display,
        tierNames: [...matrix.querySelectorAll('.comparison-mobile-tier-grid .comparison-tier-name')].map(el => el.textContent.trim()),
        tierPackages: [...matrix.querySelectorAll('.comparison-mobile-tier-grid .comparison-tier-package')].map(el => el.textContent.trim()),
        featureRows: matrix.querySelectorAll('.mobile-feature-compare-card').length,
        missingStatuses: [...missingRow.querySelectorAll('.mobile-feature-status')].map(el => el.textContent.replace(/\s+/g, ' ').trim()),
        selectedCells: matrix.querySelectorAll('.mobile-feature-status.selected.good-col').length,
        railFits: tierRail.scrollWidth <= tierRail.clientWidth + 4
      };
    });

    expect(result.bodyOverflow).toBe(false);
    expect(result.mobileDisplay).toBe('block');
    expect(result.tableDisplay).toBe('none');
    expect(result.tierNames).toEqual(['Skip', 'Good', 'Standard', 'Better', 'Best']);
    expect(result.tierPackages).toEqual(['No system', 'Reliable, Basic Coverage', 'Standard', 'Full Coverage', 'Enterprise Class']);
    expect(result.featureRows).toBe(3);
    expect(result.missingStatuses).toEqual(['Skip —', 'Good —', 'Standard —', 'Better —', 'Best ✓']);
    expect(result.selectedCells).toBeGreaterThan(0);
    expect(result.railFits).toBe(true);
  });

  test('admin budget list renders mobile cards while preserving the desktop table', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    await page.waitForFunction(() => typeof renderBudgets === 'function');

    const result = await page.evaluate(() => {
      budgets = [
        {
          id: 'qa123456',
          clientName: 'Mobile QA Residence',
          builder: 'Gamma Homes',
          status: 'active',
          currentTotal: 123456,
          created: new Date().toISOString(),
          clientViews: 2,
          internalViews: 1,
          activeBrowserCount: 0,
          versionCount: 3,
          lastClientActivity: new Date().toISOString(),
          createdByEmail: 'qa@gamma.tech',
          isCustomized: true,
          isExpired: false
        }
      ];
      budgetHideExpired = false;
      budgetStatusFilter = 'all';
      renderBudgets();

      const mobile = document.getElementById('budgetMobileList');
      const table = document.getElementById('budgetsTableWrap');
      return {
        mobileDisplay: getComputedStyle(mobile).display,
        tableDisplay: getComputedStyle(table).display,
        cards: mobile.querySelectorAll('.budget-mobile-card').length,
        tableRows: document.querySelectorAll('#budgetTableBody tr').length,
        mobileOverflow: mobile.scrollWidth > mobile.clientWidth + 4
      };
    });

    expect(result.mobileDisplay).not.toBe('none');
    expect(result.tableDisplay).toBe('none');
    expect(result.cards).toBe(1);
    expect(result.tableRows).toBe(1);
    expect(result.mobileOverflow).toBe(false);
  });

  test('customize modal stacks controls and keeps sticky actions visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    await page.waitForFunction(() => typeof renderCustomizeEditor === 'function');

    const result = await page.evaluate(() => {
      budgets = [{ id: 'source123', clientName: 'Source Budget', builder: 'Builder' }];
      catData = {
        residential_categories: [
          {
            id: 'networking',
            section: 'Infrastructure',
            section_id: 'infrastructure',
            sectionId: 'infrastructure',
            sortOrder: 0,
            name: 'Whole-Home WiFi & Networking',
            icon: '📡',
            desc: 'Network infrastructure',
            sizeScale: 0,
            tiers: {
              good: { price: 1000, label: 'Good', features: ['Good'], brands: 'Brand A' },
              standard: { price: 1500, label: 'Standard', features: ['Standard'], brands: 'Brand B' },
              better: { price: 2000, label: 'Better', features: ['Better'], brands: 'Brand C' },
              best: { price: 2500, label: 'Best', features: ['Best'], brands: 'Brand D' }
            }
          }
        ],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [],
        condo_categories: [],
        condo_sections: [],
        condo_extras: [],
        base_sqft: 4000
      };
      customizeBudgetId = 'target123';
      customizeBudgetData = {
        id: 'target123',
        clientName: 'Mobile Customize QA',
        currentState: { homeSize: 4000, propertyType: 'residential', selections: {}, extras: {} },
        categoryConfig: {},
        customCategories: [
          {
            id: 'custom-1',
            name: 'Custom Section (1)',
            icon: '📦',
            section: 'Custom',
            section_id: 'custom',
            sectionId: 'custom',
            tiers: {
              good: { enabled: true, label: 'Good', price: 100 },
              standard: { enabled: true, label: 'Standard', price: 200 },
              better: { enabled: true, label: 'Better', price: 300 }
            }
          }
        ]
      };
      document.getElementById('customizeTitle').textContent = 'Mobile Customize QA';
      document.getElementById('customizeModal').classList.add('active');
      renderCustomizeEditor();

      const modal = document.querySelector('#customizeModal .modal');
      const body = document.getElementById('customizeBody');
      const footer = document.querySelector('.customize-actions-sticky');
      const tier = document.querySelector('.customize-tier-row');
      const copyGrid = document.querySelector('.copy-section-grid');
      return {
        modalOverflow: modal.scrollWidth > modal.clientWidth + 4,
        bodyOverflow: body.scrollWidth > body.clientWidth + 4,
        footerBottom: Math.round(footer.getBoundingClientRect().bottom),
        viewportHeight: window.innerHeight,
        tierColumns: getComputedStyle(tier).gridTemplateColumns.split(' ').length,
        copyColumns: getComputedStyle(copyGrid).gridTemplateColumns.split(' ').length
      };
    });

    expect(result.modalOverflow).toBe(false);
    expect(result.bodyOverflow).toBe(false);
    expect(result.footerBottom).toBeLessThanOrEqual(result.viewportHeight);
    expect(result.tierColumns).toBe(3);
    expect(result.copyColumns).toBe(1);
  });

  test('budget details modal keeps close button visible while scrolling on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    await page.waitForFunction(() => typeof showBudgetModal === 'function');

    const result = await page.evaluate(() => {
      const budget = {
        id: 'mobile-detail-123456',
        clientName: 'Very Long Mobile Budget Details Name That Should Not Push Close Button Off Screen',
        builder: 'Gamma Homes',
        status: 'active',
        created: new Date().toISOString(),
        currentState: {
          total: 123456,
          homeSize: 4000,
          propertyType: 'residential',
          selections: {},
          extras: {}
        },
        sqftLocked: 4000,
        propertyTypeLocked: 'residential',
        views: Array.from({ length: 8 }, (_, index) => ({
          timestamp: new Date(Date.now() - index * 60000).toISOString(),
          isInternal: index % 2 === 0
        })),
        activeBrowsers: [],
        versions: [],
        categoryConfig: {},
        customCategories: []
      };
      showBudgetModal(budget);
      const modal = document.querySelector('#budgetModal .modal');
      const body = document.querySelector('#budgetModal .modal-body');
      const header = document.querySelector('#budgetModal .modal-header');
      const close = document.querySelector('#budgetModal .modal-close');
      body.scrollTop = body.scrollHeight;
      const closeRect = close.getBoundingClientRect();
      const headerStyle = getComputedStyle(header);
      return {
        modalOverflow: modal.scrollWidth > modal.clientWidth + 4,
        bodyOverflow: body.scrollWidth > body.clientWidth + 4,
        closeVisible: closeRect.top >= 0
          && closeRect.left >= 0
          && closeRect.right <= window.innerWidth
          && closeRect.bottom <= window.innerHeight,
        closeWidth: Math.round(closeRect.width),
        closeHeight: Math.round(closeRect.height),
        headerPosition: headerStyle.position
      };
    });

    expect(result.modalOverflow).toBe(false);
    expect(result.bodyOverflow).toBe(false);
    expect(result.closeVisible).toBe(true);
    expect(result.closeWidth).toBeGreaterThanOrEqual(44);
    expect(result.closeHeight).toBeGreaterThanOrEqual(44);
    expect(result.headerPosition).toBe('sticky');
  });

  test('categories and pricing editor uses stacked tier fields on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    await page.waitForFunction(() => typeof loadCategoryEditor === 'function');

    const result = await page.evaluate(() => {
      catData = {
        residential_categories: [
          {
            id: 'networking',
            section: 'Infrastructure',
            section_id: 'infrastructure',
            sectionId: 'infrastructure',
            sortOrder: 0,
            name: 'Whole-Home WiFi & Networking',
            icon: '📡',
            desc: 'Network infrastructure',
            sizeScale: 0,
            tiers: {
              good: { price: 1000, label: 'Good', features: ['Good'], brands: 'Brand A' },
              better: { price: 2000, label: 'Better', features: ['Better'], brands: 'Brand C' }
            }
          }
        ],
        residential_sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        residential_extras: [{ id: 'pool', name: 'Pool Alarm', note: 'Pool', price: 500, sizeScale: 0, default: false }],
        condo_categories: [],
        condo_sections: [],
        condo_extras: [],
        base_sqft: 4000
      };
      document.getElementById('catPropertyType').value = 'residential';
      loadCategoryEditor();
      document.querySelector('.cat-editor-card').classList.add('open');

      const container = document.getElementById('catEditorContainer');
      const fields = document.querySelector('.tier-edit-card:not(.tier-not-configured) .tier-fields');
      const extraRow = document.querySelector('.extra-row[data-extra-idx]');
      return {
        overflow: container.scrollWidth > container.clientWidth + 4,
        tierColumns: getComputedStyle(fields).gridTemplateColumns.split(' ').length,
        extraColumns: getComputedStyle(extraRow).gridTemplateColumns.split(' ').length
      };
    });

    expect(result.overflow).toBe(false);
    expect(result.tierColumns).toBe(1);
    expect(result.extraColumns).toBe(1);
  });

  test('comparison matrix editor uses mobile feature cards without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    await page.waitForFunction(() => typeof loadCategoryEditor === 'function');

    const result = await page.evaluate(() => {
      catData = {
        residential_categories: [
          {
            id: 'networking',
            section: 'Infrastructure',
            section_id: 'infrastructure',
            sectionId: 'infrastructure',
            sortOrder: 0,
            name: 'Whole-Home WiFi & Networking',
            icon: '📡',
            desc: 'Network infrastructure',
            sizeScale: 0,
            tiers: {
              good: { price: 1000, label: 'Good', features: ['WiFi coverage'], brands: 'Brand A' },
              standard: { price: 1500, label: 'Standard', features: ['WiFi coverage', 'Support'], brands: 'Brand B' },
              better: { price: 2000, label: 'Better', features: ['WiFi coverage', 'Support', 'UPS'], brands: 'Brand C' },
              best: { price: 2500, label: 'Best', features: ['WiFi coverage', 'Support', 'UPS', 'Rack'], brands: 'Brand D' }
            }
          }
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
      const card = document.querySelector('.cat-editor-card');
      card.classList.add('open');
      const select = card.querySelector('.presentation-mode-select');
      select.value = 'matrix';
      setMatrixMode(select, 'networking');
      const row = card.querySelector('.feature-matrix-row');
      const tierCell = row?.querySelector('td[data-tier-label]');
      const table = card.querySelector('.feature-matrix-table');
      const header = card.querySelector('.feature-matrix-table thead');
      const tierCard = card.querySelector('.feature-matrix-tier-card[data-tier="good"]');
      return {
        overflow: card.scrollWidth > card.clientWidth + 4,
        tableOverflow: table.scrollWidth > table.clientWidth + 4,
        rowDisplay: getComputedStyle(row).display,
        tierCellDisplay: getComputedStyle(tierCell).display,
        headerDisplay: getComputedStyle(header).display,
        tierCardDisplay: getComputedStyle(tierCard).display,
        editableTierLabels: card.querySelectorAll('.feature-matrix-tier-card .matrix-tier-label').length,
        editableTierPrices: card.querySelectorAll('.feature-matrix-tier-card .matrix-tier-price').length,
        editableTierToggles: card.querySelectorAll('.feature-matrix-tier-card .matrix-tier-enabled').length,
        applyButtons: card.querySelectorAll('.fm-apply-right').length,
        bottomAddButton: card.querySelector('.feature-matrix-bottom-actions > button')?.textContent.trim()
      };
    });

    expect(result.overflow).toBe(false);
    expect(result.tableOverflow).toBe(false);
    expect(result.rowDisplay).toBe('grid');
    expect(result.tierCellDisplay).toBe('grid');
    expect(result.headerDisplay).toBe('block');
    expect(result.tierCardDisplay).toBe('grid');
    expect(result.editableTierLabels).toBeGreaterThan(0);
    expect(result.editableTierPrices).toBeGreaterThan(0);
    expect(result.editableTierToggles).toBeGreaterThan(0);
    expect(result.applyButtons).toBeGreaterThan(0);
    expect(result.bottomAddButton).toBe('+ Feature');
  });
});
