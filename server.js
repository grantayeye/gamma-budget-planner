require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'BudgetPlanner@gamma.tech';
const FROM_NAME = 'Gamma Tech Budget Planner';

// Storage paths
const LINKS_FILE = path.join(__dirname, 'data', 'links.json');
const BUDGETS_DIR = path.join(__dirname, 'data', 'budgets');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Session secret (generate once and store)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Ensure data directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(BUDGETS_DIR)) {
  fs.mkdirSync(BUDGETS_DIR);
}

// Load existing links
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading links:', e);
  }
  return {};
}

// Save links
function saveLinks(links) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
}

// Generate short code
function generateCode(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // Removed confusing chars
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ============================================================
// BUDGET STORAGE FUNCTIONS
// ============================================================

function loadBudget(id) {
  const filePath = path.join(BUDGETS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading budget:', e);
  }
  return null;
}

function saveBudget(budget) {
  const filePath = path.join(BUDGETS_DIR, `${budget.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(budget, null, 2));
}

function listBudgets() {
  try {
    const files = fs.readdirSync(BUDGETS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const budget = JSON.parse(fs.readFileSync(path.join(BUDGETS_DIR, f), 'utf8'));
      // Return summary (not full version history)
      return {
        id: budget.id,
        clientName: budget.clientName,
        created: budget.created,
        lastModified: budget.lastModified,
        viewCount: budget.views ? budget.views.length : 0,
        lastViewed: budget.views && budget.views.length > 0 ? budget.views[budget.views.length - 1].timestamp : null,
        versionCount: budget.versions ? budget.versions.length : 0,
        currentTotal: budget.currentState ? budget.currentState.total : 0
      };
    }).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  } catch (e) {
    console.error('Error listing budgets:', e);
    return [];
  }
}

// ============================================================
// USER/AUTH FUNCTIONS
// ============================================================

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
  }
  return {};
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const sessions = loadSessions();
  sessions[sessionId] = {
    userId,
    created: new Date().toISOString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };
  saveSessions(sessions);
  return sessionId;
}

function validateSession(sessionId) {
  if (!sessionId) return null;
  const sessions = loadSessions();
  const session = sessions[sessionId];
  if (!session) return null;
  if (new Date(session.expires) < new Date()) {
    delete sessions[sessionId];
    saveSessions(sessions);
    return null;
  }
  return session;
}

function destroySession(sessionId) {
  const sessions = loadSessions();
  delete sessions[sessionId];
  saveSessions(sessions);
}

// Auth middleware
function requireAuth(req, res, next) {
  const sessionId = req.cookies.session;
  const session = validateSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const users = loadUsers();
  req.user = users.find(u => u.id === session.userId);
  next();
}

// Short link redirect (must be before static middleware)
app.get('/s/:code', (req, res) => {
  const links = loadLinks();
  const link = links[req.params.code];
  
  if (link) {
    // Update access stats
    link.lastAccessed = new Date().toISOString();
    link.accessCount = (link.accessCount || 0) + 1;
    saveLinks(links);
    
    // Redirect to full URL
    res.redirect('/?' + link.config);
  } else {
    res.status(404).send('Short link not found');
  }
});

// ============================================================
// LIVE BUDGET ROUTES
// ============================================================

// Create a new live budget
app.post('/api/budgets', (req, res) => {
  try {
    const { state, clientName } = req.body;
    
    if (!state) {
      return res.status(400).json({ error: 'Budget state is required' });
    }
    
    // Generate unique ID
    let id;
    do {
      id = generateCode(8);
    } while (loadBudget(id));
    
    const now = new Date().toISOString();
    const budget = {
      id,
      clientName: clientName || null,
      created: now,
      lastModified: now,
      views: [],
      versions: [{
        version: 1,
        timestamp: now,
        state,
        note: 'Initial budget'
      }],
      currentState: state
    };
    
    saveBudget(budget);
    
    res.json({
      success: true,
      id,
      url: `/b/${id}`
    });
    
  } catch (err) {
    console.error('Create budget error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Get a live budget (also records view)
app.get('/api/budgets/:id', (req, res) => {
  try {
    const budget = loadBudget(req.params.id);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Record view (only if not from admin)
    if (!req.query.admin) {
      budget.views.push({
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown'
      });
      saveBudget(budget);
    }
    
    // Return only what frontend needs
    res.json({
      id: budget.id,
      clientName: budget.clientName,
      created: budget.created,
      lastModified: budget.lastModified,
      currentState: budget.currentState,
      versionCount: budget.versions.length
    });
    
  } catch (err) {
    console.error('Get budget error:', err);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

// Update a live budget (creates new version)
app.put('/api/budgets/:id', (req, res) => {
  try {
    const { state, note } = req.body;
    const budget = loadBudget(req.params.id);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    if (!state) {
      return res.status(400).json({ error: 'Budget state is required' });
    }
    
    // Check if state actually changed (avoid duplicate versions)
    const lastVersion = budget.versions[budget.versions.length - 1];
    if (JSON.stringify(lastVersion.state) === JSON.stringify(state)) {
      return res.json({ success: true, message: 'No changes detected', versionCount: budget.versions.length });
    }
    
    const now = new Date().toISOString();
    
    // Add new version
    budget.versions.push({
      version: budget.versions.length + 1,
      timestamp: now,
      state,
      note: note || 'Auto-save'
    });
    
    budget.currentState = state;
    budget.lastModified = now;
    
    // Update client name if provided in state
    if (state.clientName) {
      budget.clientName = state.clientName;
    }
    
    saveBudget(budget);
    
    res.json({
      success: true,
      versionCount: budget.versions.length,
      lastModified: now
    });
    
  } catch (err) {
    console.error('Update budget error:', err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Live budget page redirect
app.get('/b/:id', (req, res) => {
  const budget = loadBudget(req.params.id);
  if (!budget) {
    return res.status(404).send('Budget not found');
  }
  // Serve the main page - frontend will detect /b/:id and load budget
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// AUTH ROUTES
// ============================================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = loadUsers();
    
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const sessionId = createSession(user.id);
    
    res.cookie('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({ success: true, user: { id: user.id, username: user.username, name: user.name } });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.cookies.session;
  if (sessionId) {
    destroySession(sessionId);
  }
  res.clearCookie('session');
  res.json({ success: true });
});

// Check auth status
app.get('/api/auth/me', (req, res) => {
  const sessionId = req.cookies.session;
  const session = validateSession(sessionId);
  if (!session) {
    return res.json({ authenticated: false });
  }
  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, user: { id: user.id, username: user.username, name: user.name } });
});

// Create user (requires auth, or allowed if no users exist)
app.post('/api/auth/users', async (req, res) => {
  try {
    const users = loadUsers();
    
    // If users exist, require auth
    if (users.length > 0) {
      const sessionId = req.cookies.session;
      const session = validateSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    const { username, password, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      name: name || username,
      created: new Date().toISOString()
    };
    
    users.push(user);
    saveUsers(users);
    
    res.json({ success: true, user: { id: user.id, username: user.username, name: user.name } });
    
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ============================================================
// ADMIN API ROUTES (Protected)
// ============================================================

// List all budgets
app.get('/api/admin/budgets', requireAuth, (req, res) => {
  const budgets = listBudgets();
  res.json(budgets);
});

// Get full budget details (including versions and views)
app.get('/api/admin/budgets/:id', requireAuth, (req, res) => {
  const budget = loadBudget(req.params.id);
  if (!budget) {
    return res.status(404).json({ error: 'Budget not found' });
  }
  res.json(budget);
});

// Restore a budget to a previous version
app.post('/api/admin/budgets/:id/restore/:version', requireAuth, (req, res) => {
  try {
    const budget = loadBudget(req.params.id);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const versionNum = parseInt(req.params.version);
    const targetVersion = budget.versions.find(v => v.version === versionNum);
    
    if (!targetVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const now = new Date().toISOString();
    
    // Add restore as new version
    budget.versions.push({
      version: budget.versions.length + 1,
      timestamp: now,
      state: targetVersion.state,
      note: `Restored to version ${versionNum}`
    });
    
    budget.currentState = targetVersion.state;
    budget.lastModified = now;
    
    saveBudget(budget);
    
    res.json({ success: true, newVersion: budget.versions.length });
    
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Delete a budget
app.delete('/api/admin/budgets/:id', requireAuth, (req, res) => {
  try {
    const filePath = path.join(BUDGETS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete budget error:', err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// List users
app.get('/api/admin/users', requireAuth, (req, res) => {
  const users = loadUsers().map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    created: u.created
  }));
  res.json(users);
});

// Update user
app.put('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { username, password, name } = req.body;
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check username uniqueness if changing
    if (username && username.toLowerCase() !== users[userIndex].username.toLowerCase()) {
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      users[userIndex].username = username;
    }
    
    // Update name if provided
    if (name) {
      users[userIndex].name = name;
    }
    
    // Update password if provided
    if (password) {
      users[userIndex].passwordHash = await bcrypt.hash(password, 10);
    }
    
    saveUsers(users);
    
    res.json({ 
      success: true, 
      user: { 
        id: users[userIndex].id, 
        username: users[userIndex].username, 
        name: users[userIndex].name 
      } 
    });
    
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    
    // Prevent deleting the last user
    if (users.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last user' });
    }
    
    // Prevent deleting yourself
    if (req.user && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    users.splice(userIndex, 1);
    saveUsers(users);
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Admin dashboard route (serve admin page)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create short link
app.post('/api/shorten', (req, res) => {
  try {
    const { config, clientName, customCode } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Config string is required' });
    }
    
    const links = loadLinks();
    
    // Check if custom code is requested and available
    let code = customCode;
    if (code) {
      code = code.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (links[code]) {
        return res.status(400).json({ error: 'Custom code already in use' });
      }
    } else {
      // Generate unique code
      do {
        code = generateCode();
      } while (links[code]);
    }
    
    // Store the link
    links[code] = {
      config,
      clientName: clientName || null,
      created: new Date().toISOString(),
      accessCount: 0
    };
    
    saveLinks(links);
    
    res.json({ 
      success: true, 
      code,
      shortUrl: `/s/${code}`
    });
    
  } catch (err) {
    console.error('Shorten error:', err);
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

// List all short links (for admin)
app.get('/api/links', (req, res) => {
  const links = loadLinks();
  const list = Object.entries(links).map(([code, data]) => ({
    code,
    shortUrl: `/s/${code}`,
    ...data
  }));
  res.json(list);
});

// Send budget via email
app.post('/api/send-proposal', async (req, res) => {
  try {
    const { 
      recipientEmail, 
      recipientName,
      subject,
      htmlContent,
      proposalData 
    } = req.body;

    // Validate required fields
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!htmlContent && !proposalData) {
      return res.status(400).json({ error: 'Either htmlContent or proposalData is required' });
    }

    // Build email HTML
    let emailHtml = htmlContent;
    
    if (!emailHtml && proposalData) {
      emailHtml = buildProposalEmail(proposalData, recipientName);
    }

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject: subject || 'Your Technology Budget from Gamma Tech',
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }

    console.log(`Email sent successfully to ${recipientEmail}. ID: ${data.id}`);
    res.json({ success: true, messageId: data.id });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Build budget email HTML from structured data
function buildProposalEmail(data, recipientName) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  
  // Format currency
  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  // Build category rows
  let categoryRows = '';
  if (data.categories && Array.isArray(data.categories)) {
    data.categories.forEach(cat => {
      if (cat.tier && cat.tier !== 'none') {
        categoryRows += `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #E0E0E0; font-weight: 500;">${cat.name || 'Category'}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #E0E0E0; text-transform: capitalize;">${cat.tier}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #E0E0E0; text-align: right;">${formatCurrency(cat.price)}</td>
          </tr>
        `;
      }
    });
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Technology Budget</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAFAFA; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 16px rgba(15,47,68,0.06); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F2F44 0%, #133F5C 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">Gamma Tech Services</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Residential Technology Budget</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #393939; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 32px; color: #393939; font-size: 16px; line-height: 1.6;">
                Thank you for your interest in Gamma Tech Services. Below is your personalized technology budget based on your selections.
              </p>

              <!-- Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #EEF8FE 0%, #E8F1F8 100%); border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; color: #5A5A5A; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Estimated Investment</p>
                    <p style="margin: 8px 0 0; color: #0F2F44; font-size: 36px; font-weight: 700;">${formatCurrency(data.total)}</p>
                    ${data.tierLabel ? `<p style="margin: 8px 0 0; color: #017ED7; font-size: 14px; font-weight: 500;">${data.tierLabel}</p>` : ''}
                  </td>
                </tr>
              </table>

              ${categoryRows ? `
              <!-- Categories Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E0E0E0; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
                <tr style="background-color: #F5F5F5;">
                  <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #393939; border-bottom: 1px solid #E0E0E0;">Category</th>
                  <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #393939; border-bottom: 1px solid #E0E0E0;">Tier</th>
                  <th style="padding: 14px 16px; text-align: right; font-weight: 600; color: #393939; border-bottom: 1px solid #E0E0E0;">Estimate</th>
                </tr>
                ${categoryRows}
              </table>
              ` : ''}

              <p style="margin: 0 0 16px; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                This is a preliminary budget estimate. Final pricing may vary based on site conditions, specific equipment selections, and installation requirements.
              </p>

              <p style="margin: 0; color: #393939; font-size: 16px; line-height: 1.6;">
                Ready to move forward? Reply to this email or call us at <strong>(239) 330-4939</strong> to schedule a consultation.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5F5F5; padding: 24px 40px; text-align: center; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0; color: #5A5A5A; font-size: 14px;">
                <strong>Gamma Tech Services</strong><br>
                3106 Horseshoe Dr S, Naples, FL 34116<br>
                (239) 330-4939 • gamma.tech
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Start server
app.listen(PORT, () => {
  console.log(`Budget Planner server running on http://localhost:${PORT}`);
  console.log(`Email from: ${FROM_NAME} <${FROM_EMAIL}>`);
});
