const { test, expect } = require('@playwright/test');

test.describe('Budget Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
              tierStatus: { good: 'included', standard: 'included', better: 'included', best: 'included' }
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
              tierStatus: { good: { status: 'addon', price: 250 }, better: 'included' }
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
      state.selections = { networking: 'good' };
      state.catMods = { networking: { name: '', amount: 0 } };
      state.extras = {};
      state.modifiers = [];
      state.addOns = {};
      renderCategories();
      updateTotals();
      document.getElementById('cat-networking').classList.add('open');

      const before = document.getElementById('headerTotal').textContent;
      const buttonBefore = document.querySelector('.comparison-table td.selected-col .matrix-addon-toggle')?.textContent.replace(/\s+/g, ' ').trim();
      toggleMatrixAddOn({ preventDefault() {}, stopPropagation() {} }, 'networking', 'good', 'ups-backup');
      const after = document.getElementById('headerTotal').textContent;
      const buttonAfter = document.querySelector('.comparison-table td.selected-col .matrix-addon-toggle')?.textContent.replace(/\s+/g, ' ').trim();
      const categoryHeaderPrice = document.querySelector('#cat-networking .category-price')?.textContent.trim();
      const apiState = getStateForAPI();
      showSummary();
      const summaryRows = [...document.querySelectorAll('#summaryBody tbody tr')].map(row => row.textContent.replace(/\s+/g, ' ').trim());

      return {
        before,
        buttonBefore,
        after,
        buttonAfter,
        categoryHeaderPrice,
        savedAddOn: apiState.addOns?.networking?.good?.['ups-backup'],
        savedTotal: apiState.total,
        summaryHasAddOn: summaryRows.some(row => row.includes('UPS backup') && row.includes('Add-on') && row.includes('$250'))
      };
    });

    expect(result.before).toBe('$1,060');
    expect(result.buttonBefore).toBe('+ Add $250');
    expect(result.after).toBe('$1,325');
    expect(result.buttonAfter).toBe('✓ Added $250');
    expect(result.categoryHeaderPrice).toBe('$1,250');
    expect(result.savedAddOn).toBe(true);
    expect(result.savedTotal).toBe(1325);
    expect(result.summaryHasAddOn).toBe(true);
  });
});
