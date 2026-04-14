# Gamma Tech Budget Planner — QA Test Plan

**Last Run:** _______________  
**Tester:** _______________  
**Environment:** https://budget-beta.gamma.tech  
**Production:** https://budget.gamma.tech  
**Status:** ☐ Pass / ☐ Fail / ☐ Partial  

---

## Table of Contents

1. [Setup & Prerequisites](#setup--prerequisites)
2. [Automated Tests (agent-browser)](#automated-tests-agent-browser)
   - [AT-01: Homepage Load & Category Rendering](#at-01-homepage-load--category-rendering)
   - [AT-02: Project Details Form](#at-02-project-details-form)
   - [AT-03: Tier Selection & Total Updates](#at-03-tier-selection--total-updates)
   - [AT-04: Home Size Scaling](#at-04-home-size-scaling)
   - [AT-05: Property Type Switching](#at-05-property-type-switching)
   - [AT-06: Mutual Exclusivity — Lighting](#at-06-mutual-exclusivity--lighting)
   - [AT-07: Mutual Exclusivity — Invisible Speakers](#at-07-mutual-exclusivity--invisible-speakers)
   - [AT-08: Designer Keypads Dependencies](#at-08-designer-keypads-dependencies)
   - [AT-09: Extras Toggle](#at-09-extras-toggle)
   - [AT-10: Custom Modifiers](#at-10-custom-modifiers)
   - [AT-11: Share Link Flow](#at-11-share-link-flow)
   - [AT-12: Live Budget Loading](#at-12-live-budget-loading)
   - [AT-13: Email Modal UI](#at-13-email-modal-ui)
   - [AT-14: Summary Modal](#at-14-summary-modal)
   - [AT-15: Admin Dashboard — Login](#at-15-admin-dashboard--login)
   - [AT-16: Admin Dashboard — Budgets Tab](#at-16-admin-dashboard--budgets-tab)
   - [AT-17: Admin Dashboard — Categories & Pricing Tab](#at-17-admin-dashboard--categories--pricing-tab)
   - [AT-18: Admin Dashboard — Users Tab](#at-18-admin-dashboard--users-tab)
   - [AT-19: Admin — Custom Budget](#at-19-admin--custom-budget)
   - [AT-20: Error Cases](#at-20-error-cases)
   - [AT-21: Regression — Static Asset Paths on /b/ Routes](#at-21-regression--static-asset-paths-on-b-routes)
   - [AT-22: API Health Check](#at-22-api-health-check)
   - [AT-23: Expand All](#at-23-expand-all)
3. [Manual Tests (Team Checklist)](#manual-tests-team-checklist)
   - [MT-01: Mobile Responsiveness](#mt-01-mobile-responsiveness)
   - [MT-02: Visual Quality](#mt-02-visual-quality)
   - [MT-03: Touch Interactions](#mt-03-touch-interactions)
   - [MT-04: Print / PDF](#mt-04-print--pdf)
   - [MT-05: Email Delivery](#mt-05-email-delivery)
   - [MT-06: Clipboard / Share on Mobile](#mt-06-clipboard--share-on-mobile)
   - [MT-07: Cross-Browser](#mt-07-cross-browser)
   - [MT-08: Performance](#mt-08-performance)

---

## Setup & Prerequisites

### For Automated Tests

All automated tests use `agent-browser` CLI with a persistent session. Start every test run by launching the session:

```bash
# Start persistent session (visible browser for debugging)
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa --headed
```

For CI/headless runs, omit `--headed`:

```bash
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
```

### Conventions

- All commands assume `--session-name budget-qa` is appended. Shown inline for the first few tests, then omitted for brevity — **always include it**.
- `EXPECTED:` lines describe what to verify. If the expected result doesn't match, the test fails.
- Screenshots are saved to `/tmp/qa-screenshots/` for review.
- Budget IDs used in share/load tests are created dynamically during the test run.

```bash
mkdir -p /tmp/qa-screenshots
```

### Admin Credentials

Admin login is required for tests AT-15 through AT-19. Credentials:
- **URL:** https://budget-beta.gamma.tech/admin
- **Username:** bradd (stored in 1Password → "Budget Planner Admin")
- **Password:** (stored in 1Password → "Budget Planner Admin")

---

## Automated Tests (agent-browser)

### AT-01: Homepage Load & Category Rendering

Verify the homepage loads and all residential categories render correctly.

```bash
# 1. Navigate to homepage
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa

# 2. Wait for categories to render
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 3. Screenshot initial state
agent-browser screenshot "/tmp/qa-screenshots/AT01-homepage.png" --session-name budget-qa

# 4. Count category cards (residential default = 17 categories)
agent-browser eval "document.querySelectorAll('.category-card').length" --session-name budget-qa
# EXPECTED: 17

# 5. Verify section headers are present
agent-browser eval "Array.from(document.querySelectorAll('.section-header h3')).map(h => h.textContent)" --session-name budget-qa
# EXPECTED: ["Infrastructure", "Audio", "Video", "Control & Automation", "Lighting & Shades", "Security"]

# 6. Verify each card has tier buttons
agent-browser eval "document.querySelectorAll('.category-card .tier-btn').length > 50" --session-name budget-qa
# EXPECTED: true (17 categories × 3-5 tiers each, plus skip buttons)

# 7. Verify header total starts at $0
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: "$0"

# 8. Verify category count display
agent-browser eval "document.getElementById('categoryCount').textContent" --session-name budget-qa
# EXPECTED: "0 of 17 selected"

# 9. Verify Gamma Tech logo is visible
agent-browser eval "document.querySelector('header .logo-img svg') !== null" --session-name budget-qa
# EXPECTED: true

# 10. Verify property type defaults to residential
agent-browser eval "document.getElementById('propertyType').value" --session-name budget-qa
# EXPECTED: "residential"
```

---

### AT-02: Project Details Form

Verify client name, builder, home size, and property type fields work.

```bash
# 1. Fill client name
agent-browser fill "#clientName" "QA Test Client" --session-name budget-qa

# 2. Fill builder
agent-browser fill "#builder" "Test Builder Corp" --session-name budget-qa

# 3. Verify values are set
agent-browser eval "document.getElementById('clientName').value" --session-name budget-qa
# EXPECTED: "QA Test Client"

agent-browser eval "document.getElementById('builder').value" --session-name budget-qa
# EXPECTED: "Test Builder Corp"

# 4. Verify home size default
agent-browser eval "document.getElementById('homeSize').value" --session-name budget-qa
# EXPECTED: "4000"

# 5. Change home size to 5000
agent-browser fill "#homeSize" "5000" --session-name budget-qa

# 6. Verify the value updated
agent-browser eval "document.getElementById('homeSize').value" --session-name budget-qa
# EXPECTED: "5000"
```

---

### AT-03: Tier Selection & Total Updates

Select tiers on multiple categories and verify totals update.

```bash
# 1. Fresh page load
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Click on "Structured Wiring & Pre-Wire" card to expand it
agent-browser click "#cat-prewire .category-header" --session-name budget-qa

# 3. Select "Good" tier for prewire
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa

# 4. Verify card has selection class
agent-browser eval "document.getElementById('cat-prewire').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 5. Verify price is displayed (not "Not selected")
agent-browser eval "document.querySelector('#cat-prewire .category-price').textContent.trim().startsWith('$')" --session-name budget-qa
# EXPECTED: true

# 6. Verify header total is no longer $0
agent-browser eval "document.getElementById('headerTotal').textContent !== '$0'" --session-name budget-qa
# EXPECTED: true

# 7. Select "Better" tier for networking
agent-browser click "#cat-networking .category-header" --session-name budget-qa
agent-browser click "#cat-networking .better-btn" --session-name budget-qa

# 8. Verify category count updated
agent-browser eval "document.getElementById('categoryCount').textContent" --session-name budget-qa
# EXPECTED: "2 of 17 selected"

# 9. Capture the current total for later comparison
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: Should show a dollar amount > $0

# 10. Deselect prewire (click "Skip")
agent-browser click "#cat-prewire .none-btn" --session-name budget-qa

# 11. Verify total decreased
agent-browser eval "document.getElementById('categoryCount').textContent" --session-name budget-qa
# EXPECTED: "1 of 17 selected"

# 12. Screenshot
agent-browser screenshot "/tmp/qa-screenshots/AT03-tier-selection.png" --session-name budget-qa
```

---

### AT-04: Home Size Scaling

Verify prices scale when home size changes.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Set home size to 4000 (baseline)
agent-browser fill "#homeSize" "4000" --session-name budget-qa

# 3. Select Good tier for prewire (sizeScale: 1.0)
agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa

# 4. Get price at 4000 sqft
agent-browser eval "document.querySelector('#cat-prewire .category-price').textContent.trim()" --session-name budget-qa
# EXPECTED: "$12,000" (base price at baseline sqft)

# 5. Change to 6000 sqft
agent-browser fill "#homeSize" "6000" --session-name budget-qa
# Trigger change event
agent-browser eval "document.getElementById('homeSize').dispatchEvent(new Event('input', {bubbles:true}))" --session-name budget-qa

# 6. Wait briefly for re-render
agent-browser wait 500 --session-name budget-qa

# 7. Get price at 6000 sqft — should be higher
agent-browser eval "document.querySelector('#cat-prewire .category-price').textContent.trim()" --session-name budget-qa
# EXPECTED: "$18,000" (6000/4000 = 1.5x with sizeScale 1.0 → $12,000 × 1.5 = $18,000)

# 8. Change to 2000 sqft (below 2500 minimum floor)
agent-browser fill "#homeSize" "2000" --session-name budget-qa
agent-browser eval "document.getElementById('homeSize').dispatchEvent(new Event('input', {bubbles:true}))" --session-name budget-qa
agent-browser wait 500 --session-name budget-qa

# 9. Get price — should use 2500 floor, not 2000
agent-browser eval "document.querySelector('#cat-prewire .category-price').textContent.trim()" --session-name budget-qa
# EXPECTED: "$7,500" (2500/4000 = 0.625 × $12,000 = $7,500)

# 10. Verify a category with sizeScale: 0 (theater) doesn't scale
agent-browser click "#cat-theater .category-header" --session-name budget-qa
agent-browser click "#cat-theater .good-btn" --session-name budget-qa
agent-browser eval "document.querySelector('#cat-theater .category-price').textContent.trim()" --session-name budget-qa
# EXPECTED: "$26,000" (theater sizeScale = 0, price stays fixed regardless of sqft)

agent-browser screenshot "/tmp/qa-screenshots/AT04-size-scaling.png" --session-name budget-qa
```

---

### AT-05: Property Type Switching

Switch to condo and verify different categories load.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Count residential categories
agent-browser eval "document.querySelectorAll('.category-card').length" --session-name budget-qa
# EXPECTED: 17

# 3. Switch to condo
agent-browser select "#propertyType" "condo" --session-name budget-qa
agent-browser wait 500 --session-name budget-qa

# 4. Count condo categories (surveillance, outdoor, security, intercom removed = 13)
agent-browser eval "document.querySelectorAll('.category-card').length" --session-name budget-qa
# EXPECTED: 13

# 5. Verify surveillance is NOT present
agent-browser eval "document.getElementById('cat-surveillance')" --session-name budget-qa
# EXPECTED: null

# 6. Verify outdoor audio is NOT present
agent-browser eval "document.getElementById('cat-outdoor')" --session-name budget-qa
# EXPECTED: null

# 7. Verify security is NOT present
agent-browser eval "document.getElementById('cat-security')" --session-name budget-qa
# EXPECTED: null

# 8. Verify intercom is NOT present
agent-browser eval "document.getElementById('cat-intercom')" --session-name budget-qa
# EXPECTED: null

# 9. Verify extras section is hidden (condo has no extras)
agent-browser eval "document.getElementById('extrasSection').style.display" --session-name budget-qa
# EXPECTED: "none"

# 10. Verify Video Wall Exterior renamed to "Video Wall Balcony/Terrace" for condo
agent-browser eval "document.querySelector('#cat-videowall-exterior .category-name')?.textContent" --session-name budget-qa
# EXPECTED: "Video Wall Balcony/Terrace"

# 11. Switch back to residential
agent-browser select "#propertyType" "residential" --session-name budget-qa
agent-browser wait 500 --session-name budget-qa

# 12. Verify 17 categories again
agent-browser eval "document.querySelectorAll('.category-card').length" --session-name budget-qa
# EXPECTED: 17

# 13. Verify extras section is visible
agent-browser eval "document.getElementById('extrasSection').style.display !== 'none'" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT05-property-type.png" --session-name budget-qa
```

---

### AT-06: Mutual Exclusivity — Lighting

Wireless Lighting and Centralized Lighting are mutually exclusive.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Select Wireless Lighting - Better tier
agent-browser click "#cat-lighting .category-header" --session-name budget-qa
agent-browser click "#cat-lighting .better-btn" --session-name budget-qa

# 3. Verify Wireless Lighting is selected
agent-browser eval "document.getElementById('cat-lighting').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 4. Verify Centralized Lighting card is disabled
agent-browser eval "document.getElementById('cat-lighting-centralized').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

# 5. Deselect Wireless Lighting
agent-browser click "#cat-lighting .none-btn" --session-name budget-qa

# 6. Verify Centralized is no longer disabled
agent-browser eval "document.getElementById('cat-lighting-centralized').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: false

# 7. Select Centralized Lighting - Good tier
agent-browser click "#cat-lighting-centralized .category-header" --session-name budget-qa
agent-browser click "#cat-lighting-centralized .good-btn" --session-name budget-qa

# 8. Verify Wireless Lighting is now disabled
agent-browser eval "document.getElementById('cat-lighting').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

# 9. Verify Centralized is selected
agent-browser eval "document.getElementById('cat-lighting-centralized').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT06-lighting-exclusivity.png" --session-name budget-qa
```

---

### AT-07: Mutual Exclusivity — Invisible Speakers

Invisible Speakers requires Multi-Room Audio selection.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Verify Invisible Speakers is disabled when no audio selected
agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

# 3. Select Multi-Room Audio - Good tier
agent-browser click "#cat-audio .category-header" --session-name budget-qa
agent-browser click "#cat-audio .good-btn" --session-name budget-qa

# 4. Verify Invisible Speakers is now enabled
agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: false

# 5. Select Invisible Speakers - Good tier
agent-browser click "#cat-invisible-speakers .category-header" --session-name budget-qa
agent-browser click "#cat-invisible-speakers .good-btn" --session-name budget-qa

# 6. Verify it's selected
agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 7. Deselect Multi-Room Audio
agent-browser click "#cat-audio .none-btn" --session-name budget-qa

# 8. Verify Invisible Speakers got auto-cleared
agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: false

# 9. Verify Invisible Speakers is disabled again
agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT07-invisible-speakers.png" --session-name budget-qa
```

---

### AT-08: Designer Keypads Dependencies

Designer Keypads requires lighting selection (not Wireless Basic), and Bespoke tier (best) is unavailable with Wireless.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Verify Designer Keypads is disabled when no lighting selected
agent-browser eval "document.getElementById('cat-lighting-designer').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

# 3. Select Wireless Lighting - Good (Basic) tier
agent-browser click "#cat-lighting .category-header" --session-name budget-qa
agent-browser click "#cat-lighting .good-btn" --session-name budget-qa

# 4. Verify Designer Keypads is STILL disabled (Wireless Basic doesn't support it)
agent-browser eval "document.getElementById('cat-lighting-designer').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: true

# 5. Upgrade Wireless to Better tier
agent-browser click "#cat-lighting .better-btn" --session-name budget-qa

# 6. Verify Designer Keypads is now enabled
agent-browser eval "document.getElementById('cat-lighting-designer').classList.contains('disabled')" --session-name budget-qa
# EXPECTED: false

# 7. Open Designer Keypads and check if "best" (Bespoke) tier is disabled with Wireless
agent-browser click "#cat-lighting-designer .category-header" --session-name budget-qa
agent-browser eval "document.querySelector('#cat-lighting-designer .best-btn')?.classList.contains('tier-disabled')" --session-name budget-qa
# EXPECTED: true (Bespoke not available with Wireless Lighting)

# 8. Select Good tier for Designer Keypads (should work)
agent-browser click "#cat-lighting-designer .good-btn" --session-name budget-qa
agent-browser eval "document.getElementById('cat-lighting-designer').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 9. Switch to Centralized Lighting — Designer Keypads should stay but Bespoke should unlock
agent-browser click "#cat-lighting .none-btn" --session-name budget-qa
agent-browser click "#cat-lighting-centralized .category-header" --session-name budget-qa
agent-browser click "#cat-lighting-centralized .good-btn" --session-name budget-qa

# 10. Verify Bespoke is now available with Centralized
agent-browser click "#cat-lighting-designer .category-header" --session-name budget-qa
agent-browser eval "document.querySelector('#cat-lighting-designer .best-btn')?.classList.contains('tier-disabled')" --session-name budget-qa
# EXPECTED: false

agent-browser screenshot "/tmp/qa-screenshots/AT08-designer-keypads.png" --session-name budget-qa
```

---

### AT-09: Extras Toggle

Toggle extra items on/off and verify totals update.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Verify extras section is visible (residential)
agent-browser eval "document.getElementById('extrasSection').style.display !== 'none'" --session-name budget-qa
# EXPECTED: true

# 3. Count extras (residential has 3: Pool Alarm, Fire Detection, Leak Detection)
agent-browser eval "document.querySelectorAll('#extrasGrid .extra-item').length" --session-name budget-qa
# EXPECTED: 3

# 4. Get current total
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: "$0" (nothing selected yet)

# 5. Click first extra (Pool Alarm & Child Safety)
agent-browser click "#extrasGrid .extra-item:first-child" --session-name budget-qa

# 6. Verify it's toggled on
agent-browser eval "document.querySelector('#extrasGrid .extra-item:first-child').classList.contains('active')" --session-name budget-qa
# EXPECTED: true

# 7. Verify total is no longer $0
agent-browser eval "document.getElementById('headerTotal').textContent !== '$0'" --session-name budget-qa
# EXPECTED: true

# 8. Store the total
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: Dollar amount reflecting Pool Alarm price + tax estimate

# 9. Toggle it off
agent-browser click "#extrasGrid .extra-item:first-child" --session-name budget-qa

# 10. Verify total is back to $0
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: "$0"

agent-browser screenshot "/tmp/qa-screenshots/AT09-extras.png" --session-name budget-qa
```

---

### AT-10: Custom Modifiers

Add and remove custom line item modifiers.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Click "Add Line Item" button
agent-browser click "button[onclick='addModifier()']" --session-name budget-qa

# 3. Verify a modifier row appeared
agent-browser eval "document.querySelectorAll('#modifiersContainer > div').length" --session-name budget-qa
# EXPECTED: 1

# 4. Fill modifier description
agent-browser fill "#modifiersContainer input[placeholder='Description']" "Outdoor wiring conduit" --session-name budget-qa

# 5. Fill modifier amount
agent-browser fill "#modifiersContainer input[placeholder='$0']" "5000" --session-name budget-qa
# Trigger input event
agent-browser eval "document.querySelector('#modifiersContainer input[placeholder=\"$0\"]').dispatchEvent(new Event('input', {bubbles:true}))" --session-name budget-qa

# 6. Verify total includes the modifier
agent-browser eval "document.getElementById('headerTotal').textContent !== '$0'" --session-name budget-qa
# EXPECTED: true

# 7. Add a second modifier
agent-browser click "button[onclick='addModifier()']" --session-name budget-qa
agent-browser eval "document.querySelectorAll('#modifiersContainer > div').length" --session-name budget-qa
# EXPECTED: 2

# 8. Remove the first modifier (click the ✕ button)
agent-browser click "#modifiersContainer > div:first-child button" --session-name budget-qa

# 9. Verify only one modifier remains
agent-browser eval "document.querySelectorAll('#modifiersContainer > div').length" --session-name budget-qa
# EXPECTED: 1

agent-browser screenshot "/tmp/qa-screenshots/AT10-modifiers.png" --session-name budget-qa
```

---

### AT-11: Share Link Flow

Create a budget, share it, and verify the shared URL loads correctly.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Fill project details
agent-browser fill "#clientName" "Share Test Client" --session-name budget-qa
agent-browser fill "#homeSize" "5000" --session-name budget-qa

# 3. Select tiers for multiple categories
agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .better-btn" --session-name budget-qa
agent-browser click "#cat-networking .category-header" --session-name budget-qa
agent-browser click "#cat-networking .best-btn" --session-name budget-qa
agent-browser click "#cat-audio .category-header" --session-name budget-qa
agent-browser click "#cat-audio .good-btn" --session-name budget-qa

# 4. Record the current total
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# EXPECTED: Dollar amount > $0 (store this value as SHARE_TOTAL)

# 5. Click Share Link button
agent-browser click "button[onclick='shareLink()']" --session-name budget-qa

# 6. Wait for budget creation
agent-browser wait 3000 --session-name budget-qa

# 7. Verify URL changed to /b/xxxxxxxx pattern
agent-browser eval "window.location.pathname" --session-name budget-qa
# EXPECTED: Matches /b/[a-z0-9]{8} pattern

# 8. Capture the budget URL
agent-browser eval "window.location.href" --session-name budget-qa
# EXPECTED: https://budget-beta.gamma.tech/b/xxxxxxxx (store as BUDGET_URL)

# 9. Screenshot the shared state
agent-browser screenshot "/tmp/qa-screenshots/AT11-share-created.png" --session-name budget-qa

# 10. Open the same URL in a fresh context (simulates new visitor)
# Store the URL first
agent-browser eval "window._testBudgetUrl = window.location.href; window._testBudgetUrl" --session-name budget-qa

# 11. Navigate to homepage first to reset state, then back to budget URL
agent-browser open "about:blank" --session-name budget-qa
agent-browser wait 1000 --session-name budget-qa

# 12. Navigate to the budget URL (manually enter the captured URL)
# In practice, use the captured URL from step 8:
agent-browser eval "window._savedUrl" --session-name budget-qa
# Use the URL pattern — the tester should substitute the real budget ID here:
# agent-browser open "<BUDGET_URL>" --session-name budget-qa
# agent-browser wait "#categoriesContainer" --session-name budget-qa

# For scripting, navigate back:
agent-browser eval "window.history.back()" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa

# 13. Verify selections persisted
agent-browser eval "document.getElementById('cat-prewire').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

agent-browser eval "document.getElementById('cat-networking').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

agent-browser eval "document.getElementById('cat-audio').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 14. Verify client name persisted
agent-browser eval "document.getElementById('clientName').value" --session-name budget-qa
# EXPECTED: "Share Test Client"

# 15. Verify home size persisted
agent-browser eval "document.getElementById('homeSize').value" --session-name budget-qa
# EXPECTED: "5000"

# 16. Verify shared banner appears
agent-browser eval "document.querySelector('.shared-banner') !== null" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT11-share-loaded.png" --session-name budget-qa
```

---

### AT-12: Live Budget Loading

Load an existing budget URL and verify complete state restoration.

```bash
# Prerequisite: AT-11 must have run first to create a budget.
# Use the budget URL from AT-11, or use a known existing budget ID.

# 1. Navigate to a known budget (substitute real ID)
# agent-browser open "https://budget-beta.gamma.tech/b/<BUDGET_ID>" --session-name budget-qa
# agent-browser wait "#categoriesContainer" --session-name budget-qa

# For this test, we'll use the API to create a budget first:
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Set up a budget
agent-browser fill "#clientName" "Load Test Client" --session-name budget-qa
agent-browser fill "#homeSize" "4500" --session-name budget-qa
agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa
agent-browser click "#cat-surveillance .category-header" --session-name budget-qa
agent-browser click "#cat-surveillance .better-btn" --session-name budget-qa

# 3. Share to create live budget
agent-browser click "button[onclick='shareLink()']" --session-name budget-qa
agent-browser wait 3000 --session-name budget-qa

# 4. Store the budget path
agent-browser eval "window.location.pathname" --session-name budget-qa
# Store this as LOAD_TEST_PATH

# 5. Reload the page completely (simulates fresh visit)
agent-browser eval "window.location.reload()" --session-name budget-qa
agent-browser wait 3000 --session-name budget-qa

# 6. Verify categories rendered (not blank)
agent-browser eval "document.querySelectorAll('.category-card').length > 0" --session-name budget-qa
# EXPECTED: true

# 7. Verify selections are applied
agent-browser eval "document.getElementById('cat-prewire').classList.contains('has-selection')" --session-name budget-qa
# EXPECTED: true

# 8. Verify client name populated
agent-browser eval "document.getElementById('clientName').value" --session-name budget-qa
# EXPECTED: "Load Test Client"

# 9. Verify home size correct
agent-browser eval "document.getElementById('homeSize').value" --session-name budget-qa
# EXPECTED: "4500"

# 10. Verify total shows dollar amount (not $0)
agent-browser eval "document.getElementById('headerTotal').textContent !== '$0'" --session-name budget-qa
# EXPECTED: true

# 11. Verify total starts with $
agent-browser eval "document.getElementById('headerTotal').textContent.startsWith('$')" --session-name budget-qa
# EXPECTED: true

# 12. Verify shared banner appears
agent-browser eval "document.querySelector('.shared-banner') !== null" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT12-live-budget.png" --session-name budget-qa
```

---

### AT-13: Email Modal UI

Open the email modal and verify all fields are present. Does NOT send an actual email.

```bash
# 1. Set up a budget with selections
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa
agent-browser fill "#clientName" "Email Test Client" --session-name budget-qa
agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa

# 2. Click Email button
agent-browser click "button[onclick='showEmailModal()']" --session-name budget-qa

# 3. Verify email modal is visible
agent-browser eval "document.getElementById('emailModal').classList.contains('active')" --session-name budget-qa
# EXPECTED: true

# 4. Verify Recipient Name field exists and is pre-filled from client name
agent-browser eval "document.getElementById('emailRecipientName').value" --session-name budget-qa
# EXPECTED: "Email Test Client"

# 5. Verify Recipient Email field exists
agent-browser eval "document.getElementById('emailRecipientEmail') !== null" --session-name budget-qa
# EXPECTED: true

# 6. Verify Subject field exists with default placeholder
agent-browser eval "document.getElementById('emailSubject').placeholder" --session-name budget-qa
# EXPECTED: "Your Technology Budget from Gamma Tech"

# 7. Verify Send button exists and is enabled
agent-browser eval "document.getElementById('emailSendBtn').disabled" --session-name budget-qa
# EXPECTED: false

# 8. Verify Cancel button exists
agent-browser eval "document.querySelector('#emailModal .btn-outline') !== null" --session-name budget-qa
# EXPECTED: true

# 9. Fill in test values (but don't send)
agent-browser fill "#emailRecipientEmail" "test@example.com" --session-name budget-qa
agent-browser fill "#emailSubject" "Test Budget Proposal" --session-name budget-qa

# 10. Screenshot the filled modal
agent-browser screenshot "/tmp/qa-screenshots/AT13-email-modal.png" --session-name budget-qa

# 11. Close the modal
agent-browser click "#emailModal .btn-outline" --session-name budget-qa

# 12. Verify modal is closed
agent-browser eval "document.getElementById('emailModal').classList.contains('active')" --session-name budget-qa
# EXPECTED: false
```

---

### AT-14: Summary Modal

Open the summary modal and verify it displays correct information.

```bash
# 1. Set up budget with multiple selections
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa
agent-browser fill "#clientName" "Summary Test Client" --session-name budget-qa

agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa
agent-browser click "#cat-networking .category-header" --session-name budget-qa
agent-browser click "#cat-networking .better-btn" --session-name budget-qa
agent-browser click "#cat-audio .category-header" --session-name budget-qa
agent-browser click "#cat-audio .good-btn" --session-name budget-qa

# 2. Record the header total
agent-browser eval "document.getElementById('headerTotal').textContent" --session-name budget-qa
# Store as HEADER_TOTAL

# 3. Click "View Summary" button
agent-browser click "button[onclick='showSummary()']" --session-name budget-qa

# 4. Verify summary modal is visible
agent-browser eval "document.getElementById('summaryModal').classList.contains('active')" --session-name budget-qa
# EXPECTED: true

# 5. Verify client name is in the summary
agent-browser eval "document.getElementById('summaryBody').textContent.includes('Summary Test Client')" --session-name budget-qa
# EXPECTED: true

# 6. Verify selected categories are listed
agent-browser eval "document.getElementById('summaryBody').textContent.includes('Structured Wiring')" --session-name budget-qa
# EXPECTED: true

agent-browser eval "document.getElementById('summaryBody').textContent.includes('Networking')" --session-name budget-qa
# EXPECTED: true

agent-browser eval "document.getElementById('summaryBody').textContent.includes('Multi-Room Audio')" --session-name budget-qa
# EXPECTED: true

# 7. Verify tax calculation present (7% FL tax)
agent-browser eval "document.getElementById('summaryBody').textContent.includes('Tax')" --session-name budget-qa
# EXPECTED: true

# 8. Verify grand total is in the summary
agent-browser eval "document.getElementById('summaryBody').textContent.includes('Total')" --session-name budget-qa
# EXPECTED: true

# 9. Verify Print button exists
agent-browser eval "document.querySelector('#summaryModal button[onclick=\"window.print()\"]') !== null" --session-name budget-qa
# EXPECTED: true

# 10. Screenshot
agent-browser screenshot "/tmp/qa-screenshots/AT14-summary-modal.png" --session-name budget-qa

# 11. Close summary
agent-browser click "#summaryModal .modal-close" --session-name budget-qa

# 12. Verify modal closed
agent-browser eval "document.getElementById('summaryModal').classList.contains('active')" --session-name budget-qa
# EXPECTED: false
```

---

### AT-15: Admin Dashboard — Login

Navigate to admin and log in.

```bash
# 1. Navigate to admin
agent-browser open "https://budget-beta.gamma.tech/admin" --session-name budget-qa

# 2. Wait for login form
agent-browser wait 2000 --session-name budget-qa

# 3. Screenshot the login page
agent-browser screenshot "/tmp/qa-screenshots/AT15-admin-login.png" --session-name budget-qa

# 4. Fill email field (admin uses Supabase Auth — email-based login)
agent-browser fill "input[type='email']" "bradd@gamma.tech" --session-name budget-qa

# 5. Fill password (retrieve from 1Password before running)
# agent-browser fill "input[type='password']" "<PASSWORD_FROM_1PASSWORD>" --session-name budget-qa

# 6. Click login button
# agent-browser click "button[type='submit']" --session-name budget-qa

# 7. Wait for dashboard to load
# agent-browser wait 3000 --session-name budget-qa

# 8. Verify we're on the dashboard (logged in)
# agent-browser eval "document.body.textContent.includes('Budgets') || document.body.textContent.includes('Dashboard')" --session-name budget-qa
# EXPECTED: true

# NOTE: Steps 5-8 are commented because the password must be retrieved
# from 1Password at runtime. The tester should:
# 1. Run: op read "op://Grant/Budget Planner Admin/password"
# 2. Substitute into step 5
# 3. Uncomment and run steps 5-8

agent-browser screenshot "/tmp/qa-screenshots/AT15-admin-dashboard.png" --session-name budget-qa
```

---

### AT-16: Admin Dashboard — Budgets Tab

Verify the budgets list loads and budget details are viewable.

```bash
# Prerequisite: Logged into admin (AT-15 completed)

# 1. Verify budgets tab is visible/active
agent-browser eval "document.body.textContent.includes('Budgets')" --session-name budget-qa
# EXPECTED: true

# 2. Verify budget list has entries (at least 1 from previous tests)
agent-browser eval "document.querySelectorAll('table tbody tr, .budget-row, .budget-item').length > 0" --session-name budget-qa
# EXPECTED: true

# 3. Screenshot the budget list
agent-browser screenshot "/tmp/qa-screenshots/AT16-budget-list.png" --session-name budget-qa

# 4. Click on the first budget to open details
agent-browser click "table tbody tr:first-child, .budget-row:first-child, .budget-item:first-child" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa

# 5. Verify budget detail view shows version history
agent-browser eval "document.body.textContent.includes('Version') || document.body.textContent.includes('version')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT16-budget-detail.png" --session-name budget-qa
```

---

### AT-17: Admin Dashboard — Categories & Pricing Tab

Verify the categories management tab loads.

```bash
# Prerequisite: Logged into admin

# 1. Click Categories & Pricing tab
agent-browser eval "Array.from(document.querySelectorAll('button, a, [role=tab]')).find(el => el.textContent.includes('Categor'))?.click()" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa

# 2. Verify category data is displayed
agent-browser eval "document.body.textContent.includes('Structured Wiring')" --session-name budget-qa
# EXPECTED: true

# 3. Verify pricing is editable (look for input/textarea/contenteditable elements)
agent-browser eval "document.querySelectorAll('input, textarea, [contenteditable]').length > 0" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT17-categories-tab.png" --session-name budget-qa
```

---

### AT-18: Admin Dashboard — Users Tab

Verify the users management tab loads.

```bash
# Prerequisite: Logged into admin

# 1. Click Users tab
agent-browser eval "Array.from(document.querySelectorAll('button, a, [role=tab]')).find(el => el.textContent.includes('User'))?.click()" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa

# 2. Verify user list is displayed
agent-browser eval "document.body.textContent.includes('bradd') || document.body.textContent.includes('gamma.tech')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT18-users-tab.png" --session-name budget-qa
```

---

### AT-19: Admin — Custom Budget

Test the customize budget flow from admin.

```bash
# Prerequisite: Logged into admin, on Budgets tab

# NOTE: This test modifies a live budget. Use a test budget created in AT-11/AT-12.
# The tester should identify a safe budget ID to customize.

# 1. Open a test budget in admin
# agent-browser click "<test-budget-row>" --session-name budget-qa
# agent-browser wait 2000 --session-name budget-qa

# 2. Look for Customize button
# agent-browser eval "document.body.textContent.includes('Customize')" --session-name budget-qa
# EXPECTED: true

# 3. Click Customize
# agent-browser eval "Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Customize'))?.click()" --session-name budget-qa
# agent-browser wait 2000 --session-name budget-qa

# 4. Look for category visibility toggles
# agent-browser screenshot "/tmp/qa-screenshots/AT19-customize.png" --session-name budget-qa

# 5. Hide a category (e.g., toggle off a checkbox for Theater)
# (Implementation-dependent — check admin.html for exact UI)

# 6. Save customization
# agent-browser eval "Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Save'))?.click()" --session-name budget-qa
# agent-browser wait 2000 --session-name budget-qa

# 7. Load the budget URL in the public view
# agent-browser open "https://budget-beta.gamma.tech/b/<BUDGET_ID>" --session-name budget-qa
# agent-browser wait "#categoriesContainer" --session-name budget-qa

# 8. Verify hidden category is not shown
# agent-browser eval "document.getElementById('cat-theater')" --session-name budget-qa
# EXPECTED: null (category was hidden)

# 9. Verify homeSize and propertyType fields are locked (disabled)
# agent-browser eval "document.getElementById('homeSize').disabled" --session-name budget-qa
# EXPECTED: true
# agent-browser eval "document.getElementById('propertyType').disabled" --session-name budget-qa
# EXPECTED: true

# NOTE: This test requires manual budget ID substitution and is
# partially destructive (resets version history). Run on test budgets only.
```

---

### AT-20: Error Cases

Verify error handling for invalid routes and missing budgets.

```bash
# 1. Load nonexistent budget URL
agent-browser open "https://budget-beta.gamma.tech/b/nonexistent99" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa

# 2. Verify error message or 404
agent-browser eval "document.body.textContent.includes('not found') || document.body.textContent.includes('Not found') || document.body.textContent.includes('404')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT20-404-budget.png" --session-name budget-qa

# 3. Test API error for nonexistent budget
agent-browser eval "fetch('/api/budgets/nonexistent99').then(r => r.status)" --session-name budget-qa
# EXPECTED: 404

# 4. Test API error response body
agent-browser eval "fetch('/api/budgets/nonexistent99').then(r => r.json()).then(j => j.error)" --session-name budget-qa
# EXPECTED: "Budget not found"

# 5. Test nonexistent short link
agent-browser open "https://budget-beta.gamma.tech/s/fakecode" --session-name budget-qa
agent-browser wait 2000 --session-name budget-qa
agent-browser eval "document.body.textContent.includes('not found') || document.title.includes('404')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT20-404-shortlink.png" --session-name budget-qa
```

---

### AT-21: Regression — Static Asset Paths on /b/ Routes

Verify that `categories-data.js` and `RESIDENTIAL_CATEGORIES` / `CONFIGS` load correctly on `/b/` routes (historical bug: relative paths broke on sub-routes).

```bash
# 1. Create a live budget first
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa
agent-browser click "#cat-prewire .category-header" --session-name budget-qa
agent-browser click "#cat-prewire .good-btn" --session-name budget-qa
agent-browser click "button[onclick='shareLink()']" --session-name budget-qa
agent-browser wait 3000 --session-name budget-qa

# 2. Verify we're on a /b/ URL
agent-browser eval "window.location.pathname.startsWith('/b/')" --session-name budget-qa
# EXPECTED: true

# 3. Reload the page (fresh load on /b/ route)
agent-browser eval "window.location.reload()" --session-name budget-qa
agent-browser wait 3000 --session-name budget-qa

# 4. Verify RESIDENTIAL_CATEGORIES is defined (loaded from /categories-data.js, not /b/categories-data.js)
agent-browser eval "typeof RESIDENTIAL_CATEGORIES !== 'undefined'" --session-name budget-qa
# EXPECTED: true

# 5. Verify CONFIGS is defined
agent-browser eval "typeof CONFIGS !== 'undefined'" --session-name budget-qa
# EXPECTED: true

# 6. Verify CONDO_CATEGORIES is defined
agent-browser eval "typeof CONDO_CATEGORIES !== 'undefined'" --session-name budget-qa
# EXPECTED: true

# 7. Verify categories rendered (not blank)
agent-browser eval "document.querySelectorAll('.category-card').length > 0" --session-name budget-qa
# EXPECTED: true

# 8. Verify the script tag uses absolute path
agent-browser eval "document.querySelector('script[src]')?.src.includes('/categories-data.js')" --session-name budget-qa
# EXPECTED: true

# 9. Verify it does NOT try to load from /b/categories-data.js
agent-browser eval "!document.querySelector('script[src]')?.src.includes('/b/categories-data.js')" --session-name budget-qa
# EXPECTED: true

agent-browser screenshot "/tmp/qa-screenshots/AT21-regression-paths.png" --session-name budget-qa
```

---

### AT-22: API Health Check

Verify the health check endpoint returns correct status.

```bash
# 1. Hit health endpoint
agent-browser eval "fetch('/api/health').then(r => r.json()).then(j => JSON.stringify(j))" --session-name budget-qa
# EXPECTED: JSON containing {"status":"ok", "services":{"database":true,"email":true}}

# 2. Verify status is "ok"
agent-browser eval "fetch('/api/health').then(r => r.json()).then(j => j.status)" --session-name budget-qa
# EXPECTED: "ok"

# 3. Verify database service is up
agent-browser eval "fetch('/api/health').then(r => r.json()).then(j => j.services.database)" --session-name budget-qa
# EXPECTED: true
```

---

### AT-23: Expand All

Verify the Expand All button opens all category cards.

```bash
# 1. Fresh page
agent-browser open "https://budget-beta.gamma.tech" --session-name budget-qa
agent-browser wait "#categoriesContainer" --session-name budget-qa

# 2. Verify no cards are expanded initially
agent-browser eval "document.querySelectorAll('.category-card.open').length" --session-name budget-qa
# EXPECTED: 0

# 3. Click Expand All
agent-browser click "button[onclick='expandAll()']" --session-name budget-qa

# 4. Verify all cards are expanded
agent-browser eval "document.querySelectorAll('.category-card.open').length" --session-name budget-qa
# EXPECTED: 17 (all residential categories)

agent-browser screenshot "/tmp/qa-screenshots/AT23-expand-all.png" --session-name budget-qa
```

---

## Manual Tests (Team Checklist)

Print this section or copy it to a shared doc. Each test should be performed by a team member and marked pass/fail.

### MT-01: Mobile Responsiveness

Test on real devices or browser DevTools device emulation.

| # | Test | Device | Pass | Fail | Notes |
|---|------|--------|------|------|-------|
| 1 | Homepage loads fully, no horizontal scroll | iPhone 14/15 | ☐ | ☐ | |
| 2 | Homepage loads fully, no horizontal scroll | iPad | ☐ | ☐ | |
| 3 | Header total is visible and readable | iPhone 14/15 | ☐ | ☐ | |
| 4 | Category cards stack vertically on mobile | iPhone 14/15 | ☐ | ☐ | |
| 5 | Tier buttons wrap properly, all visible | iPhone 14/15 | ☐ | ☐ | |
| 6 | Project details form fields are full-width | iPhone 14/15 | ☐ | ☐ | |
| 7 | Summary bar (bottom) doesn't overlap content | iPhone 14/15 | ☐ | ☐ | |
| 8 | Summary modal scrolls if content is long | iPhone 14/15 | ☐ | ☐ | |
| 9 | Email modal fits on screen, fields accessible | iPhone 14/15 | ☐ | ☐ | |
| 10 | Admin dashboard is usable on tablet | iPad | ☐ | ☐ | |
| 11 | Landscape mode doesn't break layout | iPhone | ☐ | ☐ | |
| 12 | Safe area insets respected (notch/dynamic island) | iPhone 14 Pro+ | ☐ | ☐ | |

---

### MT-02: Visual Quality

| # | Test | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Gamma Tech logo renders correctly in header | ☐ | ☐ | |
| 2 | Logo colors: white "GAMMA" + light blue "TECH" | ☐ | ☐ | |
| 3 | Header gradient is dark blue (#0F2F44 → #133F5C) | ☐ | ☐ | |
| 4 | Total amount displays in light blue (#74C7FF) | ☐ | ☐ | |
| 5 | Poppins font loads correctly (not system fallback) | ☐ | ☐ | |
| 6 | Category card shadows are subtle, not harsh | ☐ | ☐ | |
| 7 | Tier buttons have correct color coding (Good=green, Better=blue, Best=dark blue) | ☐ | ☐ | |
| 8 | Selected tier button has visible highlight | ☐ | ☐ | |
| 9 | Disabled categories are visually grayed out | ☐ | ☐ | |
| 10 | Summary modal has clean table formatting | ☐ | ☐ | |
| 11 | No text overflow or clipping on any element | ☐ | ☐ | |
| 12 | Toast notification is readable against dark background | ☐ | ☐ | |
| 13 | Shared banner has green/blue gradient border | ☐ | ☐ | |

---

### MT-03: Touch Interactions

| # | Test | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Tapping a category card expands it smoothly | ☐ | ☐ | |
| 2 | Tapping a tier button selects it immediately (no double-tap needed) | ☐ | ☐ | |
| 3 | Scrolling works smoothly with many cards expanded | ☐ | ☐ | |
| 4 | Tapping "Skip" deselects a tier | ☐ | ☐ | |
| 5 | Extra item toggles respond to single tap | ☐ | ☐ | |
| 6 | Modal overlay closes when tapping outside the modal | ☐ | ☐ | |
| 7 | Input fields get focus on first tap | ☐ | ☐ | |
| 8 | Number input (home size) works with iOS number keyboard | ☐ | ☐ | |
| 9 | Dropdown (property type) opens native picker on iOS | ☐ | ☐ | |
| 10 | Long-press doesn't trigger unwanted selection | ☐ | ☐ | |
| 11 | Modifier amount field uses numeric keyboard (inputmode="numeric") | ☐ | ☐ | |
| 12 | No 300ms tap delay on any interactive element | ☐ | ☐ | |

---

### MT-04: Print / PDF

| # | Test | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Click "Print / Save PDF" in summary modal → print dialog opens | ☐ | ☐ | |
| 2 | Print preview shows only the summary content (not the full page behind) | ☐ | ☐ | |
| 3 | All selected categories appear in the printed output | ☐ | ☐ | |
| 4 | Prices are formatted correctly ($XX,XXX) in print | ☐ | ☐ | |
| 5 | Grand total including tax is visible in print | ☐ | ☐ | |
| 6 | Client name and date appear in printed header | ☐ | ☐ | |
| 7 | Brands and features are legible (font size not too small) | ☐ | ☐ | |
| 8 | Save as PDF produces a clean, shareable document | ☐ | ☐ | |
| 9 | Disclaimer text is present at bottom of print | ☐ | ☐ | |
| 10 | Page breaks don't split a category row awkwardly | ☐ | ☐ | |

---

### MT-05: Email Delivery

**Important:** Only test on beta. Send to a Gamma Tech email address.

| # | Test | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Email arrives within 1 minute | ☐ | ☐ | |
| 2 | From address shows "Gamma Tech Budget Planner" <BudgetPlanner@gamma.tech> | ☐ | ☐ | |
| 3 | Subject matches what was entered (or default) | ☐ | ☐ | |
| 4 | Recipient name greeting is correct ("Hi John,") | ☐ | ☐ | |
| 5 | Estimated Investment total is displayed prominently | ☐ | ☐ | |
| 6 | Total matches what was shown on the budget tool | ☐ | ☐ | |
| 7 | Category table lists all selected categories with tier and price | ☐ | ☐ | |
| 8 | "View & Customize Your Budget" button links to correct /b/ URL | ☐ | ☐ | |
| 9 | Email renders well in Gmail (web) | ☐ | ☐ | |
| 10 | Email renders well in Apple Mail (iPhone) | ☐ | ☐ | |
| 11 | Email renders well in Outlook | ☐ | ☐ | |
| 12 | Footer shows correct address: 3106 Horseshoe Dr S, Naples, FL 34116 | ☐ | ☐ | |
| 13 | Footer shows phone: (239) 330-4939 | ☐ | ☐ | |
| 14 | Email doesn't end up in spam folder | ☐ | ☐ | |
| 15 | Budget link in email loads correctly with all selections | ☐ | ☐ | |

---

### MT-06: Clipboard / Share on Mobile

| # | Test | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Tap "Share Link" → toast says "Link copied!" | ☐ | ☐ | |
| 2 | Paste in another app — URL is correct /b/xxxxx format | ☐ | ☐ | |
| 3 | URL bar updates to /b/xxxxx path | ☐ | ☐ | |
| 4 | Share link works in Safari (iOS) | ☐ | ☐ | |
| 5 | Share link works in Chrome (iOS) | ☐ | ☐ | |
| 6 | Share link works in Chrome (Android) | ☐ | ☐ | |
| 7 | Pasting the URL in a new browser tab loads the budget | ☐ | ☐ | |
| 8 | Pasting the URL in iMessage previews correctly | ☐ | ☐ | |
| 9 | Tapping share a second time copies the same URL (doesn't create duplicate) | ☐ | ☐ | |

---

### MT-07: Cross-Browser

Test core flows (load → select tiers → share → load shared) on each browser.

| # | Browser | Loads | Tier Select Works | Share Works | Totals Correct | Pass | Fail |
|---|---------|-------|-------------------|-------------|----------------|------|------|
| 1 | Safari (macOS) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | Safari (iOS 17+) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | Chrome (macOS) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Chrome (iOS) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Chrome (Android) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | Firefox (macOS) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Edge (Windows) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

### MT-08: Performance

| # | Test | Target | Actual | Pass | Fail | Notes |
|---|------|--------|--------|------|------|-------|
| 1 | Homepage initial load time | < 3 seconds | ___s | ☐ | ☐ | |
| 2 | Time from load to categories visible | < 2 seconds | ___s | ☐ | ☐ | |
| 3 | Time to load a shared /b/ budget | < 3 seconds | ___s | ☐ | ☐ | |
| 4 | Tier selection response time (tap to price update) | < 200ms | ___ms | ☐ | ☐ | |
| 5 | Summary modal opens instantly | < 500ms | ___ms | ☐ | ☐ | |
| 6 | Share link creation time | < 3 seconds | ___s | ☐ | ☐ | |
| 7 | Admin dashboard loads within | < 5 seconds | ___s | ☐ | ☐ | |
| 8 | No layout shift after fonts load | None visible | | ☐ | ☐ | |
| 9 | No JavaScript errors in console during normal use | 0 errors | ___errors | ☐ | ☐ | |
| 10 | API response time for /api/categories | < 500ms | ___ms | ☐ | ☐ | |

---

## Full Automated Test Run Script

Run all automated tests sequentially. Copy this block to execute the full suite:

```bash
#!/bin/bash
# Gamma Tech Budget Planner — Full Automated QA Suite
# Usage: bash qa-run.sh
# Requires: agent-browser CLI at /opt/homebrew/bin/agent-browser

set -e
SESSION="budget-qa"
BASE="https://budget-beta.gamma.tech"
SCREENSHOTS="/tmp/qa-screenshots"
PASS=0
FAIL=0

mkdir -p "$SCREENSHOTS"

echo "========================================="
echo "  Budget Planner QA Suite"
echo "  Target: $BASE"
echo "  Date: $(date)"
echo "========================================="

echo ""
echo "[AT-01] Homepage Load & Category Rendering"
agent-browser open "$BASE" --session-name $SESSION
agent-browser wait "#categoriesContainer" --session-name $SESSION
RESULT=$(agent-browser eval "document.querySelectorAll('.category-card').length" --session-name $SESSION)
if [ "$RESULT" = "17" ]; then echo "  PASS: 17 categories rendered"; ((PASS++)); else echo "  FAIL: Expected 17, got $RESULT"; ((FAIL++)); fi
agent-browser screenshot "$SCREENSHOTS/AT01.png" --session-name $SESSION

echo ""
echo "[AT-05] Property Type Switch to Condo"
agent-browser select "#propertyType" "condo" --session-name $SESSION
agent-browser wait 500 --session-name $SESSION
RESULT=$(agent-browser eval "document.querySelectorAll('.category-card').length" --session-name $SESSION)
if [ "$RESULT" = "13" ]; then echo "  PASS: 13 condo categories"; ((PASS++)); else echo "  FAIL: Expected 13, got $RESULT"; ((FAIL++)); fi

agent-browser select "#propertyType" "residential" --session-name $SESSION
agent-browser wait 500 --session-name $SESSION

echo ""
echo "[AT-06] Mutual Exclusivity — Lighting"
agent-browser click "#cat-lighting .category-header" --session-name $SESSION
agent-browser click "#cat-lighting .better-btn" --session-name $SESSION
RESULT=$(agent-browser eval "document.getElementById('cat-lighting-centralized').classList.contains('disabled')" --session-name $SESSION)
if [ "$RESULT" = "true" ]; then echo "  PASS: Centralized disabled"; ((PASS++)); else echo "  FAIL: Centralized not disabled"; ((FAIL++)); fi

agent-browser click "#cat-lighting .none-btn" --session-name $SESSION

echo ""
echo "[AT-07] Invisible Speakers Dependency"
RESULT=$(agent-browser eval "document.getElementById('cat-invisible-speakers').classList.contains('disabled')" --session-name $SESSION)
if [ "$RESULT" = "true" ]; then echo "  PASS: Invisible Speakers disabled without audio"; ((PASS++)); else echo "  FAIL: Should be disabled"; ((FAIL++)); fi

echo ""
echo "[AT-22] API Health Check"
RESULT=$(agent-browser eval "fetch('/api/health').then(r=>r.json()).then(j=>j.status)" --session-name $SESSION)
if [ "$RESULT" = "ok" ]; then echo "  PASS: Health check OK"; ((PASS++)); else echo "  FAIL: Health check returned $RESULT"; ((FAIL++)); fi

echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "  Screenshots: $SCREENSHOTS/"
echo "========================================="
```

---

## Appendix: Category Reference

All residential category IDs for use in selectors (`#cat-{id}`):

| ID | Name | Section | Tiers Available |
|----|------|---------|----------------|
| `prewire` | Structured Wiring & Pre-Wire | Infrastructure | good, standard, better, best |
| `networking` | Whole-Home WiFi & Networking | Infrastructure | good, better, best |
| `surveillance` | Surveillance & Security Cameras | Security | good, better, best |
| `audio` | Multi-Room Audio | Audio | good, standard, better, best |
| `invisible-speakers` | Invisible Speakers | Audio | good, standard, better, best |
| `surround` | Surround Sound | Audio | good, better, best |
| `theater` | Home Theater / Media Room | Audio | good, standard, better, best |
| `videodist` | TV Mounting & Video Distribution | Video | good, better, best |
| `control` | Control & Automation System | Control & Automation | good, better, best |
| `touchscreen` | Touchscreens | Control & Automation | good, standard, better, best |
| `lighting` | Wireless Lighting Control | Lighting & Shades | good, better, best |
| `lighting-centralized` | Centralized / Hybrid Lighting | Lighting & Shades | good, better, best |
| `lighting-designer` | Designer Lighting Keypads | Lighting & Shades | good, better, best |
| `shades` | Motorized Shades | Lighting & Shades | good, better, best |
| `outdoor` | Yard/Pool Audio | Audio | good, better, best |
| `security` | Security & Alarm System | Security | good, better, best |
| `intercom` | Intercom, Doorbell & Access Control | Security | good, better, best |
| `videowall-interior` | Video Wall Interior | Video | good, standard, better, best |
| `videowall-exterior` | Video Wall Exterior | Video | good, standard, better, best |

**Extras (residential only):**
| ID | Name | Base Price |
|----|------|-----------|
| `poolAlarm` | Pool Alarm & Child Safety | $2,200 |
| `fireDet` | Low Voltage Fire Detection | $3,800 |
| `leakDet` | Leak Detection System | $3,500 |

**Mutual Exclusivity Rules:**
- `lighting` ↔ `lighting-centralized` (selecting one disables the other)
- `lighting-designer` requires `lighting` (not "good") OR `lighting-centralized`
- `lighting-designer` "best" tier unavailable with `lighting` (Wireless)
- `invisible-speakers` requires `audio` to be selected
- Deselecting `audio` auto-clears `invisible-speakers`

**Condo removes:** `surveillance`, `outdoor`, `security`, `intercom` + all extras
