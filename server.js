require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const Database = require('better-sqlite3');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 3000;

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'BudgetPlanner@gamma.tech';
const FROM_NAME = 'Gamma Tech Budget Planner';

// ============================================================
// DATABASE SETUP (SQLite with better-sqlite3)
// ============================================================
const DB_PATH = path.join(__dirname, 'data', 'app.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    client_name TEXT,
    builder TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    views_count INTEGER DEFAULT 0,
    last_viewed_at DATETIME,
    current_state JSON,
    is_customized INTEGER DEFAULT 0,
    sqft_locked INTEGER,
    property_type_locked TEXT,
    category_config JSON,
    custom_categories JSON,
    customized_at TEXT
  );

  CREATE TABLE IF NOT EXISTS budget_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
    version_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    state JSON,
    note TEXT,
    is_pinned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS budget_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS short_links (
    code TEXT PRIMARY KEY,
    config TEXT NOT NULL,
    client_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME,
    access_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_budgets_modified ON budgets(modified_at DESC);
  CREATE INDEX IF NOT EXISTS idx_versions_budget ON budget_versions(budget_id);
  CREATE INDEX IF NOT EXISTS idx_views_budget ON budget_views(budget_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

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

// Session secret from env
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

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

// Budget functions
function loadBudget(id) {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
  if (!budget) return null;
  
  return {
    id: budget.id,
    clientName: budget.client_name,
    builder: budget.builder,
    created: budget.created_at,
    lastModified: budget.modified_at,
    views: db.prepare('SELECT * FROM budget_views WHERE budget_id = ? ORDER BY viewed_at DESC').all(id),
    versions: db.prepare('SELECT * FROM budget_versions WHERE budget_id = ? ORDER BY version_number ASC').all(id).map(v => ({
      version: v.version_number,
      timestamp: v.created_at,
      state: JSON.parse(v.state),
      note: v.note,
      pinned: !!v.is_pinned
    })),
    currentState: JSON.parse(budget.current_state),
    isCustomized: !!budget.is_customized,
    sqftLocked: budget.sqft_locked,
    propertyTypeLocked: budget.property_type_locked,
    categoryConfig: budget.category_config ? JSON.parse(budget.category_config) : null,
    customCategories: budget.custom_categories ? JSON.parse(budget.custom_categories) : null
  };
}

function saveBudget(budget) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO budgets 
    (id, client_name, builder, modified_at, current_state, is_customized, sqft_locked, property_type_locked, category_config, custom_categories)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    budget.id,
    budget.clientName || null,
    budget.builder || null,
    JSON.stringify(budget.currentState),
    budget.isCustomized ? 1 : 0,
    budget.sqftLocked || null,
    budget.propertyTypeLocked || null,
    budget.categoryConfig ? JSON.stringify(budget.categoryConfig) : null,
    budget.customCategories ? JSON.stringify(budget.customCategories) : null
  );
}

function listBudgets() {
  const budgets = db.prepare(`
    SELECT id, client_name, builder, created_at, modified_at, 
           views_count, last_viewed_at, 
           (SELECT COUNT(*) FROM budget_versions WHERE budget_id = budgets.id) as version_count,
           json_extract(current_state, '$.total') as current_total,
           is_customized, sqft_locked, property_type_locked
    FROM budgets 
    ORDER BY modified_at DESC
  `).all();
  
  return budgets.map(b => ({
    id: b.id,
    clientName: b.client_name,
    builder: b.builder,
    created: b.created_at,
    lastModified: b.modified_at,
    viewCount: b.views_count,
    lastViewed: b.last_viewed_at,
    versionCount: b.version_count,
    currentTotal: b.current_total || 0,
    isCustomized: !!b.is_customized,
    sqftLocked: b.sqft_locked,
    propertyTypeLocked: b.property_type_locked
  }));
}

