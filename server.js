require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'BudgetPlanner@gamma.tech';
const FROM_NAME = 'Gamma Tech Budget Planner';

// Short links storage
const LINKS_FILE = path.join(__dirname, 'data', 'links.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
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

// Static files
app.use(express.static(path.join(__dirname, 'public')));

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
