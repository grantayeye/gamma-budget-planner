require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'BudgetPlanner@gamma.tech';
const FROM_NAME = 'Gamma Tech Budget Planner';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// ============================================================
// SUPABASE SETUP
// ============================================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================
// RATE LIMITING
// ============================================================
const limits = {
  auth: rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 7,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
  }),
  api: rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please slow down' }
  }),
  email: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Email quota exceeded, please try again later' }
  })
};

// ============================================================
// CORS
// ============================================================
app.use(cors({
  origin: true,
  credentials: true
}));

// ============================================================
// REQUEST LOGGING
// ============================================================
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const OFFICE_TEAM_VIEW_IPS = new Set(['69.254.59.65', '8.53.54.185']);

function normalizeIp(ip) {
  if (!ip) return '';
  return String(ip)
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/, '');
}

function getRequestIp(req) {
  return normalizeIp(req.ip || req.get('x-forwarded-for') || req.socket?.remoteAddress || '');
}

function isOfficeTeamIp(ip) {
  return OFFICE_TEAM_VIEW_IPS.has(normalizeIp(ip));
}

function generateCode(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function defaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return formatDateOnly(date);
}

function isExpirationDatePast(dateOnly) {
  if (!dateOnly) return false;
  const expiresEnd = new Date(`${dateOnly}T23:59:59.999Z`);
  return !Number.isNaN(expiresEnd.getTime()) && expiresEnd.getTime() < Date.now();
}

function getBudgetAccess(state = {}) {
  const expiresAt = state.expiresAt || null;
  const expiredAt = state.expiredAt || null;
  return {
    expiresAt,
    expiredAt,
    isExpired: !!expiredAt || isExpirationDatePast(expiresAt)
  };
}

function normalizeBudgetStatus(status) {
  return ['active', 'won', 'lost'].includes(status) ? status : 'active';
}

function preserveBudgetAccess(nextState = {}, existingState = {}) {
  const preserved = { ...nextState };
  if (existingState.expiresAt !== undefined) preserved.expiresAt = existingState.expiresAt;
  if (existingState.expiredAt !== undefined) preserved.expiredAt = existingState.expiredAt;
  return preserved;
}

const VERSION_META_KEY = '__versionMeta';

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stripVersionMeta(state = {}) {
  if (!state || typeof state !== 'object') return state;
  const { [VERSION_META_KEY]: _meta, ...cleanState } = state;
  return cleanState;
}

function getVersionMeta(state = {}) {
  return state && typeof state === 'object' ? state[VERSION_META_KEY] || null : null;
}

function withVersionMeta(state = {}, meta = null) {
  if (!meta) return state;
  return { ...(state || {}), [VERSION_META_KEY]: meta };
}

function buildVersionMeta(req, user = null) {
  const ip = getRequestIp(req);
  return {
    ip: ip || null,
    userAgent: req.get('User-Agent') || null,
    isInternal: !!user || isOfficeTeamIp(ip),
    email: user?.email || null,
    timestamp: new Date().toISOString()
  };
}

// Extract Supabase auth token from request
const REMEMBER_ME_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MAX_AGE_MS = 60 * 60 * 1000;

function authCookieOptions(req, maxAge) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/'
  };
  if (maxAge) options.maxAge = maxAge;
  return options;
}

function setAuthCookies(req, res, session, rememberMe) {
  if (!session?.access_token) return;
  const accessMaxAge = rememberMe
    ? REMEMBER_ME_MAX_AGE_MS
    : Math.max(1, session.expires_in || 3600) * 1000;

  res.cookie('sb_token', session.access_token, authCookieOptions(req, accessMaxAge || DEFAULT_ACCESS_MAX_AGE_MS));

  if (rememberMe && session.refresh_token) {
    res.cookie('sb_refresh_token', session.refresh_token, authCookieOptions(req, REMEMBER_ME_MAX_AGE_MS));
  } else {
    res.clearCookie('sb_refresh_token', { path: '/' });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('sb_token', { path: '/' });
  res.clearCookie('sb_refresh_token', { path: '/' });
}

function getToken(req) {
  // Check cookie first, then Authorization header
  if (req.cookies.sb_token) return req.cookies.sb_token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function refreshRequestSession(req, res) {
  const refreshToken = req.cookies.sb_refresh_token;
  if (!refreshToken || !res) return null;
  try {
    const refreshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
    const { data, error } = await refreshClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session || !data?.user) {
      clearAuthCookies(res);
      return null;
    }
    setAuthCookies(req, res, data.session, true);
    return data.user;
  } catch (err) {
    console.error('Refresh session error:', err);
    clearAuthCookies(res);
    return null;
  }
}

async function getRequestUser(req, res = null) {
  const token = getToken(req);
  if (token) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) return user;
    } catch (_) {}
  }
  return refreshRequestSession(req, res);
}

// Ephemeral live browser presence. View history remains persisted separately.
const budgetPresence = new Map();
const PRESENCE_TTL_MS = 35 * 1000;

function getBudgetBrowserId(req) {
  const raw = req.query.browserId || req.get('X-Budget-Browser-Id') || '';
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
}

function pruneBudgetPresence(budgetId = null) {
  const now = Date.now();
  const pruneMap = (map) => {
    for (const [id, presence] of map.entries()) {
      if (now - presence.lastSeenMs > PRESENCE_TTL_MS) map.delete(id);
    }
  };

  if (budgetId) {
    const map = budgetPresence.get(budgetId);
    if (map) {
      pruneMap(map);
      if (map.size === 0) budgetPresence.delete(budgetId);
    }
    return;
  }

  for (const [id, map] of budgetPresence.entries()) {
    pruneMap(map);
    if (map.size === 0) budgetPresence.delete(id);
  }
}

function touchBudgetPresence(budgetId, req, isInternal = false) {
  const browserId = getBudgetBrowserId(req);
  if (!browserId) return;
  const ip = getRequestIp(req);

  pruneBudgetPresence(budgetId);
  let map = budgetPresence.get(budgetId);
  if (!map) {
    map = new Map();
    budgetPresence.set(budgetId, map);
  }

  map.set(browserId, {
    id: browserId,
    ip: ip || null,
    userAgent: req.get('User-Agent') || null,
    isInternal: !!isInternal || isOfficeTeamIp(ip),
    lastSeen: new Date().toISOString(),
    lastSeenMs: Date.now()
  });
}

function getActiveBudgetBrowsers(budgetId) {
  pruneBudgetPresence(budgetId);
  return Array.from(budgetPresence.get(budgetId)?.values() || [])
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
    .map(({ lastSeenMs, ...presence }) => presence);
}

setInterval(() => pruneBudgetPresence(), PRESENCE_TTL_MS).unref?.();

// Budget functions
async function ensureBudgetDefaultSnapshotForRow(budget) {
  if (!budget || hasBudgetDefaultSnapshot(budget.category_config)) {
    return budget?.category_config || null;
  }

  const defaults = await loadCategoryDefaultsData();
  const categoryConfig = mergeBudgetDefaultSnapshot(budget.category_config || {}, defaults);
  const { error } = await supabase
    .from('budgets')
    .update({ category_config: categoryConfig })
    .eq('id', budget.id);

  if (error) {
    console.error('snapshotBudgetDefaults error:', error);
    return budget.category_config || null;
  }

  return categoryConfig;
}

async function loadBudget(id) {
  const { data: budget, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !budget) return null;

  const categoryConfig = await ensureBudgetDefaultSnapshotForRow(budget);
  
  const { data: views } = await supabase
    .from('budget_views')
    .select('*')
    .eq('budget_id', id)
    .order('viewed_at', { ascending: false });
  
  const { data: versions } = await supabase
    .from('budget_versions')
    .select('*')
    .eq('budget_id', id)
    .order('version_number', { ascending: true });
  
  const access = getBudgetAccess(budget.current_state || {});
  return {
    id: budget.id,
    clientName: budget.client_name,
    builder: budget.builder,
    created: budget.created_at,
    lastModified: budget.modified_at,
    lastClientActivity: budget.last_client_activity_at || null,
    createdByEmail: budget.created_by_email || null,
    status: normalizeBudgetStatus(budget.status),
    notes: budget.notes || '',
    followUpDate: budget.follow_up_date || null,
    expiresAt: access.expiresAt,
    expiredAt: access.expiredAt,
    isExpired: access.isExpired,
    activeBrowsers: getActiveBudgetBrowsers(id),
    views: (views || []).map(v => ({ id: v.id, timestamp: v.viewed_at, ip: v.ip_address, userAgent: v.user_agent, isInternal: !!v.is_internal || isOfficeTeamIp(v.ip_address) })),
    versions: (versions || []).map(v => ({
      version: v.version_number,
      timestamp: v.created_at,
      state: stripVersionMeta(v.state),
      meta: getVersionMeta(v.state),
      note: v.note,
      pinned: !!v.is_pinned
    })),
    currentState: budget.current_state,
    isCustomized: !!budget.is_customized,
    sqftLocked: budget.sqft_locked,
    propertyTypeLocked: budget.property_type_locked,
    categoryConfig,
    customCategories: budget.custom_categories
  };
}

async function saveBudget(budget) {
  const row = {
    id: budget.id,
    client_name: budget.clientName || null,
    builder: budget.builder || null,
    modified_at: new Date().toISOString(),
    current_state: budget.currentState,
    is_customized: !!budget.isCustomized,
    sqft_locked: budget.sqftLocked || null,
    property_type_locked: budget.propertyTypeLocked || null,
    category_config: budget.categoryConfig || null,
    custom_categories: budget.customCategories || null
  };
  if (budget.createdByEmail !== undefined) {
    row.created_by_email = budget.createdByEmail;
  }
  const { error } = await supabase.from('budgets').upsert(row);
  throwSupabaseError(error, 'saveBudget');
}