function recordView(budgetId, ip, userAgent) {
  db.prepare('INSERT INTO budget_views (budget_id, ip_address, user_agent) VALUES (?, ?, ?)')
    .run(budgetId, ip || null, userAgent || null);
  
  db.prepare(`
    UPDATE budgets 
    SET views_count = views_count + 1, last_viewed_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(budgetId);
}

function addVersion(budgetId, versionNum, state, note, isPinned) {
  db.prepare(`
    INSERT INTO budget_versions (budget_id, version_number, state, note, is_pinned)
    VALUES (?, ?, ?, ?, ?)
  `).run(budgetId, versionNum, JSON.stringify(state), note || '', isPinned ? 1 : 0);
}

// User functions
function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

function saveUser(user) {
  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, name, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(user.id, user.username, user.name, user.passwordHash);
}

// Session functions
function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, userId, expiresAt);
  
  return sessionId;
}

function validateSession(sessionId) {
  if (!sessionId) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return db.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(sessionId);
}

function destroySession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  const sessionId = req.cookies.session;
  const session = validateSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.user = user;
  next();
}

// ============================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================
const schemas = {
  login: z.object({
    username: z.string().min(1).max(50),
    password: z.string().min(1).max(100)
  }),
  
  createUser: z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8).max(100),
    name: z.string().min(1).max(100)
  }),
  
  updateUser: z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
    password: z.string().min(8).max(100).optional(),
    name: z.string().min(1).max(100).optional()
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

  customizeBudget: z.object({
    categoryConfig: z.record(z.any()).optional(),
    customCategories: z.array(z.any()).optional()
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
// SHORT LINK ROUTES
// ============================================================
app.get('/s/:code', (req, res) => {
  const link = db.prepare('SELECT * FROM short_links WHERE code = ?').get(req.params.code);
  
  if (link) {
    db.prepare(`UPDATE short_links SET last_accessed_at = CURRENT_TIMESTAMP, access_count = access_count + 1 WHERE code = ?`).run(req.params.code);
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
    const { username, password } = schemas.login.parse(req.body);
    const user = getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const sessionId = createSession(user.id);
    
    res.cookie('session', sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, name: user.name } 
    });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.cookies.session;
  if (sessionId) destroySession(sessionId);
  res.clearCookie('session');
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const sessionId = req.cookies.session;
  const session = validateSession(sessionId);
  
  if (!session) {
    return res.json({ authenticated: false });
  }
  
  const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.json({ authenticated: false });
  
  res.json({ authenticated: true, user });
});

app.post('/api/auth/users', async (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    if (userCount > 0) {
      const sessionId = req.cookies.session;
      if (!validateSession(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    const data = schemas.createUser.parse(req.body);
    const existing = getUserByUsername(data.username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = {
      id: crypto.randomUUID(),
      username: data.username,
      name: data.name,
      passwordHash
    };
    
    saveUser(user);
    
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, name: user.name } 
    });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
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
      exists = db.prepare('SELECT 1 FROM budgets WHERE id = ?').get(id);
    } while (exists);
    
    const now = new Date().toISOString();
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
    
    saveBudget(budget);
    addVersion(id, 1, data.state, 'Initial budget', true);
    
    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Create budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.get('/api/budgets/:id', (req, res) => {
  try {
    const budget = loadBudget(req.params.id);
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
    const budget = loadBudget(req.params.id);
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
        db.prepare('UPDATE budget_versions SET is_pinned = 1, note = ? WHERE budget_id = ? AND version_number = ?')
          .run(data.note || lastVersion.note, req.params.id, lastVersion.version);
        return res.json({ success: true, message: 'Version pinned', versionCount: budget.versions.length });
      }
      return res.json({ success: true, message: 'No changes detected', versionCount: budget.versions.length });
    }
    
    const lastVersionTime = new Date(lastVersion.timestamp);
    const timeSinceLastVersion = now - lastVersionTime;
    const shouldConsolidate = !lastVersion.pinned && timeSinceLastVersion < VERSION_CONSOLIDATION_MS;
    
    if (shouldConsolidate && !data.pin) {
      db.prepare('UPDATE budget_versions SET state = ?, created_at = ? WHERE budget_id = ? AND version_number = ?')
        .run(JSON.stringify(data.state), nowISO, req.params.id, lastVersion.version);
    } else {
      const newVersionNum = budget.versions.length + 1;
      addVersion(req.params.id, newVersionNum, data.state, data.pin ? (data.note || 'Shared/Emailed') : 'Auto-save', !!data.pin);
    }
    
    budget.currentState = data.state;
    if (data.state.clientName) budget.clientName = data.state.clientName;
    saveBudget(budget);
    
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

app.get('/b/:id', (req, res) => {
  const budget = db.prepare('SELECT 1 FROM budgets WHERE id = ?').get(req.params.id);
  if (!budget) return res.status(404).send('Budget not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// ADMIN API ROUTES
// ============================================================
app.get('/api/admin/budgets', requireAuth, (req, res) => {
  try {
    res.json(listBudgets());
  } catch (err) {
    console.error('List budgets error:', err);
    res.status(500).json({ error: 'Failed to list budgets' });
  }
});

app.get('/api/admin/budgets/:id', requireAuth, (req, res) => {
  const budget = loadBudget(req.params.id);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  res.json(budget);
});

app.post('/api/admin/budgets/:id/restore/:version', requireAuth, async (req, res) => {
  try {
    const budget = loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const versionNum = parseInt(req.params.version);
    const targetVersion = budget.versions.find(v => v.version === versionNum);
    if (!targetVersion) return res.status(404).json({ error: 'Version not found' });
    
    const newVersionNum = budget.versions.length + 1;
    addVersion(req.params.id, newVersionNum, targetVersion.state, `Restored to version ${versionNum}`, true);
    
    db.prepare("UPDATE budgets SET current_state = ?, modified_at = datetime('now') WHERE id = ?")    
      .run(JSON.stringify(targetVersion.state), req.params.id);
    
    res.json({ success: true, newVersion: newVersionNum });
    
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

app.delete('/api/admin/budgets/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Budget not found' });
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
      exists = db.prepare('SELECT 1 FROM budgets WHERE id = ?').get(id);
    } while (exists);
    
    const now = new Date().toISOString();
    const state = {
      selections: {}, extras: {}, modifiers: [], catMods: {},
      homeSize: parseInt(homeSize), propertyType,
      clientName: clientName || null, total: 0
    };
    
    const budget = { id, clientName: clientName || null, builder: builder || null, currentState: state };
    saveBudget(budget);
    addVersion(id, 1, state, 'Initial blank budget', true);
    
    res.json({ success: true, id, url: `/b/${id}` });
    
  } catch (err) {
    console.error('Create admin budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.put('/api/admin/budgets/:id/customize', requireAuth, async (req, res) => {
  try {
    const data = req.body; // Skip Zod validation - admin-only endpoint
    const budget = loadBudget(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE budgets SET
        is_customized = 1, customized_at = ?,
        sqft_locked = ?, property_type_locked = ?,
        category_config = ?, custom_categories = ?, modified_at = ?
      WHERE id = ?
    `).run(
      now,
      budget.currentState?.homeSize || budget.versions[0]?.state?.homeSize,
      budget.currentState?.propertyType || budget.versions[0]?.state?.propertyType,
      data.categoryConfig ? JSON.stringify(data.categoryConfig) : null,
      data.customCategories ? JSON.stringify(data.customCategories) : null,
      now, req.params.id
    );
    
    db.prepare('DELETE FROM budget_versions WHERE budget_id = ?').run(req.params.id);
    const currentState = budget.currentState || budget.versions[budget.versions.length - 1]?.state;
    addVersion(req.params.id, 1, currentState, 'Customization applied', true);
    
    res.json({ success: true, message: 'Budget customized successfully', versionsWiped: true });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Customize budget error:', err);
    res.status(500).json({ error: 'Failed to customize budget' });
  }
});

