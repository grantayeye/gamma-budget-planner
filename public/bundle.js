// ============================================================
// BUDGET PLANNER - MAIN APPLICATION
// ============================================================


  RESIDENTIAL_CATEGORIES, 
  RESIDENTIAL_EXTRAS, 
  CONDO_CATEGORIES,
  CONDO_EXTRAS,
  CONFIGS,
  SECTION_ORDER,
  initCondoData
} from './data/categories.js';


// Set module loaded flag
window.moduleLoaded = true;

// Initialize condo data
initCondoData();

// DOM Elements cache
const elements = {};

function cacheElements() {
  elements.clientName = document.getElementById('clientName');
  elements.builder = document.getElementById('builder');
  elements.homeSize = document.getElementById('homeSize');
  elements.propertyType = document.getElementById('propertyType');
  elements.headerTotal = document.getElementById('headerTotal');
  elements.statSubtotal = document.getElementById('statSubtotal');
  elements.statTax = document.getElementById('statTax');
  elements.categoryCount = document.getElementById('categoryCount');
  elements.categoriesContainer = document.getElementById('categoriesContainer');
  elements.extrasGrid = document.getElementById('extrasGrid');
  elements.extrasSection = document.getElementById('extrasSection');
  elements.modifiersContainer = document.getElementById('modifiersContainer');
}

// Get current config based on property type
function getConfig() {
  const state = getState();
  return CONFIGS[state.propertyType];
}

// Initialize state for current config
function initStateForConfig() {
  const { categories, extras } = getConfig();
  const state = getState();
  
  categories.forEach(c => {
    if (!(c.id in state.selections)) {
      state.selections[c.id] = null;
    }
    if (!(c.id in state.catMods)) {
      state.catMods[c.id] = { name: '', amount: 0 };
    }
  });
  
  extras.forEach(e => {
    if (!(e.id in state.extras)) {
      state.extras[e.id] = e.default;
    }
  });
  
  update({
    selections: state.selections,
    extras: state.extras,
    catMods: state.catMods
  });
}

// Update totals display
function updateTotals() {
  const state = getState();
  const { categories, extras: extrasData } = getConfig();
  
  const totals = calculateTotal({
    categories,
    selections: state.selections,
    extras: state.extras,
    extrasData,
    modifiers: state.modifiers,
    catMods: state.catMods,
    homeSize: state.homeSize
  });
  
  elements.headerTotal.textContent = formatCurrency(totals.grandTotal);
  elements.statSubtotal.textContent = formatCurrency(totals.equipmentSubtotal);
  elements.statTax.textContent = formatCurrency(totals.taxEstimate);
  elements.categoryCount.textContent = `${totals.selectedCount} of ${categories.length} selected`;
  
  // Trigger auto-save
  triggerAutoSave();
}

// Auto-save for live budgets
let autoSaveTimeout = null;
let lastSavedState = null;

function triggerAutoSave() {
  const budgetId = getBudgetId();
  if (!budgetId) return;
  
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    const currentState = getStateForAPI({
      clientName: elements.clientName?.value,
      homeSize: getState().homeSize,
      propertyType: getState().propertyType,
      total: parseInt(elements.headerTotal.textContent.replace(/[^0-9]/g, '')) || 0
    });
    
    if (lastSavedState && JSON.stringify(currentState) === JSON.stringify(lastSavedState)) {
      return;
    }
    
    try {
      await budgets.update(budgetId, { state: currentState });
      lastSavedState = currentState;
      showToast('✓ Saved', 1000);
    } catch (err) {
      console.error('Auto-save error:', err);
    }
  }, 2000);
}