async function listBudgets() {
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('id, client_name, builder, created_at, modified_at, views_count, last_viewed_at, last_client_activity_at, is_customized, sqft_locked, property_type_locked, current_state, created_by_email, status, notes, follow_up_date')
    .order('modified_at', { ascending: false });
  
  if (error) { console.error('listBudgets error:', error); return []; }
  
  // Get version counts
  const ids = budgets.map(b => b.id);
  let versionCounts = null;
  try {
    const { data } = await supabase.rpc('get_version_counts', { budget_ids: ids });
    versionCounts = data;
  } catch (e) {
    // RPC may not exist, fall through to individual counts
  }
  
  // Fallback: count versions per budget individually if RPC doesn't exist
  const vcMap = {};
  if (versionCounts) {
    versionCounts.forEach(vc => { vcMap[vc.budget_id] = vc.count; });
  } else {
    // Individual counts
    for (const b of budgets) {
      const { count } = await supabase
        .from('budget_versions')
        .select('*', { count: 'exact', head: true })
        .eq('budget_id', b.id);
      vcMap[b.id] = count || 0;
    }
  }
  
  // Count client vs internal views from budget_views table directly
  const viewMap = {};
  if (ids.length > 0) {
    const { data: allViews } = await supabase
      .from('budget_views')
      .select('budget_id, is_internal, ip_address')
      .in('budget_id', ids);
    if (allViews) {
      allViews.forEach(v => {
        if (!viewMap[v.budget_id]) viewMap[v.budget_id] = { client: 0, team: 0 };
        if (v.is_internal || isOfficeTeamIp(v.ip_address)) viewMap[v.budget_id].team++;
        else viewMap[v.budget_id].client++;
      });
    }
  }

  return budgets.map(b => {
    const views = viewMap[b.id] || { client: 0, team: 0 };
    const access = getBudgetAccess(b.current_state || {});
    return {
    id: b.id,
    clientName: b.client_name,
    builder: b.builder,
    created: b.created_at,
    lastModified: b.modified_at,
    viewCount: views.client + views.team,
    internalViews: views.team,
    clientViews: views.client,
    lastViewed: b.last_viewed_at,
    lastClientActivity: b.last_client_activity_at || null,
    versionCount: vcMap[b.id] || 0,
    currentTotal: b.current_state?.total || 0,
    isCustomized: !!b.is_customized,
    sqftLocked: b.sqft_locked,
    propertyTypeLocked: b.property_type_locked,
    createdByEmail: b.created_by_email || null,
    status: normalizeBudgetStatus(b.status),
    notes: b.notes || '',
    followUpDate: b.follow_up_date || null,
    expiresAt: access.expiresAt,
    expiredAt: access.expiredAt,
    isExpired: access.isExpired,
    activeBrowserCount: getActiveBudgetBrowsers(b.id).length
  };});
}

const viewNotifyThrottle = new Map();
const VIEW_NOTIFY_COOLDOWN_MS = 4 * 60 * 60 * 1000;

async function recordView(budgetId, ip, userAgent, isInternal = false) {
  const normalizedIp = normalizeIp(ip);
  const viewIsInternal = !!isInternal || isOfficeTeamIp(normalizedIp);
  await supabase
    .from('budget_views')
    .insert({ budget_id: budgetId, ip_address: normalizedIp || null, user_agent: userAgent || null, is_internal: viewIsInternal });

  const nowISO = new Date().toISOString();
  const update = { last_viewed_at: nowISO };
  if (!viewIsInternal) update.last_client_activity_at = nowISO;
  await supabase
    .from('budgets')
    .update(update)
    .eq('id', budgetId);

  try {
    const { error: rpcError } = await supabase.rpc('increment_views', { bid: budgetId });
    if (rpcError) {
      const { data } = await supabase.from('budgets').select('views_count').eq('id', budgetId).single();
      if (data) {
        await supabase.from('budgets').update({ views_count: (data.views_count || 0) + 1, last_viewed_at: new Date().toISOString() }).eq('id', budgetId);
      }
    }
  } catch (err) {
    console.error('increment_views fallback error:', err);
  }

  // Send view notification to creator (throttled: once per 4h per budget)
  if (!viewIsInternal) {
    const lastNotify = viewNotifyThrottle.get(budgetId) || 0;
    if (Date.now() - lastNotify > VIEW_NOTIFY_COOLDOWN_MS) {
      viewNotifyThrottle.set(budgetId, Date.now());
      const budget = await loadBudget(budgetId);
      if (budget?.createdByEmail) {
        sendViewNotification(budget).catch(err => console.error('View notification failed:', err));
      }
    }
  }
}

async function addVersion(budgetId, versionNum, state, note, isPinned, meta = null) {
  const { error } = await supabase
    .from('budget_versions')
    .insert({
      budget_id: budgetId,
      version_number: versionNum,
      state: withVersionMeta(state, meta),
      note: note || '',
      is_pinned: !!isPinned
    });

  throwSupabaseError(error, 'addVersion');
}

// ============================================================
// CHANGE NOTIFICATIONS
// ============================================================
const formatCurrencyPlain = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);

async function sendChangeNotification(budget, newState) {
  if (!budget.createdByEmail) return;
  const clientName = budget.clientName || 'A client';
  const budgetUrl = `${APP_URL}/b/${budget.id}`;
  const oldTotal = budget.currentState?.total || 0;
  const newTotal = newState?.total || 0;
  const totalChanged = oldTotal !== newTotal;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 20px"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden"><tr><td style="background:#0F2F44;padding:20px 32px"><h2 style="margin:0;color:#FFFFFF;font-size:18px">Budget Updated</h2></td></tr><tr><td style="padding:32px"><p style="margin:0 0 16px;color:#393939;font-size:15px;line-height:1.6"><strong>${clientName}</strong> made changes to their budget.</p>${totalChanged ? `<p style="margin:0 0 16px;color:#393939;font-size:15px">Total changed: ${formatCurrencyPlain(oldTotal)} → <strong>${formatCurrencyPlain(newTotal)}</strong></p>` : ''}<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center"><a href="${budgetUrl}" style="display:inline-block;background:#017ED7;color:#FFFFFF;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Budget</a></td></tr></table><p style="margin:0;color:#999;font-size:12px">You're receiving this because you created this budget on Gamma Tech Budget Planner.</p></td></tr></table></td></tr></table></body></html>`;

  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: budget.createdByEmail,
      subject: `Budget update: ${clientName}${totalChanged ? ` (${formatCurrencyPlain(newTotal)})` : ''}`,
      html
    });
    console.log(`Change notification sent to ${budget.createdByEmail} for budget ${budget.id}`);
  } catch (err) {
    console.error('Change notification email error:', err);
  }
}

async function sendViewNotification(budget) {
  if (!budget.createdByEmail) return;
  const clientName = budget.clientName || 'Someone';
  const budgetUrl = `${APP_URL}/b/${budget.id}`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 20px"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden"><tr><td style="background:#0F2F44;padding:20px 32px"><h2 style="margin:0;color:#FFFFFF;font-size:18px">Budget Viewed</h2></td></tr><tr><td style="padding:32px"><p style="margin:0 0 16px;color:#393939;font-size:15px;line-height:1.6"><strong>${clientName}</strong> just opened their budget.</p>${budget.currentState?.total ? `<p style="margin:0 0 16px;color:#393939;font-size:15px">Current total: <strong>${formatCurrencyPlain(budget.currentState.total)}</strong></p>` : ''}<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center"><a href="${budgetUrl}" style="display:inline-block;background:#017ED7;color:#FFFFFF;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Budget</a></td></tr></table><p style="margin:0;color:#999;font-size:12px">You're receiving this because you created this budget on Gamma Tech Budget Planner.</p></td></tr></table></td></tr></table></body></html>`;

  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: budget.createdByEmail,
      subject: `${clientName} is viewing their budget`,
      html
    });
    console.log(`View notification sent to ${budget.createdByEmail} for budget ${budget.id}`);
  } catch (err) {
    console.error('View notification email error:', err);
  }
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
async function requireAuth(req, res, next) {
  const user = await getRequestUser(req, res);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  req.user = user;
  next();
}

// ============================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================
const schemas = {
  login: z.object({
    email: z.string().min(1).max(254),
    password: z.string().min(1).max(100),
    rememberMe: z.boolean().optional().default(true)
  }),

  forgotPassword: z.object({
    email: z.string().email().max(254)
  }),

  resetPassword: z.object({
    password: z.string().min(8).max(100),
    code: z.string().min(1).max(1000).optional(),
    accessToken: z.string().min(1).max(5000).optional(),
    refreshToken: z.string().min(1).max(5000).optional()
  }),

  createBudget: z.object({
    state: z.any(),
    clientName: z.string().max(200).optional().nullable()
  }),

  updateBudget: z.object({
    state: z.any(),
    note: z.string().max(500).optional(),
    pin: z.boolean().optional()
  }),

  updateBudgetProject: z.object({
    clientName: z.string().max(200).optional().nullable(),
    homeSize: z.coerce.number().int().min(500).max(50000).optional(),
    propertyType: z.enum(['residential', 'condo']).optional(),
    pricingMode: z.enum(['recalculate', 'preserve']).optional()
  }),

  cloneBudget: z.object({
    clientName: z.string().max(200).optional().nullable()
  }),

  customizeBudget: z.object({
    categoryConfig: z.record(z.string(), z.any()),
    customCategories: z.array(z.any())
  }).strict(),

  createLink: z.object({
    config: z.string().min(1).max(5000),
    clientName: z.string().max(200).optional().nullable(),
    customCode: z.string().max(50).optional()
  }),

  sendEmail: z.object({
    recipientEmail: z.string().email().max(254),
    recipientName: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    htmlContent: z.string().max(50000).optional(),
    proposalData: z.any().optional()
  })
};

// ============================================================
// CATEGORY DEFAULTS — load static seed data
// ============================================================
const categoriesDataPath = path.join(__dirname, 'public', 'categories-data.js');
function loadStaticCategoryData() {
  const vm = require('vm');
  const fs = require('fs');
  const code = fs.readFileSync(categoriesDataPath, 'utf8');
  // Replace const/let with var so they become context properties
  const modCode = code.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
  const sandbox = { JSON, Object, Math, Array, console };
  vm.createContext(sandbox);
  vm.runInContext(modCode, sandbox);
  return normalizeCategoryDefaults({
    residential_categories: sandbox.RESIDENTIAL_CATEGORIES,
    residential_extras: sandbox.RESIDENTIAL_EXTRAS,
    condo_categories: sandbox.CONDO_CATEGORIES,
    condo_extras: sandbox.CONDO_EXTRAS,
    base_sqft: 4000
  });
}

