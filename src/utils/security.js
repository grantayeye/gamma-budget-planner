const crypto = require('crypto');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function createBudgetEditToken(secret, budgetId) {
  return crypto.createHmac('sha256', secret).update(String(budgetId)).digest('base64url');
}

function verifyBudgetEditToken(secret, budgetId, supplied) {
  if (!supplied || String(supplied).length > 100) return false;
  const expected = createBudgetEditToken(secret, budgetId);
  const suppliedBuffer = Buffer.from(String(supplied));
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

module.exports = { canonicalize, createBudgetEditToken, escapeHtml, verifyBudgetEditToken };