// Admin user routes
app.get('/api/admin/users', requireAuth, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, name, created_at FROM users').all();
    res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.put('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const data = schemas.updateUser.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (data.username && data.username.toLowerCase() !== user.username.toLowerCase()) {
      const existing = getUserByUsername(data.username);
      if (existing) return res.status(400).json({ error: 'Username already exists' });
    }
    
    const updates = [];
    const params = [];
    
    if (data.username) { updates.push('username = ?'); params.push(data.username); }
    if (data.name) { updates.push('name = ?'); params.push(data.name); }
    if (data.password) { updates.push('password_hash = ?'); params.push(await bcrypt.hash(data.password, 10)); }
    
    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    const updatedUser = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(req.params.id);
    res.json({ success: true, user: updatedUser });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount <= 1) return res.status(400).json({ error: 'Cannot delete the last user' });
    
    const sessionId = req.cookies.session;
    const session = validateSession(sessionId);
    if (session && session.user_id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
    
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
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
      const existing = db.prepare('SELECT 1 FROM short_links WHERE code = ?').get(code);
      if (existing) return res.status(400).json({ error: 'Custom code already in use' });
    } else {
      do { code = generateCode(); }
      while (db.prepare('SELECT 1 FROM short_links WHERE code = ?').get(code));
    }
    
    db.prepare(`INSERT INTO short_links (code, config, client_name) VALUES (?, ?, ?)`)
      .run(code, data.config, data.clientName || null);
    
    res.json({ success: true, code, shortUrl: `/s/${code}` });
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Shorten error:', err);
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

app.get('/api/links', requireAuth, (req, res) => {
  try {
    const links = db.prepare('SELECT * FROM short_links ORDER BY created_at DESC').all();
    res.json(links.map(l => ({
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
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: { database: true, email: !!process.env.RESEND_API_KEY }
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
// GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGTERM', () => { console.log('SIGTERM received, closing database...'); db.close(); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT received, closing database...'); db.close(); process.exit(0); });

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`Budget Planner server running on http://localhost:${PORT}`);
  console.log(`Email from: ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`Database: ${DB_PATH}`);
});

