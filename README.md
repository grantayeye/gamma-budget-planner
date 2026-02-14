# Budget Planner

Gamma Tech Services Residential Technology Budget Planner

## Quick Start

```bash
npm install
npm start
```

## Development

```bash
npm run dev
```

## Environment Variables

Create `.env` file:

```
RESEND_API_KEY=your_resend_api_key
SESSION_SECRET=generate_a_random_secret
PORT=3000
NODE_ENV=production  # for production
```

## Architecture

### Backend (Node.js + Express)
- **Database**: SQLite (better-sqlite3) with WAL mode
- **Rate Limiting**: express-rate-limit
- **Validation**: Zod schemas
- **Auth**: bcryptjs + cookie-based sessions
- **Email**: Resend API

### Frontend (ES6 Modules)
- **Structure**: Modular architecture in `public/src/`
- **State Management**: Custom state module with subscriptions
- **API Client**: Modular API client with error handling
- **Components**: Reusable component modules

### Directory Structure
```
budget-planner/
├── server.js              # Express server
├── data/
│   └── app.db            # SQLite database
├── public/
│   ├── index.html        # Main page
│   ├── admin.html        # Admin dashboard
│   ├── src/
│   │   ├── app.js        # Main application
│   │   ├── data/
│   │   │   └── categories.js    # Pricing data
│   │   ├── utils/
│   │   │   ├── formatters.js    # Currency, formatting
│   │   │   ├── pricing.js       # Price calculations
│   │   │   ├── state.js         # State management
│   │   │   └── url.js           # URL encoding
│   │   ├── api/
│   │   │   └── client.js        # API client
│   │   └── components/
│   │       └── toast.js         # Toast notifications
│   └── gamma-logo.svg
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Check auth status
- `POST /api/auth/users` - Create user (auth required if users exist)

### Budgets
- `POST /api/budgets` - Create budget
- `GET /api/budgets/:id` - Get budget
- `PUT /api/budgets/:id` - Update budget
- `GET /b/:id` - Budget page

### Admin (requires auth)
- `GET /api/admin/budgets` - List all budgets
- `GET /api/admin/budgets/:id` - Get full budget
- `POST /api/admin/budgets` - Create blank budget
- `PUT /api/admin/budgets/:id/customize` - Customize budget
- `POST /api/admin/budgets/:id/restore/:version` - Restore version
- `DELETE /api/admin/budgets/:id` - Delete budget
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### Short Links
- `POST /api/shorten` - Create short link
- `GET /api/links` - List links (auth required)
- `GET /s/:code` - Redirect short link

### Email
- `POST /api/send-proposal` - Send budget email

### Health
- `GET /api/health` - Health check

## Security Features

- Rate limiting on auth (5 attempts per 15 min)
- Rate limiting on API (60 requests per minute)
- Rate limiting on email (10 per hour)
- Zod input validation on all endpoints
- SQL injection protection via parameterized queries
- XSS protection via separate HTML/JS
- CSRF protection via SameSite cookies

## Backup & Restore

Backups are created automatically as `.tar.gz` files.

To restore from backup:
```bash
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
```

## Deployment

### Railway
1. Connect GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy

### Manual
```bash
npm install
npm start
```

## License

Private - Gamma Tech Services