const TIER_KEYS = ['good', 'standard', 'better', 'best'];
const FEATURE_MATRIX_STATUSES = ['included', 'addon', 'not_included'];
const DEFAULT_CATEGORY_SNAPSHOT_KEY = '__defaultCategories';
const DEFAULT_EXTRA_SNAPSHOT_KEY = '__defaultExtras';
const DEFAULT_SECTION_SNAPSHOT_KEY = '__defaultSections';

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function throwSupabaseError(error, context) {
  if (!error) return;
  const err = new Error(`${context}: ${error.message || 'Supabase write failed'}`);
  err.cause = error;
  throw err;
}

function splitFeatureLines(features) {
  const list = Array.isArray(features) ? features : (features ? [features] : []);
  return list
    .flatMap(feature => String(feature).split(/\r?\n/))
    .map(feature => feature.trim())
    .filter(Boolean);
}

function slugifyFeatureId(value) {
  const slug = String(value || 'feature')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'feature';
}

function normalizeMatrixTierCell(value) {
  const rawStatus = value && typeof value === 'object' ? value.status : value;
  const status = FEATURE_MATRIX_STATUSES.includes(rawStatus) ? rawStatus : 'not_included';
  if (status !== 'addon') return status;
  const price = Number(value && typeof value === 'object' ? value.price : 0) || 0;
  return price > 0 ? { status, price } : status;
}

function matrixCellStatus(value) {
  return value && typeof value === 'object' ? value.status : value;
}

function matrixCellPrice(value) {
  return value && typeof value === 'object' ? Math.max(0, Number(value.price) || 0) : 0;
}

