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
function generateCode(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Extract Supabase auth token from request
function getToken(req) {
  // Check cookie first, then Authorization header
  if (req.cookies.sb_token) return req.cookies.sb_token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Budget functions
async function loadBudget(id) {
  const { data: budget, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !budget) return null;
  
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
  
  return {
    id: budget.id,
    clientName: budget.client_name,
    builder: budget.builder,
    created: budget.created_at,
    lastModified: budget.modified_at,
    views: views || [],
    versions: (versions || []).map(v => ({
      version: v.version_number,
      timestamp: v.created_at,
      state: v.state, // JSONB, no parse needed
      note: v.note,
      pinned: !!v.is_pinned
    })),
    currentState: budget.current_state, // JSONB, no parse needed
    isCustomized: !!budget.is_customized,
    sqftLocked: budget.sqft_locked,
    propertyTypeLocked: budget.property_type_locked,
    categoryConfig: budget.category_config, // JSONB
    customCategories: budget.custom_categories // JSONB
  };
}

async function saveBudget(budget) {
  const { error } = await supabase
    .from('budgets')
    .upsert({
      id: budget.id,
      client_name: budget.clientName || null,
      builder: budget.builder || null,
      modified_at: new Date().toISOString(),
      current_state: budget.currentState, // JSONB, no stringify needed
      is_customized: !!budget.isCustomized,
      sqft_locked: budget.sqftLocked || null,
      property_type_locked: budget.propertyTypeLocked || null,
      category_config: budget.categoryConfig || null, // JSONB
      custom_categories: budget.customCategories || null // JSONB
    });
  
  if (error) console.error('saveBudget error:', error);
}

async function listBudgets() {
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('id, client_name, builder, created_at, modified_at, views_count, last_viewed_at, is_customized, sqft_locked, property_type_locked, current_state')
    .order('modified_at', { ascending: false });
  
  if (error) { console.error('listBudgets error:', error); return []; }
  
  // Get version counts
  const ids = budgets.map(b => b.id);
  const { data: versionCounts } = await supabase
    .rpc('get_version_counts', { budget_ids: ids })
    .catch(() => ({ data: null }));
  
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
  
  return budgets.map(b => ({
    id: b.id,
    clientName: b.client_name,
    builder: b.builder,
    created: b.created_at,
    lastModified: b.modified_at,
    viewCount: b.views_count || 0,
    lastViewed: b.last_viewed_at,
    versionCount: vcMap[b.id] || 0,
    currentTotal: b.current_state?.total || 0,
    isCustomized: !!b.is_customized,
    sqftLocked: b.sqft_locked,
    propertyTypeLocked: b.property_type_locked
  }));
}

async function recordView(budgetId, ip, userAgent) {
  await supabase
    .from('budget_views')
    .insert({ budget_id: budgetId, ip_address: ip || null, user_agent: userAgent || null });
  
  await supabase
    .from('budgets')
    .update({ views_count: supabase.rpc ? undefined : undefined, last_viewed_at: new Date().toISOString() })
    .eq('id', budgetId);
  
  // Increment views_count via raw update
  await supabase.rpc('increment_views', { bid: budgetId }).catch(async () => {
    // Fallback: read and write
    const { data } = await supabase.from('budgets').select('views_count').eq('id', budgetId).single();
    if (data) {
      await supabase.from('budgets').update({ views_count: (data.views_count || 0) + 1, last_viewed_at: new Date().toISOString() }).eq('id', budgetId);
    }
  });
}

async function addVersion(budgetId, versionNum, state, note, isPinned) {
  const { error } = await supabase
    .from('budget_versions')
    .insert({
      budget_id: budgetId,
      version_number: versionNum,
      state: state, // JSONB
      note: note || '',
      is_pinned: !!isPinned
    });
  
  if (error) console.error('addVersion error:', error);
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  
  req.user = user;
  next();
}

// ============================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================
const schemas = {
  login: z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(100)
  }),

  forgotPassword: z.object({
    email: z.string().email().max(254)
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
  return {
    residential_categories: sandbox.RESIDENTIAL_CATEGORIES,
    residential_extras: sandbox.RESIDENTIAL_EXTRAS,
    condo_categories: sandbox.CONDO_CATEGORIES,
    condo_extras: sandbox.CONDO_EXTRAS,
    base_sqft: 4000
  };
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

// Seed on startup (non-blocking)
seedCategoryDefaults();

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
    res.json({
      residential_categories: data.residential_categories,
      residential_extras: data.residential_extras,
      condo_categories: data.condo_categories,
      condo_extras: data.condo_extras,
      base_sqft: data.base_sqft
    });
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
    res.json({ ...data, source: 'database' });
  } catch (err) {
    console.error('GET /api/admin/categories error:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

app.put('/api/admin/categories', requireAuth, async (req, res) => {
  try {
    const { residential_categories, residential_extras, condo_categories, condo_extras, base_sqft } = req.body;
    if (!residential_categories || !condo_categories) {
      return res.status(400).json({ error: 'Missing required category data' });
    }
    const { error } = await supabase.from('category_defaults').upsert({
      id: 'current',
      residential_categories,
      residential_extras: residential_extras || [],
      condo_categories,
      condo_extras: condo_extras || [],
      base_sqft: base_sqft || 4000,
      updated_at: new Date().toISOString(),
      updated_by: req.user.email
    });
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
    const { error } = await supabase.from('category_defaults').upsert({
      id: 'current',
      ...staticData,
      updated_at: new Date().toISOString(),
      updated_by: req.user.email + ' (reset)'
    });
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
    const { email, password } = schemas.login.parse(req.body);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = data.session.access_token;
    
    res.cookie('sb_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
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
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
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

app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie('sb_token');
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ authenticated: false });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.json({ authenticated: false });
  
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
    
    const budget = {
      id,
      clientName: data.clientName || data.state.clientName || null,
      currentState: data.state,
      isCustomized: false,
      sqftLocked: null,
      propertyTypeLocked: null,
      categoryConfig: null,
      customCategories: null
    };
    
    await saveBudget(budget);
    await addVersion(id, 1, data.state, 'Initial budget', true);
    
    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Create budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.get('/api/budgets/:id', async (req, res) => {
  try {
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    if (!req.query.admin) {
      recordView(req.params.id, req.ip, req.get('User-Agent'));
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
      customCategories: budget.customCategories
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
    
    const now = new Date();
    const nowISO = now.toISOString();
    const lastVersion = budget.versions[budget.versions.length - 1];
    
    const normalizeState = (s) => {
      const { timestamp, ...rest } = s || {};
      return JSON.stringify(rest, Object.keys(rest).sort());
    };
    
    if (normalizeState(lastVersion.state) === normalizeState(data.state)) {
      if (data.pin && !lastVersion.pinned) {
        await supabase
          .from('budget_versions')
          .update({ is_pinned: true, note: data.note || lastVersion.note })
          .eq('budget_id', req.params.id)
          .eq('version_number', lastVersion.version);
        return res.json({ success: true, message: 'Version pinned', versionCount: budget.versions.length });
      }
      return res.json({ success: true, message: 'No changes detected', versionCount: budget.versions.length });
    }
    
    const lastVersionTime = new Date(lastVersion.timestamp);
    const timeSinceLastVersion = now - lastVersionTime;
    const shouldConsolidate = !lastVersion.pinned && timeSinceLastVersion < VERSION_CONSOLIDATION_MS;
    
    if (shouldConsolidate && !data.pin) {
      await supabase
        .from('budget_versions')
        .update({ state: data.state, created_at: nowISO })
        .eq('budget_id', req.params.id)
        .eq('version_number', lastVersion.version);
    } else {
      const newVersionNum = budget.versions.length + 1;
      await addVersion(req.params.id, newVersionNum, data.state, data.pin ? (data.note || 'Shared/Emailed') : 'Auto-save', !!data.pin);
    }
    
    budget.currentState = data.state;
    if (data.state.clientName) budget.clientName = data.state.clientName;
    await saveBudget(budget);
    
    res.json({
      success: true,
      versionCount: shouldConsolidate && !data.pin ? budget.versions.length : budget.versions.length + 1,
      lastModified: nowISO,
      consolidated: shouldConsolidate && !data.pin
    });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Update budget error:', err);
    res.status(500).json({ error: 'Failed to update budget' });
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

app.post('/api/admin/budgets/:id/restore/:version', requireAuth, async (req, res) => {
  try {
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const versionNum = parseInt(req.params.version);
    const targetVersion = budget.versions.find(v => v.version === versionNum);
    if (!targetVersion) return res.status(404).json({ error: 'Version not found' });
    
    const newVersionNum = budget.versions.length + 1;
    await addVersion(req.params.id, newVersionNum, targetVersion.state, `Restored to version ${versionNum}`, true);
    
    await supabase
      .from('budgets')
      .update({ current_state: targetVersion.state, modified_at: new Date().toISOString() })
      .eq('id', req.params.id);
    
    res.json({ success: true, newVersion: newVersionNum });
    
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

app.delete('/api/admin/budgets/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('budgets').delete().eq('id', req.params.id);
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
      clientName: clientName || null, total: 0
    };
    
    const budget = { id, clientName: clientName || null, builder: builder || null, currentState: state };
    await saveBudget(budget);
    await addVersion(id, 1, state, 'Initial blank budget', true);
    
    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    console.error('Create admin budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.put('/api/admin/budgets/:id/customize', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const budget = await loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const now = new Date().toISOString();
    
    await supabase
      .from('budgets')
      .update({
        is_customized: true,
        customized_at: now,
        sqft_locked: budget.currentState?.homeSize || budget.versions[0]?.state?.homeSize,
        property_type_locked: budget.currentState?.propertyType || budget.versions[0]?.state?.propertyType,
        category_config: data.categoryConfig || null,
        custom_categories: data.customCategories || null,
        modified_at: now
      })
      .eq('id', req.params.id);
    
    // Wipe versions and create fresh one
    await supabase.from('budget_versions').delete().eq('budget_id', req.params.id);
    const currentState = budget.currentState || budget.versions[budget.versions.length - 1]?.state;
    await addVersion(req.params.id, 1, currentState, 'Customization applied', true);
    
    res.json({ success: true, message: 'Budget customized successfully', versionsWiped: true });
    
  } catch (err) {
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
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
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
  
  let categoryRows = '';
  if (data.categories?.length) {
    data.categories.forEach(cat => {
      if (cat.tier && cat.tier !== 'none') {
        categoryRows += `<tr><td style="padding:12px 16px;border-bottom:1px solid #E0E0E0;font-weight:500">${cat.name}</td><td style="padding:12px 16px;border-bottom:1px solid #E0E0E0;text-transform:capitalize">${cat.tier}</td><td style="padding:12px 16px;border-bottom:1px solid #E0E0E0;text-align:right">${formatCurrency(cat.price)}</td></tr>`;
      }
    });
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 20px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;box-shadow:0 2px 16px rgba(15,47,68,0.06);overflow:hidden"><tr><td style="background:linear-gradient(135deg,#0F2F44 0%,#133F5C 100%);padding:32px 40px;text-align:center"><h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:600">Gamma Tech Services</h1><p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Residential Technology Budget</p></td></tr><tr><td style="padding:40px"><p style="margin:0 0 24px;color:#393939;font-size:16px;line-height:1.6">${greeting}</p><p style="margin:0 0 32px;color:#393939;font-size:16px;line-height:1.6">Thank you for your interest in Gamma Tech Services. Below is your personalized technology budget.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EEF8FE 0%,#E8F1F8 100%);border-radius:12px;margin-bottom:32px"><tr><td style="padding:24px;text-align:center"><p style="margin:0;color:#5A5A5A;font-size:14px;text-transform:uppercase;letter-spacing:1px">Estimated Investment</p><p style="margin:8px 0 0;color:#0F2F44;font-size:36px;font-weight:700">${formatCurrency(data.total)}</p>${data.tierLabel ? `<p style="margin:8px 0 0;color:#017ED7;font-size:14px;font-weight:500">${data.tierLabel}</p>` : ''}</td></tr></table>${categoryRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0E0E0;border-radius:12px;overflow:hidden;margin-bottom:32px"><tr style="background:#F5F5F5"><th style="padding:14px 16px;text-align:left;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Category</th><th style="padding:14px 16px;text-align:left;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Tier</th><th style="padding:14px 16px;text-align:right;font-weight:600;color:#393939;border-bottom:1px solid #E0E0E0">Estimate</th></tr>${categoryRows}</table>` : ''}${data.budgetUrl ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center"><a href="${data.budgetUrl}" style="display:inline-block;background:#017ED7;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View & Customize Your Budget</a></td></tr></table>` : ''}<p style="margin:0 0 16px;color:#5A5A5A;font-size:14px;line-height:1.6">This is a preliminary budget estimate. Final pricing may vary based on site conditions and requirements.</p><p style="margin:0;color:#393939;font-size:16px;line-height:1.6">Ready to move forward? Reply to this email or call us at <strong>(239) 330-4939</strong>.</p></td></tr><tr><td style="background:#F5F5F5;padding:24px 40px;text-align:center;border-top:1px solid #E0E0E0"><p style="margin:0;color:#5A5A5A;font-size:14px"><strong>Gamma Tech Services</strong><br>3106 Horseshoe Dr S, Naples, FL 34116<br>(239) 330-4939 • gamma.tech</p></td></tr></table></td></tr></table></body></html>`;
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
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`)
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
