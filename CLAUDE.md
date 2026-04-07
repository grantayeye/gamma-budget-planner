# Gamma Budget Planner — Claude Code Instructions

## Overview

Interactive budget estimation tool for residential home technology projects (SW Florida luxury homes, 3,000–5,000 sqft target). Helps potential clients understand pricing before consultation.

- **Stack:** Node.js + Express backend (`server.js`), vanilla HTML/JS frontend (`public/`), Supabase (Postgres + Auth), Resend for email
- **Production:** https://budget.gamma.tech (deploys from `main`)
- **Beta:** https://budget-beta.gamma.tech (deploys from `beta`)
- **Repo:** `grantayeye/gamma-budget-planner`
- **Railway project:** "Budget Planner" (formerly "friendly-miracle")

### Key Features
- 12+ categories with Good/Better/Best tiers
- Section headers: Infrastructure, Audio, Video, Control & Automation, Lighting & Shades, Security
- Mutual exclusivity logic (Wireless ↔ Centralized Lighting)
- Per-tier `sizeScale` support, 2500 sqft minimum floor
- Live Budgets: sharable links at `/b/[id]` with auto-save
- Admin Dashboard at `/admin` (login: `bradd` / password in 1Password → "Budget Planner Admin")

## Git Workflow

```
beta branch  →  auto-deploys to budget-beta.gamma.tech
main branch  →  auto-deploys to budget.gamma.tech (PROTECTED — PR required)
```

### Daily workflow:
1. Work directly on `beta` branch (commit and push freely)
2. Railway auto-deploys beta in ~30–60 seconds
3. Test at https://budget-beta.gamma.tech
4. When ready for production: create PR from `beta` → `main`
5. **Never push directly to `main`** — branch protection requires a PR

### Rules:
- Default working branch is `beta`
- Never force-push `main`
- GitHub is the source of truth (local clones are just working copies)

## Architecture

```
server.js           — Express server, all API routes, Supabase client
public/
  index.html        — Main budget tool UI (loads categories from /api/categories)
  admin.html        — Admin dashboard (3-tab: Budgets / Categories & Pricing / Users)
  categories-data.js — Fallback pricing data (static, used if API unavailable)
  gamma-logo.svg    — Brand logo
supabase-schema.sql — Full DB schema for reference
tests/              — Vitest unit tests (formatters, pricing)
e2e/                — Playwright E2E tests (admin, budget flows)
```

### Key patterns:
- `index.html` fetches live pricing from `GET /api/categories`, falls back to static `categories-data.js`
- Admin UI in `admin.html` uses `GET/PUT /api/admin/categories` (authenticated)
- All DB access goes through the Supabase JS client (no raw SQL in app code)
- Auth uses Supabase Auth (replaced legacy bcrypt/SQLite — see commit `4bf616c`)
- Rate limiting on auth (7/5min), API (60/min), and email (10/hr) endpoints

## Database

**Supabase project:** `ethsfvpeidtojqarocxz` (us-east-1, Pro plan)

### Tables:
| Table | Purpose |
|-------|---------|
| `budgets` | Client budget configurations (JSONB `current_state`) |
| `budget_versions` | Version history with pinning support |
| `budget_views` | Analytics — view tracking per budget |
| `short_links` | Shareable short URL codes |
| `category_defaults` | Admin-managed pricing/tier data |

### RLS:
- Anon users can read/update budgets and read short_links (for public share links)
- Only authenticated users get full CRUD on all tables
- Budget views: anyone can insert (tracking), only authenticated can read

### Admin category system:
- `category_defaults` table stores all pricing data
- Admin edits via `admin.html` → Categories & Pricing tab
- Public API: `GET /api/categories` — returns current pricing (used by `index.html`)
- Admin API: `GET/PUT /api/admin/categories`, `POST /api/admin/categories/reset`
- Source: `~/clawd/memory/2026-02-19.md`