function normalizeFeatureMatrixPayload(matrix = []) {
  const usedIds = new Set();
  return (Array.isArray(matrix) ? matrix : [])
    .map((feature, index) => {
      const label = String(feature?.label || feature?.name || '').trim();
      if (!label) return null;
      const id = uniqueSectionId(slugifyFeatureId(feature?.id || label), usedIds);
      const tierStatus = {};
      TIER_KEYS.forEach(tierKey => {
        const value = feature?.tierStatus?.[tierKey] || feature?.tiers?.[tierKey] || feature?.[tierKey] || 'not_included';
        tierStatus[tierKey] = normalizeMatrixTierCell(value);
      });
      return {
        id,
        label,
        description: String(feature?.description || feature?.details || '').trim(),
        group: String(feature?.group || '').trim(),
        order: Number.isFinite(Number(feature?.order)) ? Number(feature.order) : index,
        tierStatus
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function legacyFeaturesFromMatrixPayload(matrix = [], tierKey) {
  return normalizeFeatureMatrixPayload(matrix)
    .filter(feature => matrixCellStatus(feature.tierStatus?.[tierKey]) === 'included')
    .map(feature => feature.label);
}

function selectedMatrixAddOnTotal(category = {}, tierKey, selectedForCategory = {}) {
  if (!tierKey || !category?.featureMatrix) return 0;
  const selectedForTier = selectedForCategory?.[tierKey] || {};
  return normalizeFeatureMatrixPayload(category.featureMatrix)
    .reduce((total, feature) => {
      if (!selectedForTier[feature.id]) return total;
      const cell = feature.tierStatus?.[tierKey];
      return matrixCellStatus(cell) === 'addon' ? total + matrixCellPrice(cell) : total;
    }, 0);
}

function normalizeTierPayload(tier = {}) {
  const payload = {};
  if (tier.enabled !== undefined) payload.enabled = tier.enabled !== false;
  if (tier.label !== undefined) payload.label = String(tier.label || '');
  if (tier.price !== undefined) payload.price = Number(tier.price) || 0;
  if (tier.features !== undefined) payload.features = splitFeatureLines(tier.features);
  if (tier.brands !== undefined) payload.brands = String(tier.brands || '');
  if (tier.sizeScale !== undefined && tier.sizeScale !== '') payload.sizeScale = Number(tier.sizeScale) || 0;
  return payload;
}

function normalizePresentationPayload(payload = {}) {
  const normalized = deepClone(payload || {}) || {};
  const presentationMode = normalized.presentationMode === 'matrix' ? 'matrix' : 'list';
  const featureMatrix = presentationMode === 'matrix'
    ? normalizeFeatureMatrixPayload(normalized.featureMatrix || [])
    : [];
  const tiers = {};
  TIER_KEYS.forEach(tierKey => {
    if (!normalized.tiers?.[tierKey]) return;
    tiers[tierKey] = normalizeTierPayload(normalized.tiers[tierKey]);
    if (presentationMode === 'matrix') {
      tiers[tierKey].features = legacyFeaturesFromMatrixPayload(featureMatrix, tierKey);
    }
  });
  normalized.tiers = tiers;
  normalized.presentationMode = presentationMode;
  delete normalized.tierOrder;
  delete normalized.tier_order;
  if (presentationMode === 'matrix' && featureMatrix.length) {
    normalized.featureMatrix = featureMatrix;
  } else {
    delete normalized.featureMatrix;
  }
  return normalized;
}

function normalizeCategoryConfigPayload(categoryConfig = {}) {
  if (!categoryConfig || typeof categoryConfig !== 'object') return {};
  const normalized = {};
  Object.entries(categoryConfig).forEach(([key, value]) => {
    if (key.startsWith('__') || !value || typeof value !== 'object' || !value.tiers) {
      normalized[key] = deepClone(value);
      return;
    }
    normalized[key] = normalizePresentationPayload(value);
  });
  return normalized;
}

function mergeCategoryConfigPayload(baseConfig = {}, incomingConfig = {}) {
  const merged = deepClone(baseConfig || {}) || {};
  Object.entries(incomingConfig || {}).forEach(([key, value]) => {
    if (key.startsWith('__') || !value || typeof value !== 'object') {
      merged[key] = deepClone(value);
      return;
    }
    const current = merged[key] && typeof merged[key] === 'object' ? merged[key] : {};
    merged[key] = {
      ...deepClone(current),
      ...deepClone(value)
    };
    if (current.tiers || value.tiers) {
      merged[key].tiers = {
        ...(current.tiers || {}),
        ...(value.tiers || {})
      };
    }
  });
  return normalizeCategoryConfigPayload(merged);
}

function normalizeCustomCategoriesPayload(customCategories = []) {
  return (Array.isArray(customCategories) ? customCategories : [])
    .map(category => normalizePresentationPayload(category))
    .filter(category => category.id && category.name && Object.keys(category.tiers || {}).length > 0);
}

function mergeCustomCategoriesPayload(existingCategories = [], incomingCategories = []) {
  const existingById = new Map((existingCategories || []).map(category => [category.id, category]));
  return normalizeCustomCategoriesPayload((incomingCategories || []).map(category => {
    const existing = existingById.get(category?.id) || {};
    const merged = {
      ...deepClone(existing),
      ...deepClone(category || {})
    };
    if (existing.tiers || category?.tiers) {
      merged.tiers = {
        ...(existing.tiers || {}),
        ...(category?.tiers || {})
      };
    }
    return merged;
  }));
}

function slugifySectionId(value) {
  const slug = String(value || 'other')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'other';
}

function uniqueSectionId(baseId, usedIds) {
  const base = baseId || 'section';
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeSectionList(categories = [], sections = []) {
  const usedIds = new Set();
  const normalized = [];
  const byName = new Map();
  const byId = new Map();

  (sections || []).forEach((section, index) => {
    const name = String(section?.name || section?.label || section?.id || 'Other').trim() || 'Other';
    const id = uniqueSectionId(slugifySectionId(section?.id || name), usedIds);
    const item = {
      id,
      name,
      order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index
    };
    normalized.push(item);
    byName.set(name.toLowerCase(), item);
    byId.set(id, item);
  });

  (categories || []).forEach(cat => {
    const explicitId = cat?.section_id || cat?.sectionId;
    if (explicitId && byId.has(explicitId)) return;
    const name = String(cat?.section || cat?.sectionName || explicitId || 'Other').trim() || 'Other';
    if (byName.has(name.toLowerCase())) return;
    const id = uniqueSectionId(slugifySectionId(explicitId || name), usedIds);
    const item = { id, name, order: normalized.length };
    normalized.push(item);
    byName.set(name.toLowerCase(), item);
    byId.set(id, item);
  });

  return normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalizeCategoryList(categories = [], sections = []) {
  const normalizedSections = normalizeSectionList(categories, sections);
  const byName = new Map(normalizedSections.map(section => [section.name.toLowerCase(), section]));
  const byId = new Map(normalizedSections.map(section => [section.id, section]));
  const nextOrderBySection = new Map();

  const normalizedCategories = (categories || []).map((cat, index) => {
    const copy = deepClone(cat) || {};
    let section = byId.get(copy.section_id || copy.sectionId);
    if (!section) {
      const name = String(copy.section || copy.sectionName || 'Other').trim() || 'Other';
      section = byName.get(name.toLowerCase()) || normalizedSections[0] || { id: 'other', name: 'Other', order: 0 };
    }
    const nextOrder = nextOrderBySection.get(section.id) || 0;
    nextOrderBySection.set(section.id, nextOrder + 1);
    copy.section_id = section.id;
    copy.sectionId = section.id;
    copy.section = section.name;
    if (!Number.isFinite(Number(copy.sortOrder))) copy.sortOrder = nextOrder;
    if (!Number.isFinite(Number(copy.order))) copy.order = index;
    return copy;
  });

  return { categories: normalizedCategories, sections: normalizedSections };
}

function normalizeCategoryDefaults(defaults = {}) {
  const residential = normalizeCategoryList(defaults.residential_categories || [], defaults.residential_sections || []);
  const condo = normalizeCategoryList(defaults.condo_categories || [], defaults.condo_sections || []);
  return {
    residential_categories: residential.categories,
    residential_sections: residential.sections,
    residential_extras: defaults.residential_extras || [],
    condo_categories: condo.categories,
    condo_sections: condo.sections,
    condo_extras: defaults.condo_extras || [],
    base_sqft: defaults.base_sqft || 4000
  };
}

async function loadCategoryDefaultsData() {
  const { data, error } = await supabase.from('category_defaults').select('*').eq('id', 'current').single();
  if (error || !data) return loadStaticCategoryData();
  return normalizeCategoryDefaults({
    residential_categories: data.residential_categories || [],
    residential_sections: data.residential_sections || [],
    residential_extras: data.residential_extras || [],
    condo_categories: data.condo_categories || [],
    condo_sections: data.condo_sections || [],
    condo_extras: data.condo_extras || [],
    base_sqft: data.base_sqft || 4000
  });
}

function getDefaultCategoriesFromData(defaults, propertyType) {
  return propertyType === 'condo'
    ? (defaults.condo_categories || [])
    : (defaults.residential_categories || []);
}

function getDefaultExtrasFromData(defaults, propertyType) {
  return propertyType === 'condo'
    ? (defaults.condo_extras || [])
    : (defaults.residential_extras || []);
}

function getDefaultSectionsFromData(defaults, propertyType) {
  return propertyType === 'condo'
    ? (defaults.condo_sections || [])
    : (defaults.residential_sections || []);
}

function buildBudgetDefaultSnapshot(defaults) {
  const normalized = normalizeCategoryDefaults(defaults);
  return {
    [DEFAULT_CATEGORY_SNAPSHOT_KEY]: {
      residential: deepClone(normalized.residential_categories || []),
      condo: deepClone(normalized.condo_categories || [])
    },
    [DEFAULT_EXTRA_SNAPSHOT_KEY]: {
      residential: deepClone(normalized.residential_extras || []),
      condo: deepClone(normalized.condo_extras || [])
    },
    [DEFAULT_SECTION_SNAPSHOT_KEY]: {
      residential: deepClone(normalized.residential_sections || []),
      condo: deepClone(normalized.condo_sections || [])
    }
  };
}

function getSnapshotForPropertyType(snapshot, propertyType) {
  if (Array.isArray(snapshot)) return snapshot;
  return snapshot?.[propertyType] || null;
}

function getBudgetDefaultCategoriesFromConfig(categoryConfig, defaults, propertyType) {
  const categories = getSnapshotForPropertyType(categoryConfig?.[DEFAULT_CATEGORY_SNAPSHOT_KEY], propertyType)
    || getDefaultCategoriesFromData(defaults, propertyType);
  const sections = getBudgetDefaultSectionsFromConfig(categoryConfig, defaults, propertyType);
  return normalizeCategoryList(categories, sections).categories;
}

function getBudgetDefaultExtrasFromConfig(categoryConfig, defaults, propertyType) {
  return getSnapshotForPropertyType(categoryConfig?.[DEFAULT_EXTRA_SNAPSHOT_KEY], propertyType)
    || getDefaultExtrasFromData(defaults, propertyType);
}

function getBudgetDefaultSectionsFromConfig(categoryConfig, defaults, propertyType) {
  const categories = getSnapshotForPropertyType(categoryConfig?.[DEFAULT_CATEGORY_SNAPSHOT_KEY], propertyType)
    || getDefaultCategoriesFromData(defaults, propertyType);
  return getSnapshotForPropertyType(categoryConfig?.[DEFAULT_SECTION_SNAPSHOT_KEY], propertyType)
    || getDefaultSectionsFromData(defaults, propertyType)
    || normalizeSectionList(categories);
}

function hasBudgetDefaultSnapshot(categoryConfig) {
  return !!(
    categoryConfig
    && categoryConfig[DEFAULT_CATEGORY_SNAPSHOT_KEY]
    && categoryConfig[DEFAULT_EXTRA_SNAPSHOT_KEY]
  );
}

function mergeBudgetDefaultSnapshot(categoryConfig, defaults) {
  return {
    ...buildBudgetDefaultSnapshot(defaults),
    ...(categoryConfig || {})
  };
}

function getSizeMultiplierForBudget(sqft, scaleFactor) {
  if (scaleFactor === 0) return 1;
  const effectiveSqft = Math.max(sqft, 2500);
  const baseline = 4000;
  const ratio = effectiveSqft / baseline;
  return 1 + (ratio - 1) * scaleFactor;
}

function getScaledBudgetPrice(basePrice, sqft, scaleFactor) {
  return Math.round((basePrice || 0) * getSizeMultiplierForBudget(sqft, scaleFactor) / 100) * 100;
}

function getDefaultTierPrice(cat, tierKey, sqft) {
  const tier = cat?.tiers?.[tierKey];
  if (!tier) return null;
  if (cat.baseTierNoScale && tierKey === 'good') return tier.price || 0;
  const scale = tier.sizeScale !== undefined ? tier.sizeScale : (cat.sizeScale ?? 0.5);
  return getScaledBudgetPrice(tier.price || 0, sqft, scale);
}

function getDefaultExtraPrice(extra, sqft) {
  if (!extra) return null;
  const basePrice = extra.price || extra.cost || 0;
  if (extra.sizeScale !== undefined) {
    return getScaledBudgetPrice(basePrice, sqft, extra.sizeScale);
  }
  return basePrice;
}

function updateNonCustomCategoryPrices(existingConfig = {}, oldCategories, newCategories, oldSqft, newSqft) {
  const oldById = new Map(oldCategories.map(cat => [cat.id, cat]));
  const config = {};
  newCategories.forEach(cat => {
    const existing = existingConfig[cat.id] || {};
    const oldCat = oldById.get(cat.id);
    const tiers = {};
    TIER_KEYS.forEach(tierKey => {
      const defaultTier = cat.tiers?.[tierKey];
      const existingTier = existing.tiers?.[tierKey] || {};
      if (!defaultTier && !existingTier.price && existingTier.enabled !== true) return;
      const oldDefaultPrice = getDefaultTierPrice(oldCat, tierKey, oldSqft);
      const newDefaultPrice = getDefaultTierPrice(cat, tierKey, newSqft);
      const hasCustomPrice = existingTier.price !== undefined &&
        oldDefaultPrice !== null &&
        Number(existingTier.price) !== oldDefaultPrice;
      tiers[tierKey] = {
        enabled: existingTier.enabled !== undefined ? existingTier.enabled : true,
        label: existingTier.label ?? defaultTier?.label ?? tierKey,
        price: hasCustomPrice ? existingTier.price : (newDefaultPrice ?? existingTier.price ?? 0),
        features: existingTier.features ?? defaultTier?.features ?? [],
        brands: existingTier.brands ?? defaultTier?.brands ?? ''
      };
    });
    config[cat.id] = { hidden: existing.hidden === true, tiers };
  });
  Object.keys(existingConfig).forEach(catId => {
    if (!config[catId]) config[catId] = existingConfig[catId];
  });
  return config;
}

function updateNonCustomExtraPrices(existingConfig = {}, oldExtras, newExtras, oldSqft, newSqft) {
  const oldById = new Map(oldExtras.map(extra => [extra.id, extra]));
  const config = {};
  newExtras.forEach(extra => {
    const existing = existingConfig[extra.id] || {};
    const oldDefaultPrice = getDefaultExtraPrice(oldById.get(extra.id), oldSqft);
    const newDefaultPrice = getDefaultExtraPrice(extra, newSqft);
    const hasCustomPrice = existing.price !== undefined &&
      oldDefaultPrice !== null &&
      Number(existing.price) !== oldDefaultPrice;
    config[extra.id] = {
      hidden: existing.hidden === true,
      price: hasCustomPrice ? existing.price : (newDefaultPrice ?? existing.price ?? 0)
    };
  });
  Object.keys(existingConfig).forEach(extraId => {
    if (!config[extraId]) config[extraId] = existingConfig[extraId];
  });
  return config;
}

function preserveCategoryPricesAcrossChange(existingConfig = {}, oldCategories, newCategories, oldSqft, newSqft) {
  const oldById = new Map(oldCategories.map(cat => [cat.id, cat]));
  const config = {};
  newCategories.forEach(cat => {
    const existing = existingConfig[cat.id] || {};
    const oldCat = oldById.get(cat.id);
    const tiers = {};
    TIER_KEYS.forEach(tierKey => {
      const defaultTier = cat.tiers?.[tierKey];
      const existingTier = existing.tiers?.[tierKey] || {};
      if (!defaultTier && !existingTier.price && existingTier.enabled !== true) return;
      tiers[tierKey] = {
        enabled: existingTier.enabled !== undefined ? existingTier.enabled : true,
        label: existingTier.label ?? defaultTier?.label ?? tierKey,
        price: existingTier.price ?? getDefaultTierPrice(oldCat, tierKey, oldSqft) ?? getDefaultTierPrice(cat, tierKey, newSqft) ?? 0,
        features: existingTier.features ?? defaultTier?.features ?? [],
        brands: existingTier.brands ?? defaultTier?.brands ?? ''
      };
    });
    config[cat.id] = { hidden: existing.hidden === true, tiers };
  });
  Object.keys(existingConfig).forEach(catId => {
    if (!config[catId]) config[catId] = existingConfig[catId];
  });
  return config;
}

function preserveExtraPricesAcrossChange(existingConfig = {}, oldExtras, newExtras, oldSqft, newSqft) {
  const oldById = new Map(oldExtras.map(extra => [extra.id, extra]));
  const config = {};
  newExtras.forEach(extra => {
    const existing = existingConfig[extra.id] || {};
    config[extra.id] = {
      hidden: existing.hidden === true,
      price: existing.price ?? getDefaultExtraPrice(oldById.get(extra.id), oldSqft) ?? getDefaultExtraPrice(extra, newSqft) ?? 0
    };
  });
  Object.keys(existingConfig).forEach(extraId => {
    if (!config[extraId]) config[extraId] = existingConfig[extraId];
  });
  return config;
}

function calculateBudgetTotal(state, defaults, options = {}) {
  const sqft = options.sqft || state.homeSize || 4000;
  const propertyType = options.propertyType || state.propertyType || 'residential';
  const isCustomized = !!options.isCustomized;
  const categoryConfig = options.categoryConfig || {};
  const customCategories = options.customCategories || [];
  let subtotal = 0;

  const defaultCategories = getBudgetDefaultCategoriesFromConfig(categoryConfig, defaults, propertyType);
  const customById = new Map((customCategories || []).map(cat => [cat.id, cat]));
  const defaultById = new Map(defaultCategories.map(cat => [cat.id, cat]));

  Object.entries(state.selections || {}).forEach(([catId, tierKey]) => {
    if (!tierKey) return;
    const selectedAddOns = state.addOns?.[catId] || {};
    const customCat = customById.get(catId);
    if (customCat?.tiers?.[tierKey]) {
      subtotal += Number(customCat.tiers[tierKey].price || 0);
      subtotal += selectedMatrixAddOnTotal(customCat, tierKey, selectedAddOns);
      return;
    }

    const defaultCat = defaultById.get(catId);
    const categoryForAddOns = {
      ...(defaultCat || {}),
      ...(categoryConfig[catId]?.featureMatrix ? { featureMatrix: categoryConfig[catId].featureMatrix } : {})
    };
    const override = categoryConfig[catId]?.tiers?.[tierKey];
    if (isCustomized && override?.enabled === false) return;
    if (isCustomized && override?.price !== undefined) {
      subtotal += Number(override.price || 0);
      subtotal += selectedMatrixAddOnTotal(categoryForAddOns, tierKey, selectedAddOns);
      return;
    }

    if (!defaultCat?.tiers?.[tierKey]) return;
    const price = getDefaultTierPrice(defaultCat, tierKey, sqft);
    subtotal += price || 0;
    subtotal += selectedMatrixAddOnTotal(categoryForAddOns, tierKey, selectedAddOns);
  });

  Object.values(state.catMods || {}).forEach(mod => {
    subtotal += Number(mod?.amount || 0);
  });

  const extraConfig = categoryConfig.__extras || {};
  const extrasById = new Map(getBudgetDefaultExtrasFromConfig(categoryConfig, defaults, propertyType).map(extra => [extra.id, extra]));
  Object.entries(state.extras || {}).forEach(([extraId, selected]) => {
    if (!selected) return;
    const extra = extrasById.get(extraId);
    if (!extra) return;
    const override = extraConfig[extraId];
    if (override?.hidden === true) return;
    if (isCustomized && override?.price !== undefined) {
      subtotal += Number(override.price || 0);
    } else {
      subtotal += getDefaultExtraPrice(extra, sqft) || 0;
    }
  });

  (state.modifiers || []).forEach(mod => {
    subtotal += Number(mod?.amount || 0);
  });

  return Math.round(subtotal * 1.06);
}

// Check if category_defaults table exists and seed if needed
async function seedCategoryDefaults() {
  try {
    const { data, error } = await supabase.from('category_defaults').select('id').eq('id', 'current').single();
    if (error && error.code === 'PGRST116') {
      // No rows - seed from static data
      console.log('[Categories] Seeding category_defaults from static data...');
      const seed = loadStaticCategoryData();
      const { error: insertErr } = await supabase.from('category_defaults').insert({
        id: 'current',
        ...seed,
        updated_by: 'system-seed'
      });
      if (insertErr) console.error('[Categories] Seed error:', insertErr.message);
      else console.log('[Categories] Seeded successfully');
    } else if (error) {
      // Table probably doesn't exist
      console.warn('[Categories] Table may not exist. Run migrations/001_category_defaults.sql in Supabase SQL Editor.');
    } else {
      console.log('[Categories] category_defaults table ready');
    }
  } catch (err) {
    console.warn('[Categories] Init check failed:', err.message);
  }
}

async function backfillBudgetDefaultSnapshots() {
  try {
    const defaults = await loadCategoryDefaultsData();
    const snapshot = buildBudgetDefaultSnapshot(defaults);
    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('id, category_config');

    if (error) {
      console.warn('[Categories] Budget default snapshot backfill skipped:', error.message);
      return;
    }

    const updates = (budgets || [])
      .filter(budget => !hasBudgetDefaultSnapshot(budget.category_config))
      .map(budget => supabase
        .from('budgets')
        .update({ category_config: { ...snapshot, ...(budget.category_config || {}) } })
        .eq('id', budget.id));

    if (updates.length) {
      await Promise.all(updates);
      console.log(`[Categories] Backfilled default snapshots for ${updates.length} budgets`);
    }
  } catch (err) {
    console.warn('[Categories] Budget default snapshot backfill failed:', err.message);
  }
}

// Seed/backfill on startup (non-blocking)
(async () => {
  await seedCategoryDefaults();
  await backfillBudgetDefaultSnapshots();
})();

// ============================================================
// CATEGORY API — PUBLIC
// ============================================================
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('category_defaults').select('*').eq('id', 'current').single();
    if (error || !data) {
      // Fallback to static file data
      const staticData = loadStaticCategoryData();
      return res.json(staticData);
    }
    res.json(normalizeCategoryDefaults({
      residential_categories: data.residential_categories,
      residential_sections: data.residential_sections || [],
      residential_extras: data.residential_extras,
      condo_categories: data.condo_categories,
      condo_sections: data.condo_sections || [],
      condo_extras: data.condo_extras,
      base_sqft: data.base_sqft
    }));
  } catch (err) {
    console.error('GET /api/categories error:', err);
    const staticData = loadStaticCategoryData();
    res.json(staticData);
  }
});

// ============================================================
// CATEGORY API — ADMIN (requireAuth)
// ============================================================
app.get('/api/admin/categories', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('category_defaults').select('*').eq('id', 'current').single();
    if (error || !data) {
      // Return static defaults
      const staticData = loadStaticCategoryData();
      return res.json({ ...staticData, updated_at: null, updated_by: null, source: 'static' });
    }
    res.json({ ...data, ...normalizeCategoryDefaults(data), source: 'database' });
  } catch (err) {
    console.error('GET /api/admin/categories error:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

app.put('/api/admin/categories', requireAuth, async (req, res) => {
  try {
    const {
      residential_categories,
      residential_sections,
      residential_extras,
      condo_categories,
      condo_sections,
      condo_extras,
      base_sqft
    } = req.body;
    if (!residential_categories || !condo_categories) {
      return res.status(400).json({ error: 'Missing required category data' });
    }
    const normalized = normalizeCategoryDefaults({
      residential_categories,
      residential_sections,
      residential_extras,
      condo_categories,
      condo_sections,
      condo_extras,
      base_sqft
    });
    const row = {
      id: 'current',
      residential_categories: normalized.residential_categories,
      residential_sections: normalized.residential_sections,
      residential_extras: normalized.residential_extras || [],
      condo_categories: normalized.condo_categories,
      condo_sections: normalized.condo_sections,
      condo_extras: normalized.condo_extras || [],
      base_sqft: normalized.base_sqft || 4000,
      updated_at: new Date().toISOString(),
      updated_by: req.user.email
    };
    let { error } = await supabase.from('category_defaults').upsert(row);
    if (error && /residential_sections|condo_sections|schema cache|column/i.test(error.message || '')) {
      const legacyRow = { ...row };
      delete legacyRow.residential_sections;
      delete legacyRow.condo_sections;
      ({ error } = await supabase.from('category_defaults').upsert(legacyRow));
    }
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/admin/categories error:', err);
    res.status(500).json({ error: 'Failed to save categories' });
  }
});

app.post('/api/admin/categories/reset', requireAuth, async (req, res) => {
  try {
    const staticData = loadStaticCategoryData();
    const row = {
      id: 'current',
      ...staticData,
      updated_at: new Date().toISOString(),
      updated_by: req.user.email + ' (reset)'
    };
    let { error } = await supabase.from('category_defaults').upsert(row);
    if (error && /residential_sections|condo_sections|schema cache|column/i.test(error.message || '')) {
      const legacyRow = { ...row };
      delete legacyRow.residential_sections;
      delete legacyRow.condo_sections;
      ({ error } = await supabase.from('category_defaults').upsert(legacyRow));
    }
    if (error) throw error;
    res.json({ success: true, message: 'Reset to factory defaults' });
  } catch (err) {
    console.error('POST /api/admin/categories/reset error:', err);
    res.status(500).json({ error: 'Failed to reset categories' });
  }
});

// ============================================================
// SHORT LINK ROUTES
// ============================================================
app.get('/s/:code', async (req, res) => {
  const { data: link } = await supabase
    .from('short_links')
    .select('*')
    .eq('code', req.params.code)
    .single();
  
  if (link) {
    // Update access stats
    await supabase
      .from('short_links')
      .update({ last_accessed_at: new Date().toISOString(), access_count: (link.access_count || 0) + 1 })
      .eq('code', req.params.code);
    res.redirect('/?' + link.config);
  } else {
    res.status(404).send('Short link not found');
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/login', limits.auth, async (req, res) => {
  try {
    let { email, password, rememberMe } = schemas.login.parse(req.body);
    if (!email.includes('@')) email += '@gamma.tech';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    setAuthCookies(req, res, data.session, rememberMe);
    
    res.json({ 
      success: true, 
      user: { 
        id: data.user.id, 
        email: data.user.email, 
        name: data.user.user_metadata?.name || data.user.email 
      } 
    });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/forgot-password', limits.auth, async (req, res) => {
  try {
    const { email } = schemas.forgotPassword.parse(req.body);
    const successMsg = { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
    
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/admin.html#reset-password`
    });
    
    res.json(successMsg);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

async function handleResetPassword(req, res) {
  try {
    const { password, code, accessToken, refreshToken } = schemas.resetPassword.parse(req.body);

    if (!code && !accessToken) {
      return res.status(400).json({ error: 'Invalid reset link. Please request a new one.' });
    }

    const resetClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: accessToken ? {
          headers: { Authorization: `Bearer ${accessToken}` }
        } : undefined
      }
    );

    if (code) {
      const { error } = await resetClient.auth.exchangeCodeForSession(code);
      if (error) {
        return res.status(400).json({ error: 'Reset link is invalid or expired. Please request a new one.' });
      }
    } else if (refreshToken) {
      const { error } = await resetClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) {
        return res.status(400).json({ error: 'Reset link is invalid or expired. Please request a new one.' });
      }
    }

    const { error } = await resetClient.auth.updateUser({ password });
    if (error) {
      return res.status(400).json({ error: error.message || 'Failed to update password.' });
    }

    clearAuthCookies(res);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid password reset request' });
    }
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
}

app.post('/api/auth/reset-password', limits.auth, handleResetPassword);
app.post('/api/auth/reset-password-with-token', limits.auth, handleResetPassword);

app.post('/api/auth/logout', async (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getRequestUser(req, res);
  if (!user) return res.json({ authenticated: false });
  
  res.json({ 
    authenticated: true, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.user_metadata?.name || user.email,
      username: user.email
    } 
  });
});

// ============================================================
// ADMIN USER ROUTES (via Supabase Auth Admin)
// ============================================================
app.get('/api/admin/users', requireAuth, async (req, res) => {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    res.json(users.map(u => ({
      id: u.id,
      username: u.email,
      email: u.email,
      name: u.user_metadata?.name || u.email,
      created: u.created_at
    })));
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.post('/api/auth/users', requireAuth, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email }
    });
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ 
      success: true, 
      user: { id: data.user.id, email: data.user.email, name: name || email } 
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (name) updates.user_metadata = { name };
    
    const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, updates);
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ 
      success: true, 
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email } 
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const { error } = await supabase.auth.admin.deleteUser(req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============================================================
// BUDGET ROUTES
// ============================================================
app.post('/api/budgets', limits.api, async (req, res) => {
  try {
    const data = schemas.createBudget.parse(req.body);

    let id;
    let exists;
    do {
      id = generateCode(8);
      const { data: check } = await supabase.from('budgets').select('id').eq('id', id).single();
      exists = !!check;
    } while (exists);

    // Capture creator email if authenticated
    let createdByEmail = null;
    const token = getToken(req);
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.email) createdByEmail = user.email;
      } catch (_) {}
    }

    const initialState = {
      ...data.state,
      expiresAt: data.state.expiresAt || defaultExpirationDate(),
      expiredAt: data.state.expiredAt || null
    };
    const defaults = await loadCategoryDefaultsData();

    const budget = {
      id,
      clientName: data.clientName || initialState.clientName || null,
      builder: initialState.builder || null,
      currentState: initialState,
      isCustomized: false,
      sqftLocked: null,
      propertyTypeLocked: null,
      categoryConfig: buildBudgetDefaultSnapshot(defaults),
      customCategories: null,
      createdByEmail
    };

    await saveBudget(budget);
    await addVersion(id, 1, initialState, 'Initial budget', true, buildVersionMeta(req, createdByEmail ? { email: createdByEmail } : null));

    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Create budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.get('/api/budgets/:id', async (req, res) => {
  try {
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const user = await getRequestUser(req, res);
    const isAuthenticatedViewer = !!user;
    if (budget.isExpired && !isAuthenticatedViewer) {
      return res.status(410).json({ error: 'This budget link has expired.', expired: true });
    }

    if (!req.query.admin) {
      // isInternal is true when the viewer is an authenticated admin.
      // Validate the token — cookie presence alone isn't enough (could be
      // stale/invalid). Also treat "viewer is the creator" as internal so
      // the creator doesn't get a notification for viewing their own budget.
      const requestIp = getRequestIp(req);
      const isInternal = isAuthenticatedViewer || isOfficeTeamIp(requestIp);
      touchBudgetPresence(req.params.id, req, isInternal);
      if (req.query.recordView === '1') {
        recordView(req.params.id, requestIp, req.get('User-Agent'), isInternal)
          .catch(err => console.error('recordView error:', err));
      }
    }
    
    res.json({
      id: budget.id,
      clientName: budget.clientName,
      builder: budget.builder,
      created: budget.created,
      lastModified: budget.lastModified,
      currentState: budget.currentState,
      versionCount: budget.versions.length,
      isCustomized: budget.isCustomized,
      sqftLocked: budget.sqftLocked,
      propertyTypeLocked: budget.propertyTypeLocked,
      categoryConfig: budget.categoryConfig,
      customCategories: budget.customCategories,
      expiresAt: budget.expiresAt,
      expiredAt: budget.expiredAt,
      isExpired: budget.isExpired,
      activeBrowserCount: getActiveBudgetBrowsers(budget.id).length
    });
    
  } catch (err) {
    console.error('Get budget error:', err);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

const VERSION_CONSOLIDATION_MS = 15 * 60 * 1000;

app.put('/api/budgets/:id', limits.api, async (req, res) => {
  try {
    const data = schemas.updateBudget.parse(req.body);
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    // Determine viewer identity (validates token, not just presence)
    const user = await getRequestUser(req, res);
    const viewerEmail = user?.email || null;
    if (budget.isExpired && !viewerEmail) {
      return res.status(410).json({ error: 'This budget link has expired.', expired: true });
    }

    data.state = preserveBudgetAccess(data.state, budget.currentState || {});
    
    const now = new Date();
    const nowISO = now.toISOString();
    const lastVersion = budget.versions[budget.versions.length - 1];
    
    const normalizeState = (s) => {
      const { timestamp, ...rest } = s || {};
      return JSON.stringify(rest, Object.keys(rest).sort());
    };
    
    if (normalizeState(lastVersion.state) === normalizeState(data.state)) {
      if (data.pin && !lastVersion.pinned) {
        const { error: pinError } = await supabase
          .from('budget_versions')
          .update({ is_pinned: true, note: data.note || lastVersion.note })
          .eq('budget_id', req.params.id)
          .eq('version_number', lastVersion.version);
        throwSupabaseError(pinError, 'pinVersion');
        return res.json({ success: true, message: 'Version pinned', versionCount: budget.versions.length });
      }
      return res.json({ success: true, message: 'No changes detected', versionCount: budget.versions.length });
    }
    
    const lastVersionTime = new Date(lastVersion.timestamp);
    const timeSinceLastVersion = now - lastVersionTime;
    const shouldConsolidate = !lastVersion.pinned && timeSinceLastVersion < VERSION_CONSOLIDATION_MS;
    
    const isNewVersion = !(shouldConsolidate && !data.pin);
    const versionMeta = buildVersionMeta(req, user);

    if (!isNewVersion) {
      const { error: versionUpdateError } = await supabase
        .from('budget_versions')
        .update({ state: withVersionMeta(data.state, versionMeta), created_at: nowISO })
        .eq('budget_id', req.params.id)
        .eq('version_number', lastVersion.version);
      throwSupabaseError(versionUpdateError, 'updateVersion');
    } else {
      const newVersionNum = budget.versions.length + 1;
      await addVersion(req.params.id, newVersionNum, data.state, data.pin ? (data.note || 'Shared/Emailed') : 'Auto-save', !!data.pin, versionMeta);
    }

    budget.currentState = data.state;
    if (data.state.clientName) budget.clientName = data.state.clientName;
    if (data.state.builder !== undefined) budget.builder = data.state.builder || null;

    // Self-heal: if the budget has no creator on record and an authenticated
    // user is saving, claim them as the creator. Fixes cases where the initial
    // POST happened without a valid token.
    if (!budget.createdByEmail && viewerEmail) {
      budget.createdByEmail = viewerEmail;
      console.log(`Backfilled createdByEmail=${viewerEmail} for budget ${req.params.id}`);
    }

    await saveBudget(budget);

    // Notify budget creator when a client creates a new version.
    // Skip if the saver is the creator themselves (or any authenticated admin).
    if (isNewVersion && budget.createdByEmail && !data.pin) {
      const isCreatorOrAdmin = !!viewerEmail;
      if (!isCreatorOrAdmin) {
        sendChangeNotification(budget, data.state).catch(err =>
          console.error('Change notification failed:', err)
        );
      }
    }
    
    res.json({
      success: true,
      versionCount: shouldConsolidate && !data.pin ? budget.versions.length : budget.versions.length + 1,
      lastModified: nowISO,
      consolidated: shouldConsolidate && !data.pin
    });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Update budget error:', err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

app.get('/api/budgets/:id/poll', limits.api, async (req, res) => {
  try {
    const { data } = await supabase
      .from('budgets')
      .select('modified_at,current_state')
      .eq('id', req.params.id)
      .single();
    if (!data) return res.status(404).json({ error: 'Not found' });
    const user = await getRequestUser(req, res);
    if (getBudgetAccess(data.current_state || {}).isExpired && !user) {
      return res.status(410).json({ error: 'This budget link has expired.', expired: true });
    }
    touchBudgetPresence(req.params.id, req, !!user);
    res.json({ lastModified: data.modified_at, activeBrowserCount: getActiveBudgetBrowsers(req.params.id).length });
  } catch (err) {
    res.status(500).json({ error: 'Poll failed' });
  }
});

app.get('/b/:id', async (req, res) => {
  const { data: budget } = await supabase.from('budgets').select('id').eq('id', req.params.id).single();
  if (!budget) return res.status(404).send('Budget not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// ADMIN API ROUTES
// ============================================================
app.get('/api/admin/budgets', requireAuth, async (req, res) => {
  try {
    res.json(await listBudgets());
  } catch (err) {
    console.error('List budgets error:', err);
    res.status(500).json({ error: 'Failed to list budgets' });
  }
});

app.get('/api/admin/budgets/:id', requireAuth, async (req, res) => {
  const budget = await loadBudget(req.params.id);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  res.json(budget);
});

// Reclassify a single view as internal (team) or external (client)
async function recomputeLastClientActivity(budgetId) {
  const { data } = await supabase
    .from('budget_views')
    .select('viewed_at, ip_address')
    .eq('budget_id', budgetId)
    .eq('is_internal', false)
    .order('viewed_at', { ascending: false })
    .limit(50);
  const lastClientView = (data || []).find(v => !isOfficeTeamIp(v.ip_address));
  const newValue = lastClientView ? lastClientView.viewed_at : null;
  await supabase.from('budgets').update({ last_client_activity_at: newValue }).eq('id', budgetId);
  return newValue;
}

app.patch('/api/admin/budgets/:id/views/:viewId', requireAuth, async (req, res) => {
  try {
    const { data: existingView, error: lookupError } = await supabase
      .from('budget_views')
      .select('ip_address')
      .eq('id', req.params.viewId)
      .eq('budget_id', req.params.id)
      .single();
    if (lookupError) return res.status(400).json({ error: lookupError.message });

    const isInternal = !!req.body.isInternal || isOfficeTeamIp(existingView?.ip_address);
    const { error } = await supabase
      .from('budget_views')
      .update({ is_internal: isInternal })
      .eq('id', req.params.viewId)
      .eq('budget_id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    const lastClientActivity = await recomputeLastClientActivity(req.params.id);
    res.json({ success: true, isInternal, lastClientActivity });
  } catch (err) {
    console.error('Reclassify view error:', err);
    res.status(500).json({ error: 'Failed to reclassify view' });
  }
});

// Update budget CRM metadata (status, notes, follow-up date)
app.patch('/api/admin/budgets/:id/meta', requireAuth, async (req, res) => {
  try {
    const allowedStatus = ['active','won','lost'];
    const update = {};
    if (req.body.status !== undefined) {
      if (!allowedStatus.includes(req.body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      update.status = req.body.status;
      if (req.body.status === 'lost') {
        const budget = await loadBudget(req.params.id);
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        const state = { ...(budget.currentState || {}) };
        state.expiredAt = state.expiredAt || new Date().toISOString();
        if (!state.expiresAt) state.expiresAt = formatDateOnly(new Date());
        update.current_state = state;
        update.modified_at = new Date().toISOString();
      }
    }
    if (req.body.notes !== undefined) update.notes = String(req.body.notes || '').slice(0, 5000);
    if (req.body.followUpDate !== undefined) {
      update.follow_up_date = req.body.followUpDate || null;
    }
    if (req.body.expiresAt !== undefined || req.body.expireNow !== undefined || req.body.clearExpired !== undefined) {
      const budget = await loadBudget(req.params.id);
      if (!budget) return res.status(404).json({ error: 'Budget not found' });
      const state = { ...(update.current_state || budget.currentState || {}) };

      if (req.body.expiresAt !== undefined) {
        const expiresAt = req.body.expiresAt || null;
        if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
          return res.status(400).json({ error: 'Invalid expiration date' });
        }
        state.expiresAt = expiresAt;
        if (expiresAt && !isExpirationDatePast(expiresAt)) state.expiredAt = null;
      }

      if (req.body.expireNow === true) {
        state.expiredAt = new Date().toISOString();
        if (!state.expiresAt) state.expiresAt = formatDateOnly(new Date());
      }

      if (req.body.clearExpired === true) {
        state.expiredAt = null;
        if (!state.expiresAt || state.expiresAt <= formatDateOnly(new Date()) || isExpirationDatePast(state.expiresAt)) {
          state.expiresAt = defaultExpirationDate();
        }
      }

      update.current_state = state;
      update.modified_at = new Date().toISOString();
    }
    if (Object.keys(update).length === 0) return res.json({ success: true });
    const { error } = await supabase.from('budgets').update(update).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    const budget = await loadBudget(req.params.id);
    res.json({ success: true, budget });
  } catch (err) {
    console.error('Update meta error:', err);
    res.status(500).json({ error: 'Failed to update budget meta' });
  }
});

// Update project details that affect the live budget state.
app.patch('/api/admin/budgets/:id/project', requireAuth, async (req, res) => {
  try {
    const data = schemas.updateBudgetProject.parse(req.body);
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const state = { ...(budget.currentState || {}) };
    const oldSqft = Number(budget.sqftLocked || state.homeSize || 4000);
    const oldPropertyType = budget.propertyTypeLocked || state.propertyType || 'residential';
    const newSqft = data.homeSize !== undefined ? data.homeSize : oldSqft;
    const newPropertyType = data.propertyType || oldPropertyType;
    const clientName = data.clientName !== undefined ? (data.clientName || null) : (budget.clientName || state.clientName || null);
    const pricingChanged = newSqft !== oldSqft || newPropertyType !== oldPropertyType;

    if (pricingChanged && !data.pricingMode) {
      return res.status(400).json({ error: 'pricingMode is required when sqft or property type changes' });
    }

    const defaults = await loadCategoryDefaultsData();
    let isCustomized = budget.isCustomized;
    let sqftLocked = budget.sqftLocked;
    let propertyTypeLocked = budget.propertyTypeLocked;
    let categoryConfig = budget.categoryConfig || null;
    const customCategories = budget.customCategories || null;

    if (pricingChanged) {
      const oldCategories = getBudgetDefaultCategoriesFromConfig(categoryConfig || {}, defaults, oldPropertyType);
      const newCategories = getBudgetDefaultCategoriesFromConfig(categoryConfig || {}, defaults, newPropertyType);
      const oldExtras = getBudgetDefaultExtrasFromConfig(categoryConfig || {}, defaults, oldPropertyType);
      const newExtras = getBudgetDefaultExtrasFromConfig(categoryConfig || {}, defaults, newPropertyType);

      if (data.pricingMode === 'preserve') {
        categoryConfig = preserveCategoryPricesAcrossChange(categoryConfig || {}, oldCategories, newCategories, oldSqft, newSqft);
        categoryConfig.__extras = preserveExtraPricesAcrossChange((budget.categoryConfig || {}).__extras || {}, oldExtras, newExtras, oldSqft, newSqft);
        isCustomized = true;
        sqftLocked = newSqft;
        propertyTypeLocked = newPropertyType;
      } else if (isCustomized) {
        categoryConfig = updateNonCustomCategoryPrices(categoryConfig || {}, oldCategories, newCategories, oldSqft, newSqft);
        if ((budget.categoryConfig || {}).__extras) {
          categoryConfig.__extras = updateNonCustomExtraPrices((budget.categoryConfig || {}).__extras || {}, oldExtras, newExtras, oldSqft, newSqft);
        }
        sqftLocked = newSqft;
        propertyTypeLocked = newPropertyType;
      } else {
        sqftLocked = null;
        propertyTypeLocked = null;
      }
    }

    state.clientName = clientName;
    state.homeSize = newSqft;
    state.propertyType = newPropertyType;
    state.total = calculateBudgetTotal(state, defaults, {
      sqft: newSqft,
      propertyType: newPropertyType,
      isCustomized,
      categoryConfig,
      customCategories
    });

    const now = new Date().toISOString();
    const update = {
      client_name: clientName,
      current_state: state,
      is_customized: isCustomized,
      sqft_locked: sqftLocked || null,
      property_type_locked: propertyTypeLocked || null,
      category_config: categoryConfig,
      custom_categories: customCategories,
      modified_at: now
    };

    const { error } = await supabase.from('budgets').update(update).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });

    const versionNum = (budget.versions?.length || 0) + 1;
    const note = pricingChanged
      ? `Admin updated project details (${data.pricingMode === 'preserve' ? 'pricing preserved' : 'standard pricing recalculated'})`
      : 'Admin updated project details';
    await addVersion(req.params.id, versionNum, state, note, true, buildVersionMeta(req, req.user));

    const updatedBudget = await loadBudget(req.params.id);
    res.json({ success: true, budget: updatedBudget });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Update project details error:', err);
    res.status(500).json({ error: 'Failed to update project details' });
  }
});

app.post('/api/admin/budgets/:id/restore/:version', requireAuth, async (req, res) => {
  try {
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const versionNum = parseInt(req.params.version);
    const targetVersion = budget.versions.find(v => v.version === versionNum);
    if (!targetVersion) return res.status(404).json({ error: 'Version not found' });
    
    const restoredState = preserveBudgetAccess(targetVersion.state, budget.currentState || {});
    const newVersionNum = budget.versions.length + 1;
    await addVersion(req.params.id, newVersionNum, restoredState, `Restored to version ${versionNum}`, true, buildVersionMeta(req, req.user));
    
    const { error: restoreError } = await supabase
      .from('budgets')
      .update({ current_state: restoredState, modified_at: new Date().toISOString() })
      .eq('id', req.params.id);
    throwSupabaseError(restoreError, 'restoreBudget');
    
    res.json({ success: true, newVersion: newVersionNum });
    
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

app.delete('/api/admin/budgets/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { error: viewsDeleteError } = await supabase.from('budget_views').delete().eq('budget_id', id);
    throwSupabaseError(viewsDeleteError, 'deleteBudgetViews');
    const { error: versionsDeleteError } = await supabase.from('budget_versions').delete().eq('budget_id', id);
    throwSupabaseError(versionsDeleteError, 'deleteBudgetVersions');
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete budget error:', err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

app.post('/api/admin/budgets', requireAuth, async (req, res) => {
  try {
    const { clientName, builder, homeSize, propertyType } = req.body;
    if (!homeSize || !propertyType) {
      return res.status(400).json({ error: 'homeSize and propertyType are required' });
    }
    
    let id;
    let exists;
    do {
      id = generateCode(8);
      const { data: check } = await supabase.from('budgets').select('id').eq('id', id).single();
      exists = !!check;
    } while (exists);
    
    const state = {
      selections: {}, extras: {}, modifiers: [], catMods: {},
      homeSize: parseInt(homeSize), propertyType,
      clientName: clientName || null, total: 0,
      expiresAt: defaultExpirationDate(),
      expiredAt: null
    };
    const defaults = await loadCategoryDefaultsData();
    
    const budget = {
      id,
      clientName: clientName || null,
      builder: builder || null,
      currentState: state,
      isCustomized: false,
      categoryConfig: buildBudgetDefaultSnapshot(defaults)
    };
    await saveBudget(budget);
    await addVersion(id, 1, state, 'Initial blank budget', true, buildVersionMeta(req, req.user));
    
    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    console.error('Create admin budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.post('/api/admin/budgets/:id/clone', requireAuth, async (req, res) => {
  try {
    const data = schemas.cloneBudget.parse(req.body || {});
    const source = await loadBudget(req.params.id);
    if (!source) return res.status(404).json({ error: 'Budget not found' });

    let id;
    let exists;
    do {
      id = generateCode(8);
      const { data: check } = await supabase.from('budgets').select('id').eq('id', id).single();
      exists = !!check;
    } while (exists);

    const state = deepClone(source.currentState || {});
    const clientName = data.clientName !== undefined
      ? (data.clientName || null)
      : `${source.clientName || state.clientName || 'Unnamed Budget'} Copy`;
    state.clientName = clientName;
    state.expiresAt = defaultExpirationDate();
    state.expiredAt = null;

    const budget = {
      id,
      clientName,
      builder: source.builder || state.builder || null,
      currentState: state,
      isCustomized: source.isCustomized,
      sqftLocked: source.sqftLocked || null,
      propertyTypeLocked: source.propertyTypeLocked || null,
      categoryConfig: normalizeCategoryConfigPayload(deepClone(source.categoryConfig || null)),
      customCategories: source.customCategories ? normalizeCustomCategoriesPayload(source.customCategories) : null,
      createdByEmail: req.user.email
    };

    await saveBudget(budget);
    await addVersion(id, 1, state, `Cloned from ${source.clientName || source.id}`, true, buildVersionMeta(req, req.user));

    const cloned = await loadBudget(id);
    res.json({ success: true, id, url: `/b/${id}`, budget: cloned });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Clone budget error:', err);
    res.status(500).json({ error: 'Failed to clone budget' });
  }
});

app.put('/api/admin/budgets/:id/customize', requireAuth, async (req, res) => {
  try {
    const data = schemas.customizeBudget.parse(req.body);
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const now = new Date().toISOString();
    const currentState = budget.currentState || budget.versions[budget.versions.length - 1]?.state || {};
    const sqftLocked = budget.currentState?.homeSize || budget.versions[0]?.state?.homeSize;
    const propertyTypeLocked = budget.currentState?.propertyType || budget.versions[0]?.state?.propertyType;
    const defaults = await loadCategoryDefaultsData();
    const baseCategoryConfig = normalizeCategoryConfigPayload({
      ...buildBudgetDefaultSnapshot(defaults),
      ...(budget.categoryConfig || {})
    });
    const categoryConfig = mergeCategoryConfigPayload(baseCategoryConfig, data.categoryConfig);
    const customCategories = mergeCustomCategoriesPayload(budget.customCategories || [], data.customCategories);
    currentState.total = calculateBudgetTotal(currentState, defaults, {
      sqft: sqftLocked,
      propertyType: propertyTypeLocked,
      isCustomized: true,
      categoryConfig,
      customCategories
    });
    
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        is_customized: true,
        customized_at: now,
        sqft_locked: sqftLocked,
        property_type_locked: propertyTypeLocked,
        current_state: currentState,
        category_config: categoryConfig,
        custom_categories: customCategories.length ? customCategories : null,
        modified_at: now
      })
      .eq('id', req.params.id);
    throwSupabaseError(updateError, 'customizeBudget');

    const nextVersionNum = (budget.versions?.length || 0) + 1;
    await addVersion(req.params.id, nextVersionNum, currentState, 'Customization applied', true, buildVersionMeta(req, req.user));

    res.json({ success: true, message: 'Budget customized successfully', newVersion: nextVersionNum });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Customize budget error:', err);
    res.status(500).json({ error: 'Failed to customize budget' });
  }
});

// ============================================================
// SHORT LINKS API
// ============================================================
app.post('/api/shorten', limits.api, async (req, res) => {
  try {
    const data = schemas.createLink.parse(req.body);
    
    let code = data.customCode?.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    if (code) {
      const { data: existing } = await supabase.from('short_links').select('code').eq('code', code).single();
      if (existing) return res.status(400).json({ error: 'Custom code already in use' });
    } else {
      let exists;
      do {
        code = generateCode();
        const { data: check } = await supabase.from('short_links').select('code').eq('code', code).single();
        exists = !!check;
      } while (exists);
    }
    
    await supabase
      .from('short_links')
      .insert({ code, config: data.config, client_name: data.clientName || null });
    
    res.json({ success: true, code, shortUrl: `/s/${code}` });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.issues || err.errors });
    }
    console.error('Shorten error:', err);
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

app.get('/api/links', requireAuth, async (req, res) => {
  try {
    const { data: links, error } = await supabase
      .from('short_links')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json((links || []).map(l => ({
      code: l.code, shortUrl: `/s/${l.code}`, config: l.config,
      clientName: l.client_name, created: l.created_at,
      lastAccessed: l.last_accessed_at, accessCount: l.access_count
    })));
  } catch (err) {
    console.error('List links error:', err);
    res.status(500).json({ error: 'Failed to list links' });
  }
});

// ============================================================
// EMAIL API
// ============================================================
app.post('/api/send-proposal', limits.email, async (req, res) => {
  try {
    const data = schemas.sendEmail.parse(req.body);
    
    const emailHtml = data.htmlContent || buildProposalEmail(data.proposalData, data.recipientName);
    
    const { data: sendData, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.recipientEmail,
      subject: data.subject || 'Your Technology Budget from Gamma Tech',
      html: emailHtml
    });
    
    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
    
    console.log(`Email sent to ${data.recipientEmail}. ID: ${sendData.id}`);
    res.json({ success: true, messageId: sendData.id });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

function buildProposalEmail(data, recipientName) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
  const rowStyle = 'padding:12px 16px;border-bottom:1px solid #E0E0E0';

  let tableRows = '';
  if (data.categories?.length) {
    data.categories.forEach(cat => {
      if (cat.tier && cat.tier !== 'none') {
        tableRows += `<tr><td style="${rowStyle};font-weight:500">${cat.name}</td><td style="${rowStyle};text-transform:capitalize">${cat.tier}</td><td style="${rowStyle};text-align:right">${formatCurrency(cat.price)}</td></tr>`;
      }
    });
  }

  // Per-category adjustments
  if (data.catMods?.length) {
    data.catMods.forEach(m => {
      tableRows += `<tr><td style="${rowStyle};font-weight:500;color:#5A5A5A">&nbsp;&nbsp;↳ ${m.categoryName}: ${m.name}</td><td style="${rowStyle}"></td><td style="${rowStyle};text-align:right;color:${m.amount >= 0 ? '#2E7D32' : '#C62828'}">${m.amount >= 0 ? '+' : ''}${formatCurrency(m.amount)}</td></tr>`;
    });
  }

  // Extras / add-ons
  if (data.extras?.length) {
    tableRows += `<tr><td colspan="3" style="${rowStyle};font-weight:600;background:#F9F9F9;color:#393939">Add-Ons</td></tr>`;
    data.extras.forEach(e => {
      tableRows += `<tr><td style="${rowStyle};font-weight:500">${e.name}</td><td style="${rowStyle}"></td><td style="${rowStyle};text-align:right">${formatCurrency(e.price)}</td></tr>`;
    });
  }

  // Custom line items
  if (data.modifiers?.length) {
    tableRows += `<tr><td colspan="3" style="${rowStyle};font-weight:600;background:#F9F9F9;color:#393939">Custom Items</td></tr>`;
    data.modifiers.forEach(m => {
      tableRows += `<tr><td style="${rowStyle};font-weight:500">${m.name}</td><td style="${rowStyle}"></td><td style="${rowStyle};text-align:right;color:${m.amount >= 0 ? '#2E7D32' : '#C62828'}">${m.amount >= 0 ? '+' : ''}${formatCurrency(m.amount)}</td></tr>`;
    });
  }

  // Subtotal + tax breakdown
  let totalsHtml = '';
  if (data.subtotal && data.tax) {
    totalsHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="padding:8px 16px;text-align:right;color:#5A5A5A">Subtotal:</td><td style="padding:8px 16px;text-align:right;width:120px;font-weight:500">${formatCurrency(data.subtotal)}</td></tr><tr><td style="padding:8px 16px;text-align:right;color:#5A5A5A">Tax (6%):</td><td style="padding:8px 16px;text-align:right;width:120px;font-weight:500">${formatCurrency(data.tax)}</td></tr></table>`;
  }

  const tableHtml = tableRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0E0E0;border-radius:12px;overflow:hidden;margin-bottom:16px"><tr style="background:#F5F5F5"><th style="padding:14px 16px;text-align:left;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Category</th><th style="padding:14px 16px;text-align:left;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Tier</th><th style="padding:14px 16px;text-align:right;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Estimate</th></tr>${tableRows}</table>${totalsHtml}` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 20px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;box-shadow:0 2px 16px rgba(15,47,68,0.06);overflow:hidden"><tr><td style="background:linear-gradient(135deg,#0F2F44 0%,#133F5C 100%);padding:32px 40px;text-align:center"><h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:600">Gamma Tech Services</h1><p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Residential Technology Budget</p></td></tr><tr><td style="padding:40px"><p style="margin:0 0 24px;color:#393939;font-size:16px;line-height:1.6">${greeting}</p><p style="margin:0 0 32px;color:#393939;font-size:16px;line-height:1.6">Thank you for your interest in Gamma Tech Services. Below is your personalized technology budget.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EEF8FE 0%,#E8F1F8 100%);border-radius:12px;margin-bottom:32px"><tr><td style="padding:24px;text-align:center"><p style="margin:0;color:#5A5A5A;font-size:14px;text-transform:uppercase;letter-spacing:1px">Estimated Investment</p><p style="margin:8px 0 0;color:#0F2F44;font-size:36px;font-weight:700">${formatCurrency(data.total)}</p>${data.tierLabel ? `<p style="margin:8px 0 0;color:#017ED7;font-size:14px;font-weight:500">${data.tierLabel}</p>` : ''}</td></tr></table>${tableHtml}${data.budgetUrl ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center"><a href="${data.budgetUrl}" style="display:inline-block;background:#017ED7;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View & Customize Your Budget</a></td></tr></table>` : ''}<p style="margin:0 0 16px;color:#5A5A5A;font-size:14px;line-height:1.6">This is a preliminary budget estimate. Final pricing may vary based on site conditions and requirements.</p><p style="margin:0;color:#393939;font-size:16px;line-height:1.6">Ready to move forward? Reply to this email or call us at <strong>(239) 330-4939</strong>.</p></td></tr><tr><td style="background:#F5F5F5;padding:24px 40px;text-align:center;border-top:1px solid #E0E0E0"><p style="margin:0;color:#5A5A5A;font-size:14px"><strong>Gamma Tech Services</strong><br>3106 Horseshoe Dr S, Naples, FL 34104<br>(239) 330-4939 • gamma.tech</p></td></tr></table></td></tr></table></body></html>`;
}

// ============================================================
// STATIC FILES
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('budgets').select('id').limit(1);
    res.json({ 
      status: error ? 'degraded' : 'ok', 
      timestamp: new Date().toISOString(),
      services: { database: !error, email: !!process.env.RESEND_API_KEY }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

app.post('/api/debug', (req, res) => {
  console.log('[FRONTEND DEBUG]', JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// ============================================================
// ERROR HANDLERS
// ============================================================
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    const issues = err.issues || err.errors || [];
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: issues.map(e => `${e.path.join('.')}: ${e.message}`)
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`Budget Planner server running on http://localhost:${PORT}`);
  console.log(`Email from: ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`Supabase: ${process.env.SUPABASE_URL}`);
});
