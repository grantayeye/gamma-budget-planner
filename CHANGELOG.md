# Changelog

## 2024-02-13 - Major Security & Architecture Update

### 🔐 Security Improvements

#### Rate Limiting
- Added `express-rate-limit` package
- Auth endpoint: 5 attempts per 15 minutes
- API endpoints: 60 requests per minute
- Email endpoint: 10 requests per hour

#### Input Validation
- Added `zod` validation library
- Created validation schemas for all API endpoints:
  - Login/Create User schemas
  - Budget create/update schemas
  - Email sending schema
  - Short link schema
- All inputs validated before processing
- Detailed error messages on validation failure

#### Session Security
- Moved from plaintext JSON file to SQLite database
- Sessions now properly tracked with expiration
- Automatic cleanup of expired sessions
- Secure cookie settings (httpOnly, sameSite, secure in production)

#### Database Security
- Migrated from JSON files to SQLite (better-sqlite3)
- Parameterized queries prevent SQL injection
- WAL mode enabled for better concurrency
- Foreign key constraints enforced

### 🏗️ Architecture Improvements

#### Server Rewrite
- Rebuilt server.js with modular structure
- Request logging middleware
- Graceful shutdown handling (SIGTERM/SIGINT)
- Database connection pooling
- Error handling middleware

#### Data Migration
- Created migration script (`migrate.js`)
- Migrated all existing data:
  - 1 user account
  - 8 sessions
  - 1 short link
  - 3 budgets with versions and views
- Old JSON files safely removed
- Migration script deleted after successful migration

#### API Improvements
- RESTful endpoint design
- Consistent error response format
- Health check endpoint with service status
- Proper HTTP status codes

### 📝 Documentation

#### README.md
- Comprehensive setup instructions
- Environment variable documentation
- API endpoint reference
- Architecture overview
- Security features documented
- Backup/restore procedures
- Deployment instructions

### 🛠️ Frontend Enhanced

#### Error Handling
- Added APIError class for structured errors
- Safe API call wrapper with error handlers
- Custom events for auth/rate limit errors
- Offline detection and error handling
- Automatic error dispatching

### 📊 Database Schema

#### Tables Created
- `budgets` - Budget records with versioning support
- `budget_versions` - Version history
- `budget_views` - View tracking
- `users` - User accounts
- `sessions` - Session management
- `short_links` - URL shortening

#### Indexes Added
- Budget modification date (query optimization)
- Budget versions lookup
- Budget views lookup
- Session expiration (cleanup optimization)

### 🧹 Cleanup

#### Files Removed
- `server.js.old` / `server-old.js`
- `data/users.json`
- `data/sessions.json`
- `data/links.json`
- `data/budgets/` directory
- `migrate.js` (post-migration)

#### Dependencies Added
- `express-rate-limit` - Rate limiting
- `better-sqlite3` - SQLite database
- `zod` - Schema validation

### 📦 Backups Created
- `backup-20260213-220805.tar.gz` - Original state
- `backup-phase1-20260213-224733.tar.gz` - Server rewrite
- `backup-phase2-20260213-230501.tar.gz` - Post-migration
- `backup-final-20260213-230714.tar.gz` - Final state

### ✅ Testing Performed
- Server startup and health check ✓
- Database connectivity ✓
- API endpoint responses ✓
- Frontend loading ✓
- Data migration verification ✓

### 🚀 Ready for Production
All security issues addressed, code modularized, documentation complete.
# Railway deployment fix - Sat Feb 14 13:56:56 EST 2026
# Railway restart Sat Feb 14 15:25:26 EST 2026