## Deployment

**Railway** handles all deployments via GitHub integration.

| Service | Branch | Domain | Railway URL |
|---------|--------|--------|-------------|
| `gamma-budget-planner` | `main` | budget.gamma.tech | 16k7gvvv.up.railway.app |
| `gamma-budget-planner-beta` | `beta` | budget-beta.gamma.tech | klx7zujr.up.railway.app |

### DNS (Cloudflare):
- `budget` CNAME → `16k7gvvv.up.railway.app` (**proxy OFF** — required for Railway SSL)
- `budget-beta` CNAME → `klx7zujr.up.railway.app` (**proxy OFF**)

**Important:** Cloudflare proxy (orange cloud) breaks Railway SSL cert provisioning. Always keep proxy OFF (grey cloud/DNS-only). Source: `~/clawd/memory/2026-03-12.md`

## Critical Gotchas

1. **Category data must load after auth completes.** The admin page had a race condition where category data fetched before auth finished, causing failures. Fixed in commit `2c488ae`. Don't re-introduce this pattern.
   - Source: `~/clawd/memory/2026-02-19.md`, git log

2. **Cloudflare proxy must be OFF for Railway domains.** Orange-cloud proxy blocks HTTP-01 certificate challenges. Budget Planner uses DNS-only (grey cloud).
   - Source: `~/clawd/memory/2026-03-12.md`

3. **Never `await` inside Supabase `onAuthStateChange` callbacks.** Known Supabase bug causes hangs. Use `setTimeout(fn, 0)` to move async work out.
   - Source: `~/clawd/memory/2026-02-26.md`

4. **`supabase.rpc().catch()` doesn't work** — Supabase client returns objects, not thenables with `.catch()`. Use try/catch instead. Fixed in commit `faf1305`.

5. **`categories-data.js` is a fallback only.** The live source of truth for pricing is the `category_defaults` table in Supabase, served via `/api/categories`. The static file is loaded only if the API is unreachable.

6. **Both beta and production share the same Supabase project.** Database changes affect both environments immediately. There is no staging database.

## Environment Variables Needed

Set these in Railway for each service:

```bash
SUPABASE_URL=        # Supabase project URL
SUPABASE_SERVICE_KEY= # Supabase service role key (server-side only, never expose)
SUPABASE_ANON_KEY=   # Supabase anon/public key (used in frontend)
RESEND_API_KEY=      # Resend email service key
APP_URL=             # Full public URL (e.g., https://budget.gamma.tech)
PORT=                # Railway sets this automatically
```

Credentials stored in 1Password under "Supabase - Budget Planner".

## Testing & Linting

```bash
# Unit tests (Vitest)
npm test              # Watch mode
npm run test:unit     # Single run

# E2E tests (Playwright)
npm run test:e2e      # Run all E2E
npm run test:e2e:ui   # Interactive UI mode
npm run test:e2e:debug # Debug mode
```

- Unit tests: `tests/formatters.test.js`, `tests/pricing.test.js`
- E2E tests: `e2e/admin.spec.js`, `e2e/budget.spec.js`
- No linter configured yet — follow existing code style (vanilla JS, no TypeScript)

## What NOT To Do

- **Never touch QuoteIT or AnielGammaTech** — completely separate Railway project/org. Not our scope.
- **Never force-push `main`** — branch protection is on, and it's the production branch.
- **Never push to production without Bradd's approval** — always test on beta first.
- **Never delegate budget planner changes to Dan** — Grant/Claude Code handles all coding directly.
- **Never turn on Cloudflare proxy** for budget/budget-beta DNS records.
- **Never use `better-sqlite3` or `bcryptjs`** — these were removed in the Supabase migration. The app is fully on Supabase Auth + Postgres.
- **Never expose `SUPABASE_SERVICE_KEY`** in frontend code — it has admin privileges. Frontend uses `SUPABASE_ANON_KEY` only.
