const { test, expect } = require('@playwright/test');

test.describe('Budget Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => categoryDataReady);
    await page.waitForFunction(() => document.querySelectorAll('.category-card').length > 0);
    await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      if (gate) gate.style.display = 'none';
      document.querySelector('header').style.display = '';
      document.querySelector('main').style.display = '';
    });
  });

  test('page loads with title', async ({ page }) => {
    await expect(page).toHaveTitle(/Budget Planner/);
  });

  test('shows initial categories', async ({ page }) => {
    await expect(page.locator('.categories-header h2')).toHaveText('System Categories');
  });

  test('customer page loads live category pricing from API instead of static fallback', async ({ page }) => {
    let apiRequests = 0;
    await page.route('**/api/categories**', async route => {
      apiRequests += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          residential_categories: [{
            id: 'surround',
            section: 'Audio',
            section_id: 'audio',
            name: 'Surround Sound',
            icon: '🔉',
            desc: 'Live API category',
            sizeScale: 0,
            tiers: {
              good: { price: 5300, label: 'Good', tag: 'Good', features: [], brands: '' },
              standard: { price: 11400, label: 'Standard', tag: 'Standard', features: [], brands: '' },
              better: { price: 14800, label: 'Better', tag: 'Better', features: [], brands: '' },
              best: { price: 17900, label: 'Best', tag: 'Best', features: [], brands: '' }
            }
          }],
          residential_sections: [{ id: 'audio', name: 'Audio', order: 0 }],
          residential_extras: [],
          condo_categories: [],
          condo_sections: [],
          condo_extras: [],
          base_sqft: 4000
        })
      });
    });

    await page.reload();
    await page.evaluate(() => categoryDataReady);
    await page.waitForFunction(() => document.querySelectorAll('.category-card').length > 0);
    await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      if (gate) gate.style.display = 'none';
      document.querySelector('header').style.display = '';
      document.querySelector('main').style.display = '';
    });

    const result = await page.evaluate(() => {
      const surround = CONFIGS.residential.categories.find(c => c.id === 'surround');
      return {
        categoryCount: CONFIGS.residential.categories.length,
        prices: Object.fromEntries(Object.entries(surround.tiers).map(([key, tier]) => [key, tier.price]))
      };
    });

    expect(apiRequests).toBeGreaterThan(0);
    expect(result.categoryCount).toBe(1);
    expect(result.prices).toEqual({ good: 5300, standard: 11400, better: 14800, best: 17900 });
  });

  test('customer page fails closed instead of rendering stale static pricing', async ({ page }) => {
    await page.route('**/api/categories**', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Live category pricing unavailable' })
      });
    });

    await page.reload();
    const loaded = await page.evaluate(() => categoryDataReady);

    await expect(page.locator('text=Pricing is temporarily unavailable')).toBeVisible();
    await expect(page.locator('.category-card')).toHaveCount(0);
    await expect(page.locator('.summary-bar')).toBeHidden();
    expect(loaded).toBe(false);
  });

  test('can expand category', async ({ page }) => {
    const firstCategory = page.locator('.category-header').first();
    await firstCategory.click();
    await expect(page.locator('.category-card.open')).toBeVisible();
  });

  test('selecting tier updates total', async ({ page }) => {
    const initialTotal = await page.locator('#headerTotal').textContent();

    await page.evaluate(() => {
      const categoryWithGood = [...document.querySelectorAll('.category-card')]
        .find(card => card.querySelector('.tier-btn.good-btn'));
      categoryWithGood?.querySelector('.category-header')?.click();
      categoryWithGood?.querySelector('.tier-btn.good-btn')?.click();
    });
    
    // Check total changed
    const newTotal = await page.locator('#headerTotal').textContent();
    expect(newTotal).not.toBe(initialTotal);
  });

  test('customer ignores template tiers marked disabled but preserves their data server-side', async ({ page }) => {
    const result = await page.evaluate(() => {
      CONFIGS.residential = {
        categories: [{
          id: 'security',
          section: 'Security',
          section_id: 'security',
          name: 'Security',
          icon: '🔒',
          desc: 'Security',
          sizeScale: 0,
          tiers: {
            good: { price: 1000, label: 'Good', tag: 'Good', features: ['Good sensors'], brands: 'Good Brand' },
            best: { enabled: false, price: 3000, label: 'Best', tag: 'Best', features: ['Best sensors'], brands: 'Best Brand' }
          }
        }],
        sections: [{ id: 'security', name: 'Security', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.homeSize = 4000;
      state.selections = { security: 'best' };
      state.extras = {};
      state.catMods = {};
      state.modifiers = [];
      renderCategories();
      updateTotals();
      return {
        bestButtonVisible: !!document.querySelector('#cat-security .tier-btn.best-btn'),
        categoryShowsSkipped: document.querySelector('#cat-security .category-price')?.textContent.trim(),
        bestPrice: getCategoryPrice(CONFIGS.residential.categories[0], 'best'),
        headerTotal: document.getElementById('headerTotal')?.textContent.trim()
      };
    });

    expect(result.bestButtonVisible).toBe(false);
    expect(result.categoryShowsSkipped).toBe('Not selected');
    expect(result.bestPrice).toBe(0);
    expect(result.headerTotal).toBe('$0');
  });

  test('customer hides dependent categories until parent selection is active', async ({ page }) => {
    const result = await page.evaluate(() => {
      CONFIGS.residential = {
        categories: [
          {
            id: 'lighting-centralized',
            section: 'Lighting',
            section_id: 'lighting',
            name: 'Centralized Lighting',
            icon: 'C',
            desc: 'Lighting control',
            sizeScale: 0,
            tiers: {
              good: { price: 1000, label: 'Good', tag: 'Good', features: [], brands: '' },
              better: { price: 2000, label: 'Better', tag: 'Better', features: [], brands: '' }
            }
          },
          {
            id: 'lighting-designer',
            section: 'Lighting',
            section_id: 'lighting',
            name: 'Designer Keypads',
            icon: 'D',
            desc: 'Designer keypad upgrade',
            sizeScale: 0,
            dependsOn: { categoryId: 'lighting-centralized', tierKeys: ['better'] },
            tiers: {
              good: { price: 500, label: 'Good', tag: 'Good', features: [], brands: '' }
            }
          }
        ],
        sections: [{ id: 'lighting', name: 'Lighting', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.selections = { 'lighting-centralized': null, 'lighting-designer': 'good' };
      state.extras = {};
      state.catMods = {};
      state.modifiers = [];
      state.addOns = {};
      renderCategories();
      updateTotals();
      const hiddenInitially = !document.getElementById('cat-lighting-designer');
      const totalInitially = document.getElementById('statSubtotal').textContent;
      const designerSelectionAfterCleanup = state.selections['lighting-designer'];

      selectTier('lighting-centralized', 'good');
      const hiddenOnWrongTier = !document.getElementById('cat-lighting-designer');

      selectTier('lighting-centralized', 'better');
      const visibleOnRequiredTier = !!document.getElementById('cat-lighting-designer');
      selectTier('lighting-designer', 'good');
      const totalWithDependency = document.getElementById('statSubtotal').textContent;

      selectTier('lighting-centralized', null);
      const hiddenAfterParentClear = !document.getElementById('cat-lighting-designer');
      const designerSelectionAfterParentClear = state.selections['lighting-designer'];
      const totalAfterParentClear = document.getElementById('statSubtotal').textContent;

      return {
        hiddenInitially,
        totalInitially,
        designerSelectionAfterCleanup,
        hiddenOnWrongTier,
        visibleOnRequiredTier,
        totalWithDependency,
        hiddenAfterParentClear,
        designerSelectionAfterParentClear,
        totalAfterParentClear
      };
    });

    expect(result.hiddenInitially).toBe(true);
    expect(result.totalInitially).toBe('$0');
    expect(result.designerSelectionAfterCleanup).toBe(null);
    expect(result.hiddenOnWrongTier).toBe(true);
    expect(result.visibleOnRequiredTier).toBe(true);
    expect(result.totalWithDependency).toBe('$2,500');
    expect(result.hiddenAfterParentClear).toBe(true);
    expect(result.designerSelectionAfterParentClear).toBe(null);
    expect(result.totalAfterParentClear).toBe('$0');
  });

  test('customer categories behave as a single-open accordion', async ({ page }) => {
    const headers = page.locator('.category-header');
    await headers.nth(0).click();
    await expect(page.locator('.category-card.open')).toHaveCount(1);
    const firstOpenId = await page.locator('.category-card.open').first().getAttribute('id');

    await headers.nth(1).click();
    await expect(page.locator('.category-card.open')).toHaveCount(1);
    const secondOpenId = await page.locator('.category-card.open').first().getAttribute('id');
    expect(secondOpenId).not.toBe(firstOpenId);

    await page.click('text=Collapse All');
    await expect(page.locator('.category-card.open')).toHaveCount(0);
  });

  test('accordion keeps clicked category anchored when a long category collapses', async ({ page }) => {
    const result = await page.evaluate(async () => {
      CONFIGS.residential = {
        categories: [
          {
            id: 'networking',
            section: 'Infrastructure',
            section_id: 'infrastructure',
            name: 'Whole-Home WiFi & Networking',
            icon: '📡',
            desc: 'Enterprise-grade WiFi coverage',
            sizeScale: 0,
            presentationMode: 'matrix',
            featureMatrix: Array.from({ length: 42 }, (_, index) => ({
              id: `networking-scroll-${index}`,
              label: `Network feature ${index + 1}`,
              tierStatus: { good: 'included', standard: 'addon', better: 'included', best: 'included' }
            })),
            tiers: {
              good: { price: 1000, label: 'Good', tag: 'Good', features: [], brands: '' },
              standard: { price: 1500, label: 'Standard', tag: 'Standard', features: [], brands: '' },
              better: { price: 2000, label: 'Better', tag: 'Better', features: [], brands: '' },
              best: { price: 3000, label: 'Best', tag: 'Best', features: [], brands: '' }
            }
          },
          {
            id: 'surveillance',
            section: 'Infrastructure',
            section_id: 'infrastructure',
            name: 'Surveillance & Security Cameras',
            icon: '📹',
            desc: 'Camera coverage',
            sizeScale: 0,
            tiers: {
              good: { price: 800, label: 'Good', tag: 'Good', features: ['Entry cameras'], brands: '' },
              better: { price: 1600, label: 'Better', tag: 'Better', features: ['More cameras'], brands: '' }
            }
          }
        ],
        sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.selections = { networking: 'better', surveillance: null };
      state.catMods = { networking: { name: '', amount: 0 }, surveillance: { name: '', amount: 0 } };
      renderCategories();
      document.getElementById('cat-networking').classList.add('open');

      const targetCard = document.getElementById('cat-surveillance');
      const targetHeader = targetCard.querySelector('.category-header');
      targetHeader.scrollIntoView({ block: 'center' });
      await new Promise(requestAnimationFrame);
      const beforeTop = targetHeader.getBoundingClientRect().top;
      targetHeader.click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const afterTop = targetHeader.getBoundingClientRect().top;

      return {
        beforeTop,
        afterTop,
        openCount: document.querySelectorAll('.category-card.open').length,
        surveillanceOpen: targetCard.classList.contains('open'),
        networkingOpen: document.getElementById('cat-networking').classList.contains('open'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4
      };
    });

    expect(result.openCount).toBe(1);
    expect(result.surveillanceOpen).toBe(true);
    expect(result.networkingOpen).toBe(false);
    expect(Math.abs(result.afterTop - result.beforeTop)).toBeLessThanOrEqual(2);
    expect(result.overflow).toBe(false);
  });

  test('renders comparison matrix categories with selected tier highlight', async ({ page }) => {
    const result = await page.evaluate(() => {
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
          tierOrder: ['best', 'good', 'better'],
          featureMatrix: [
            {
              id: 'wifi-coverage',
              label: 'Whole-home WiFi coverage',
              description: 'Reliable wireless coverage throughout the home.',
              tierStatus: { good: 'included', standard: 'included', better: { status: 'included', label: 'Upgraded' }, best: 'included' }
            },
            {
              id: 'ups-backup',
              label: 'UPS backup',
              description: 'Keeps the network alive during short power outages.',
              tierStatus: { good: 'addon', standard: 'addon', better: 'included', best: 'included' }
            },
            {
              id: 'enterprise-switching',
              label: 'Enterprise switching',
              tierStatus: { good: 'not_included', standard: 'not_included', better: 'addon', best: 'included' }
            },
            {
              id: 'dedicated-rack',
              label: 'Dedicated equipment rack',
              tierStatus: { good: 'not_included', standard: 'not_included', better: 'not_included', best: 'included' }
            }
          ].concat(Array.from({ length: 36 }, (_, index) => ({
            id: `qa-feature-${index}`,
            label: `QA scroll feature ${index + 1}`,
            tierStatus: { good: 'not_included', standard: 'addon', better: 'included', best: 'included' }
          }))),
          tiers: {
            good: { price: 1000, label: 'Good', tag: 'Good', features: ['Whole-home WiFi coverage'], brands: 'Brand A' },
            better: { price: 2000, label: 'Better', tag: 'Better', features: ['Whole-home WiFi coverage', 'UPS backup'], brands: 'Brand B' },
            best: { price: 3000, label: 'Best', tag: 'Best', features: ['Whole-home WiFi coverage', 'UPS backup', 'Enterprise switching'], brands: 'Brand C' }
          }
        }],
        sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.selections = { networking: 'better' };
      state.catMods = { networking: { name: '', amount: 0 } };
      renderCategories();
      document.getElementById('cat-networking').classList.add('open');
      const stickyHeading = document.querySelector('.comparison-desktop-panel');
      const stickyOffset = Math.ceil(document.querySelector('header').getBoundingClientRect().height);
      const headingDocumentTop = stickyHeading.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, headingDocumentTop - stickyOffset + 420);
      const stickyHeadingTopAfterScroll = stickyHeading.getBoundingClientRect().top;
      return {
        title: document.querySelector('.comparison-matrix-title')?.textContent,
        featureHeader: document.querySelector('.comparison-desktop-feature-heading')?.textContent.trim(),
        tierNames: [...document.querySelectorAll('.comparison-desktop-panel .comparison-tier-name')].map(el => el.textContent.trim()),
        tierPrices: [...document.querySelectorAll('.comparison-desktop-panel .comparison-tier-price')].map(el => el.textContent.trim()),
        skipCells: [...document.querySelectorAll('.comparison-table tbody tr td:nth-child(2)')].slice(0, 4).map(el => el.textContent.trim()),
        bestBadge: document.querySelector('.comparison-desktop-panel .comparison-tier-card.best .comparison-tier-badge')?.textContent.trim(),
        mobileTabs: [...document.querySelectorAll('.comparison-mobile-tab')].map(el => el.textContent.trim()),
        mobileActiveKicker: document.querySelector('.comparison-mobile-active-kicker')?.textContent.trim(),
        mobileActiveName: document.querySelector('.comparison-mobile-active-name')?.textContent.trim(),
        mobileActivePrice: document.querySelector('.comparison-mobile-active-price')?.textContent.trim(),
        mobileFeatureRows: [...document.querySelectorAll('.comparison-mobile-focus .mobile-feature-compare-title')].slice(0, 4).map(el => el.textContent.trim()),
        mobileMissingStatus: [...document.querySelectorAll('.comparison-mobile-focus .mobile-feature-compare-card')]
          .find(card => card.textContent.includes('Dedicated equipment rack'))
          ?.querySelector('.mobile-feature-status .matrix-empty')?.textContent.trim(),
        includedNote: [...document.querySelectorAll('.comparison-table tbody tr')]
          .find(row => row.textContent.includes('Whole-home WiFi coverage'))
          ?.querySelector('td.selected-col .matrix-included-label')?.textContent.trim(),
        mobileIncludedNote: [...document.querySelectorAll('.comparison-mobile-focus .mobile-feature-compare-card')]
          .find(card => card.textContent.includes('Whole-home WiFi coverage'))
          ?.querySelector('.mobile-feature-status.selected .matrix-included-label')?.textContent.trim(),
        mobileTooltipTitle: document.querySelector('.comparison-mobile-focus .mobile-feature-compare-title.has-description')?.getAttribute('title'),
        addOnCount: document.querySelectorAll('.matrix-addon').length,
        selectedHeader: document.querySelector('.comparison-desktop-panel .selected-col .comparison-tier-name')?.textContent.trim(),
        desktopHeaderSticky: getComputedStyle(stickyHeading).position,
        desktopPanelDisplay: getComputedStyle(stickyHeading).display,
        desktopHeaderTopAfterScroll: stickyHeadingTopAfterScroll,
        stickyOffset,
        mobilePanelSticky: getComputedStyle(document.querySelector('.comparison-mobile-panel')).position,
        legacyTierSelectorVisible: !!document.querySelector('#cat-networking .tier-selector'),
        tooltip: document.querySelector('.matrix-feature-label.has-description')?.getAttribute('title'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4
      };
    });

    expect(result.title).toBe("Compare what's included");
    expect(result.featureHeader).toBe('Feature');
    expect(result.tierNames).toEqual(['Skip', 'Good', 'Better', 'Best']);
    expect(result.tierPrices).toEqual(['$1,000', '$2,000', '$3,000']);
    expect(result.skipCells).toEqual(['—', '—', '—', '—']);
    expect(result.bestBadge).toBe('Best experience');
    expect(result.mobileTabs).toEqual(['Skip', 'Good', 'Better', 'Best']);
    expect(result.mobileActiveKicker).toBe('Better');
    expect(result.mobileActiveName).toBe('Better');
    expect(result.mobileActivePrice).toBe('$2,000');
    expect(result.mobileFeatureRows).toEqual([
      'Whole-home WiFi coverage',
      'UPS backup',
      'Enterprise switching',
      'Dedicated equipment rack'
    ]);
    expect(result.mobileMissingStatus).toBe('—');
    expect(result.includedNote).toBe('Upgraded');
    expect(result.mobileIncludedNote).toBe('Upgraded');
    expect(result.mobileTooltipTitle).toContain('Reliable wireless coverage');
    expect(result.addOnCount).toBeGreaterThan(0);
    expect(result.selectedHeader).toBe('Better');
    if (result.desktopPanelDisplay !== 'none') {
      expect(result.desktopHeaderSticky).toBe('sticky');
      expect(Math.abs(result.desktopHeaderTopAfterScroll - result.stickyOffset)).toBeLessThanOrEqual(2);
    }
    expect(result.mobilePanelSticky).toBe('sticky');
    expect(result.legacyTierSelectorVisible).toBe(false);
    expect(result.tooltip).toContain('Reliable wireless coverage');
    expect(result.overflow).toBe(false);
  });

  test('comparison matrix feature descriptions open popovers on desktop and mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
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
          featureMatrix: [{
            id: 'wifi-coverage',
            label: 'Whole-home WiFi coverage',
            description: 'Reliable wireless coverage throughout the home.\nIncludes indoor and outdoor access points.',
            tierStatus: { good: 'included', standard: 'included', better: 'included', best: 'included' }
          }],
          tiers: {
            good: { price: 1000, label: 'Good', tag: 'Good', features: ['Whole-home WiFi coverage'], brands: 'Brand A' },
            better: { price: 2000, label: 'Better', tag: 'Better', features: ['Whole-home WiFi coverage'], brands: 'Brand B' }
          }
        }],
        sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        extras: []
      };
      state.propertyType = 'residential';
      state.selections = { networking: 'better' };
      renderCategories();
      document.getElementById('cat-networking').classList.add('open');
    });

    await page.locator('.matrix-feature-label.has-description').click();
    await expect(page.locator('.matrix-feature-popover')).toContainText('Reliable wireless coverage');
    await expect(page.locator('.matrix-feature-popover')).toContainText('Includes indoor and outdoor access points');
    expect(await page.locator('.matrix-feature-popover').evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre-line');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.locator('.comparison-mobile-focus .mobile-feature-compare-title.has-description').click();
    await expect(page.locator('.matrix-feature-popover')).toContainText('Reliable wireless coverage');
    await expect(page.locator('.matrix-feature-popover')).toContainText('Includes indoor and outdoor access points');
  });

  test('priced comparison add-ons can be toggled and saved in state', async ({ page }) => {
    const result = await page.evaluate(() => {
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
              tierStatus: { good: 'included', better: 'included' }
            },
            {
              id: 'ups-backup',
              label: 'UPS backup',
              description: 'Keeps the network alive during short power outages.',
              tierStatus: { good: { status: 'addon', price: 250, scale: 0.5 }, better: 'included' }
            }
          ],
          tiers: {
            good: { price: 1000, label: 'Good', tag: 'Good', features: ['Whole-home WiFi coverage'], brands: 'Brand A' },
            better: { price: 2000, label: 'Better', tag: 'Better', features: ['Whole-home WiFi coverage', 'UPS backup'], brands: 'Brand B' }
          }
        }],
        sections: [{ id: 'infrastructure', name: 'Infrastructure', order: 0 }],
        extras: []
      };
      currentBudgetId = null;
      state.propertyType = 'residential';
      state.homeSize = 8000;
      state.selections = { networking: 'good' };
      state.catMods = { networking: { name: '', amount: 0 } };
      state.extras = {};
      state.modifiers = [];
      state.addOns = {};
      renderCategories();
      updateTotals();
      document.getElementById('cat-networking').classList.add('open');

      const before = document.getElementById('headerTotal').textContent;
      const tierPriceBefore = document.querySelector('.comparison-tier-card.good .comparison-tier-price')?.textContent.trim();
      const buttonBefore = document.querySelector('.comparison-table td.selected-col .matrix-addon-toggle')?.textContent.replace(/\s+/g, ' ').trim();
      toggleMatrixAddOn({ preventDefault() {}, stopPropagation() {} }, 'networking', 'good', 'ups-backup');
      const after = document.getElementById('headerTotal').textContent;
      const buttonAfter = document.querySelector('.comparison-table td.selected-col .matrix-addon-toggle')?.textContent.replace(/\s+/g, ' ').trim();
      const categoryHeaderPrice = document.querySelector('#cat-networking .category-price')?.textContent.trim();
      const tierPriceAfter = document.querySelector('.comparison-tier-card.good .comparison-tier-price')?.textContent.trim();
      const mobileActivePriceAfter = document.querySelector('.comparison-mobile-active-price')?.textContent.trim();
      const apiState = getStateForAPI();
      showSummary();
      const summaryRows = [...document.querySelectorAll('#summaryBody tbody tr')].map(row => row.textContent.replace(/\s+/g, ' ').trim());

      return {
        before,
        tierPriceBefore,
        buttonBefore,
        after,
        buttonAfter,
        categoryHeaderPrice,
        tierPriceAfter,
        mobileActivePriceAfter,
        savedAddOn: apiState.addOns?.networking?.good?.['ups-backup'],
        savedTotal: apiState.total,
        summaryHasAddOn: summaryRows.some(row => row.includes('UPS backup') && row.includes('Add-on') && row.includes('$400'))
      };
    });

    expect(result.before).toBe('$1,060');
    expect(result.tierPriceBefore).toBe('$1,000');
    expect(result.buttonBefore).toBe('+ Add $400');
    expect(result.after).toBe('$1,484');
    expect(result.buttonAfter).toBe('✓ Added $400');
    expect(result.categoryHeaderPrice).toBe('$1,400');
    expect(result.tierPriceAfter).toBe('$1,400');
    expect(result.mobileActivePriceAfter).toBe('$1,400');
    expect(result.savedAddOn).toBe(true);
    expect(result.savedTotal).toBe(1484);
    expect(result.summaryHasAddOn).toBe(true);
  });
});