// Render categories
function renderCategories() {
  const state = getState();
  const config = getConfig();
  const debugEl = document.getElementById('debugInfo');
  
  // DEBUG
  if (debugEl) {
    debugEl.innerHTML += '<br><strong>renderCategories() called</strong>';
    debugEl.innerHTML += '<br>propertyType: ' + state.propertyType;
    debugEl.innerHTML += '<br>config exists: ' + (!!config);
    debugEl.innerHTML += '<br>config.categories: ' + (config?.categories?.length || 'undefined');
  }
  
  const { categories } = config;
  
  // Group by section
  const sections = {};
  categories.forEach(cat => {
    const section = cat.section || 'Other';
    if (!sections[section]) sections[section] = [];
    sections[section].push(cat);
  });
  
  elements.categoriesContainer.innerHTML = '';
  
  SECTION_ORDER.forEach(sectionName => {
    const cats = sections[sectionName];
    if (!cats || cats.length === 0) return;
    
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<h3>${sectionName}</h3>`;
    elements.categoriesContainer.appendChild(header);
    
    cats.forEach(cat => renderCategoryCard(cat));
  });
}

function renderCategoryCard(cat) {
  const state = getState();
  const selected = state.selections[cat.id];
  const tierClass = selected ? `tier-${selected}` : '';
  
  const card = document.createElement('div');
  card.className = `category-card ${tierClass} ${selected ? 'has-selection' : ''}`;
  card.id = `cat-${cat.id}`;
  
  // Check if disabled
  let isDisabled = false;
  if (cat.id === 'lighting' && state.selections['lighting-centralized']) isDisabled = true;
  else if (cat.id === 'lighting-centralized' && state.selections['lighting']) isDisabled = true;
  else if (cat.id === 'lighting-designer' && (!state.selections['lighting'] && !state.selections['lighting-centralized'])) isDisabled = true;
  else if (cat.id === 'lighting-designer' && state.selections['lighting'] === 'good') isDisabled = true;
  else if (cat.id === 'invisible-speakers' && !state.selections['audio']) isDisabled = true;
  
  if (isDisabled) card.classList.add('disabled');
  
  card.innerHTML = `
    <div class="category-header" onclick="window.toggleCategory('${cat.id}')">
      <div class="category-icon">${cat.icon}</div>
      <div class="category-info">
        <div class="category-name">${cat.name}</div>
        <div class="category-desc">${cat.desc}</div>
      </div>
      <div class="category-price ${!selected ? 'no-selection' : ''}">
        ${selected ? formatCurrency(getCategoryPrice(cat, selected, state.homeSize)) : 'Not selected'}
      </div>
    </div>
    <div class="category-body">
      <div class="tier-selector">
        <div class="tier-btn none-btn ${!selected ? 'selected' : ''}" onclick="window.selectTier('${cat.id}', null)">
          <div class="tier-label">Skip</div>
          <div class="tier-price">—</div>
          <div class="tier-tag">Not included</div>
        </div>
        ${Object.keys(cat.tiers).map(t => renderTierButton(cat, t, selected)).join('')}
      </div>
      ${selected ? renderTierDetails(cat, selected) : '<div class="tier-details" style="text-align:center;color:var(--text-lighter);padding:20px;">Select a tier to see what\'s included</div>'}
    </div>
  `;
  
  elements.categoriesContainer.appendChild(card);
}

function renderTierButton(cat, tier, selected) {
  const state = getState();
  const price = getCategoryPrice(cat, tier, state.homeSize);
  const tierData = cat.tiers[tier];
  
  return `
    <div class="tier-btn ${tier}-btn ${selected === tier ? 'selected' : ''}" 
         onclick="window.selectTier('${cat.id}', '${tier}')">
      <div class="tier-label">${tierData.label}</div>
      <div class="tier-price">${formatCurrency(price)}</div>
      <div class="tier-tag">${tierData.tag || tier}</div>
    </div>
  `;
}

function renderTierDetails(cat, tier) {
  const t = cat.tiers[tier];
  return `
    <div class="tier-details">
      <h4>${t.label} — What's Included</h4>
      <ul>${t.features.map(f => `<li>${f}</li>`).join('')}</ul>
      <div class="brands">Typical brands: ${t.brands}</div>
    </div>
  `;
}

function getCategoryPrice(cat, tier, homeSize) {
  if (!tier) return 0;
  const tierData = cat.tiers[tier];
  if (!tierData) return 0;
  
  const base = tierData.price;
  if (cat.isCustomized) return base;
  
  const skipSize = cat.baseTierNoScale && tier === 'good';
  const scaleToUse = tierData.sizeScale !== undefined ? tierData.sizeScale : cat.sizeScale;
  
  if (scaleToUse === 0 || skipSize) return base;
  
  const effectiveSqft = Math.max(homeSize, 2500);
  const ratio = effectiveSqft / 4000;
  const mult = 1 + (ratio - 1) * scaleToUse;
  
  return Math.round(base * mult / 100) * 100;
}

// Expose functions globally for onclick handlers
window.toggleCategory = function(catId) {
  const card = document.getElementById(`cat-${catId}`);
  if (card) card.classList.toggle('open');
};

window.selectTier = function(catId, tier) {
  const state = getState();
  const newSelections = { ...state.selections, [catId]: tier };
  
  // Handle mutual exclusivity
  if (tier !== null) {
    if (catId === 'lighting') {
      newSelections['lighting-centralized'] = null;
      if (tier === 'good' && newSelections['lighting-designer']) {
        newSelections['lighting-designer'] = null;
      }
    } else if (catId === 'lighting-centralized') {
      newSelections['lighting'] = null;
    }
  }
  
  if (catId === 'audio' && tier === null) {
    newSelections['invisible-speakers'] = null;
  }
  
  update({ selections: newSelections });
  renderCategories();
  updateTotals();
};

window.expandAll = function() {
  document.querySelectorAll('.category-card').forEach(c => c.classList.add('open'));
};

// Event listeners
document.getElementById('propertyType')?.addEventListener('change', function() {
  update({ propertyType: this.value });
  initStateForConfig();
  renderCategories();
  renderExtras();
  updateTotals();
});

document.getElementById('homeSize')?.addEventListener('input', debounce(function() {
  update({ homeSize: parseInt(this.value) || 4000 });
  renderCategories();
  renderExtras();
  updateTotals();
}, 100));

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  const debugEl = document.getElementById('debugInfo');
  if (debugEl) {
    debugEl.innerHTML += '<br><strong style="color:red">ERROR:</strong> ' + msg;
    debugEl.innerHTML += '<br>Line: ' + line;
    debugEl.innerHTML += '<br>Error: ' + (error ? error.stack : 'N/A');
  }
  return false;
};

// Initialize
function init() {
  const debugEl = document.getElementById('debugInfo');
  if (debugEl) debugEl.innerHTML += '<br>init() called';
  
  try {
  
  cacheElements();
  if (debugEl) debugEl.innerHTML += '<br>elements cached: ' + Object.keys(elements).join(', ');
  
  initStateForConfig();
  if (debugEl) debugEl.innerHTML += '<br>initStateForConfig done';
  
  renderCategories();
  if (debugEl) debugEl.innerHTML += '<br>renderCategories done';
  
  updateTotals();
  if (debugEl) debugEl.innerHTML += '<br>updateTotals done';
  
  // Update debug with category counts
  if (debugEl) {
    const state = getState();
    const config = getConfig();
    debugEl.innerHTML += '<br><strong>propertyType:</strong> ' + state.propertyType;
    debugEl.innerHTML += '<br><strong>categories count:</strong> ' + (config?.categories?.length || 'undefined');
    debugEl.innerHTML += '<br><strong>RESIDENTIAL_CATEGORIES:</strong> ' + RESIDENTIAL_CATEGORIES.length;
    debugEl.innerHTML += '<br><strong>CONDO_CATEGORIES:</strong> ' + CONDO_CATEGORIES.length;
  }
  
  // Subscribe to state changes
  subscribe(() => {
    updateTotals();
  });
  
  } catch (err) {
    const debugEl = document.getElementById('debugInfo');
    if (debugEl) {
      debugEl.innerHTML += '<br><strong style="color:red">INIT ERROR:</strong> ' + err.message;
      debugEl.innerHTML += '<br>' + err.stack;
    }
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Render extras
function renderExtras() {
  const state = getState();
  const { extras: extrasData } = getConfig();
  
  if (extrasData.length === 0) {
    elements.extrasSection.style.display = 'none';
    return;
  }
  
  elements.extrasSection.style.display = '';
  elements.extrasGrid.innerHTML = '';
  
  extrasData.forEach(extra => {
    const active = state.extras[extra.id];
    const price = getExtraPrice(extra, state.homeSize);
    
    const div = document.createElement('div');
    div.className = `extra-item ${active ? 'active' : ''}`;
    div.onclick = () => toggleExtra(extra.id);
    
    div.innerHTML = `
      <div class="extra-info">
        <div>
          <div class="extra-name">${extra.name}</div>
          <div class="extra-note">${extra.note}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="extra-price">${formatCurrency(price)}</div>
        <div class="extra-toggle"></div>
      </div>
    `;
    
    elements.extrasGrid.appendChild(div);
  });
}

function getExtraPrice(extra, homeSize) {
  if (extra.sizeScale === undefined) return extra.price;
  const effectiveSqft = Math.max(homeSize, 2500);
  const ratio = effectiveSqft / 4000;
  const mult = 1 + (ratio - 1) * extra.sizeScale;
  return Math.round(extra.price * mult / 100) * 100;
}

function toggleExtra(extraId) {
  const state = getState();
  update({
    extras: { ...state.extras, [extraId]: !state.extras[extraId] }
  });
  renderExtras();
  updateTotals();
}

// Modifiers
let modifierId = 0;

window.addModifier = function() {
  const state = getState();
  modifierId++;
  update({
    modifiers: [...state.modifiers, { id: modifierId, name: '', amount: 0 }]
  });
  renderModifiers();
};

window.removeModifier = function(id) {
  const state = getState();
  update({
    modifiers: state.modifiers.filter(m => m.id !== id)
  });
  renderModifiers();
  updateTotals();
};

window.updateModifier = function(id, field, value) {
  const state = getState();
  const modifiers = state.modifiers.map(m => {
    if (m.id === id) {
      return { ...m, [field]: field === 'amount' ? parseFloat(value) || 0 : value };
    }
    return m;
  });
  update({ modifiers });
  updateTotals();
};

window.handleModAmount = function(input, id) {
  const raw = input.value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(raw) || 0;
  window.updateModifier(id, 'amount', num);
  
  if (raw === '' || raw === '-') {
    input.value = raw;
  } else {
    input.value = formatCurrency(num);
  }
};

function renderModifiers() {
  const state = getState();
  
  elements.modifiersContainer.innerHTML = state.modifiers.map(m => `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
      <input type="text" placeholder="Description" value="${m.name}" 
        oninput="window.updateModifier(${m.id}, 'name', this.value)"
        style="flex:1;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:14px;">
      <input type="text" inputmode="numeric" placeholder="$0" value="${m.amount ? formatCurrency(m.amount) : ''}" 
        oninput="window.handleModAmount(this, ${m.id})"
        style="width:130px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:14px;text-align:right;">
      <button onclick="window.removeModifier(${m.id})" style="background:none;border:1px solid var(--border);border-radius:var(--radius);color:var(--red);cursor:pointer;padding:8px 12px;font-size:16px;">✕</button>
    </div>
  `).join('');
}

// ============================================================
// BUTTON FUNCTIONS
// ============================================================

window.expandAll = function() {
  document.querySelectorAll('.category-card').forEach(c => c.classList.add('open'));
};

window.showSummary = function() {
  const modal = document.getElementById('summaryModal');
  const body = document.getElementById('summaryBody');
  const state = getState();
  
  const clientName = elements.clientName?.value || 'Unnamed Project';
  const builder = elements.builder?.value || '—';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let subtotal = 0;
  let rows = '';
  
  const config = getConfig();
  config.categories.forEach(cat => {
    const tier = state.selections[cat.id];
    if (tier && cat.tiers[tier]) {
      const t = cat.tiers[tier];
      const price = calculateCategoryPrice(cat, tier, state.homeSize);
      subtotal += price;
      rows += `
        <tr>
          <td>${cat.icon} ${cat.name}</td>
          <td><span class="tier-badge ${tier}">${t.tag || tier}</span> ${t.label}</td>
          <td class="price-cell">${formatCurrency(price)}</td>
        </tr>
      `;
    }
  });
  
  let extrasTotal = 0;
  config.extras.forEach(extra => {
    if (state.extras[extra.id]) {
      const price = getExtraPrice(extra, state.homeSize);
      extrasTotal += price;
      rows += `
        <tr>
          <td>📎 ${extra.name}</td>
          <td style="font-size:12px;color:var(--text-light)">${extra.note}</td>
          <td class="price-cell">${formatCurrency(price)}</td>
        </tr>
      `;
    }
  });
  
  let modifiersTotal = 0;
  state.modifiers.forEach(m => {
    if (m.amount !== 0) {
      modifiersTotal += m.amount;
      rows += `
        <tr>
          <td>🔧 ${m.name || 'Custom Adjustment'}</td>
          <td style="font-size:12px;color:var(--text-light)">${m.amount > 0 ? 'Addition' : 'Credit'}</td>
          <td class="price-cell">${formatCurrency(m.amount)}</td>
        </tr>
      `;
    }
  });
  
  const equipmentSubtotal = subtotal + extrasTotal + modifiersTotal;
  const taxEstimate = Math.round(equipmentSubtotal * 0.07);
  const grandTotal = equipmentSubtotal + taxEstimate;
  
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:12px;color:var(--text-lighter);margin-top:8px">Residential Technology Budget Estimate</div>
    </div>
    <div class="summary-project-info">
      <div><span class="info-label">Project:</span> <span class="info-value">${clientName}</span></div>
      <div><span class="info-label">Builder:</span> <span class="info-value">${builder}</span></div>
      <div><span class="info-label">Date:</span> <span class="info-value">${today}</span></div>
    </div>
    <table class="summary-table">
      <thead><tr><th>Category</th><th>Tier</th><th style="text-align:right">Estimated Cost</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2">Equipment & Installation Subtotal</td><td class="price-cell">${formatCurrency(equipmentSubtotal)}</td></tr>
        <tr><td colspan="2">Estimated Sales Tax (~7%)</td><td class="price-cell">${formatCurrency(taxEstimate)}</td></tr>
        <tr><td colspan="2" style="font-size:18px">Estimated Total Investment</td><td class="price-cell grand-total">${formatCurrency(grandTotal)}</td></tr>
      </tfoot>
    </table>
  `;
  
  modal.classList.add('active');
};

window.closeSummary = function() {
  document.getElementById('summaryModal').classList.remove('active');
};

window.showEmailModal = function() {
  const modal = document.getElementById('emailModal');
  const clientName = elements.clientName?.value;
  if (clientName) {
    document.getElementById('emailRecipientName').value = clientName;
  }
  document.getElementById('emailStatus').style.display = 'none';
  document.getElementById('emailSendBtn').disabled = false;
  document.getElementById('emailSendBtn').textContent = '📧 Send Email';
  modal.classList.add('active');
};

window.closeEmailModal = function() {
  document.getElementById('emailModal').classList.remove('active');
};

window.sendProposalEmail = async function() {
  const recipientName = document.getElementById('emailRecipientName').value.trim();
  const recipientEmail = document.getElementById('emailRecipientEmail').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const statusEl = document.getElementById('emailStatus');
  const sendBtn = document.getElementById('emailSendBtn');
  
  if (!recipientEmail || !recipientEmail.includes('@')) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#FFEBEE';
    statusEl.style.color = '#C62828';
    statusEl.textContent = '⚠️ Please enter a valid email address.';
    return;
  }
  
  sendBtn.disabled = true;
  sendBtn.textContent = '⏳ Sending...';
  statusEl.style.display = 'none';
  
  try {
    const state = getState();
    const config = getConfig();
    const categories = [];
    
    config.categories.forEach(cat => {
      const tier = state.selections[cat.id];
      if (tier && cat.tiers[tier]) {
        categories.push({
          name: cat.name,
          tier: tier,
          price: calculateCategoryPrice(cat, tier, state.homeSize)
        });
      }
    });
    
    const total = calculateTotal(state, config);
    const tierLabel = getDominantTier(state.selections);
    
    await email.send({
      recipientEmail,
      recipientName,
      subject: subject || 'Your Technology Budget from Gamma Tech',
      proposalData: {
        categories,
        total,
        tierLabel,
        clientName: elements.clientName?.value,
        builder: elements.builder?.value,
        homeSize: state.homeSize
      }
    });
    
    statusEl.style.display = 'block';
    statusEl.style.background = '#E8F5E9';
    statusEl.style.color = '#2E7D32';
    statusEl.textContent = '✅ Email sent successfully!';
    sendBtn.textContent = '✓ Sent!';
    
    setTimeout(() => {
      window.closeEmailModal();
      showToast('📧 Budget emailed to ' + recipientEmail);
    }, 1500);
    
  } catch (err) {
    console.error('Email error:', err);
    statusEl.style.display = 'block';
    statusEl.style.background = '#FFEBEE';
    statusEl.style.color = '#C62828';
    statusEl.textContent = '❌ Failed to send email: ' + err.message;
    sendBtn.disabled = false;
    sendBtn.textContent = '📧 Send Email';
  }
};

window.shareLink = async function() {
  const state = getState();
  const encoded = encodeState(state);
  const url = window.location.origin + window.location.pathname + '?' + encoded;
  
  try {
    await navigator.clipboard.writeText(url);
    showToast('🔗 Link copied to clipboard!');
  } catch (e) {
    showToast('Link generated — copy from address bar');
  }
};

// Helper function to calculate category price
function calculateCategoryPrice(cat, tier, homeSize) {
  if (!tier || !cat.tiers[tier]) return 0;
  const tierData = cat.tiers[tier];
  const base = tierData.price;
  const scaleToUse = tierData.sizeScale !== undefined ? tierData.sizeScale : cat.sizeScale;
  if (scaleToUse === 0) return base;
  const effectiveSqft = Math.max(homeSize, 2500);
  const ratio = effectiveSqft / 4000;
  const mult = 1 + (ratio - 1) * scaleToUse;
  return Math.round(base * mult / 100) * 100;
}

// End of try block for module-level error handling
