# Gamma Tech Budget Planner — Admin Guide

**Admin URL:** https://budget.gamma.tech/admin

This is the back-office. Use it to review budgets, adjust pricing, manage staff logins, and customize per-budget category lists. Mistakes here can affect the live tool immediately, so pay attention to the warnings.

For the customer-meeting workflow, see **SALES-GUIDE.md**. This guide covers what sales managers and admins do *outside* the meeting.

---

## 1. Logging in

1. Go to **https://budget.gamma.tech/admin**
2. Enter your email and password (same credentials as the main tool)
3. You land on the **Budgets** tab by default

**Forgot your password?**

- Tap "Forgot your password?" on the login screen
- Enter your email; we send you a reset link
- The link expires after one use; requesting a new one invalidates any previous reset link

**Session behavior**

- You stay logged in for 7 days on that device
- Tapping **Log Out** in the top-right header ends the session on that device only
- Closing the browser does not log you out

---

## 2. Tab 1 — Budgets

Overview of every live budget in the system.

### The stats strip at the top

Four summary cards:

- **Total Budgets** — total number of saved budgets
- **Total Views** — combined view count across all budgets (staff + clients)
- **This Week** — budgets created in the last 7 days
- **Total Value** — sum of the current total on every budget (a rough pipeline number)

### The budget list

Columns: Client | Total | Created | Views | Versions | Last Activity | Actions

- **Client** — the client / project name, the budget ID, the builder, and a **⚙️ Custom** badge if the budget has been customized (per-budget category overrides)
- **Total** — current estimated total
- **Views** — shows `X client / Y team` — internal staff views vs external client views
- **Versions** — count of saved versions in the history
- **Last Activity** — timestamp of the most recent view; "Never" if nobody has opened it

### Per-row actions

- **Details** — opens a modal with the full view and version history
- **⚙️ Customize** — opens the Customize Budget modal (covered below)
- **🗑️ Delete** — permanent removal with confirmation prompt. There is no undo.

### Details modal

Opens from the **Details** button. Shows:

- Budget ID, current total, created date, last-modified timestamp
- **View History** — each view logged with timestamp, `TEAM` or `CLIENT` badge, and the device (user agent string)
- **Version History** — every saved version in reverse-chronological order:
  - Version number (v1, v2, ...)
  - 📌 icon if pinned (pinned versions were saved via Share Link or Email — not just auto-save)
  - Timestamp, note, and the total at that version
  - **Restore** button on every prior version (the current version shows "Current" instead)
- **Open Budget** — jumps to the client-facing `/b/[id]` URL
- **Copy Link** — copies the live budget URL

**Restoring a version** — confirmation prompt first, then the restored state becomes the new current version. The version you restored to isn't deleted; a new version is created on top of the history. Think of it as "revert forward," not "rewind."

### + New Budget

Creates a blank budget pre-configured with specific project details.

- **Client Name**, **Builder** — text fields, both optional
- **Square Footage** — required, 500–50,000
- **Property Type** — Single Family or Condo

After creation, the Customize modal opens automatically so you can shape the category list before anyone uses it. Useful for preparing custom proposals ahead of a meeting.

---

## 3. Tab 2 — Categories & Pricing (⚠️ handle with care)

This is where you change what customers see in the live tool. **Every Save All is immediate and affects production.** There is no draft mode, no staging environment for pricing. Beta and production share the same database.

### Header controls

- **Property Type dropdown** — switches between Single Family and Condo category lists. Each type has its own independent list.
- **+ Add Item** — add a new category (like "Smart Shades Motorization")
- **+ Add Section** — add a new section header (like "Wellness"), then immediately prompts you to add the first item in it
- **💾 Save All** — saves every pending change. Confirms once; then it's live.
- **↺ Reset** — resets the selected property type back to factory defaults. Requires two confirmations. Destructive; loses all customization.

### Base Square Footage

An info box shows the calibration baseline (currently 4,000 sqft) and who last edited it. Pricing scales up or down from this baseline for each budget, per each category's size scale.

### Each category card

Shows the category name, icon, and description. Inside:

- **Hide checkbox** — hide this category from customer-facing budgets. You can't hide a category that's currently selected in any active budget without removing those selections first.
- **Tier columns** — Good / Standard / Better / Best. Each tier can be:
  - Price (the displayed price at baseline sqft)
  - Label (e.g., "Whole-home coverage")
  - Features list (bullet points shown to the customer)
  - Brands (a short text list of brand names)
- **Edit Features** button — opens a textarea where each line becomes one feature bullet
- **Size Scale slider** (0–2):
  - `0` = flat price, does not scale with home size
  - `1` = scales proportionally with sqft
  - `2` = scales quadratically (aggressive)
  - `0.5` = gentle scaling (default for most categories)
- **+ Tier** — add a missing tier
- **Remove tier** — removes a tier and its pricing

### Add Item modal

Required: name. Optional: section (or create a new section), icon (emoji), description, size scale. The item is created with no tiers — you must add at least one tier before the item shows up as selectable in any budget.

### Rules of thumb for pricing changes

- Always **review once more** before tapping Save All. You can't undo.
- Changes show up for every user on their next page load.
- If you want to experiment, create a budget first and use **⚙️ Customize** on that budget — those overrides stay scoped to the one budget.
- Avoid editing pricing during business hours if you can. Changes go live for clients instantly.

---

## 4. Tab 3 — Users

Manage who can log into the tool.

### The users table

Columns: Username | Name | Created | Actions

- **Username** — the login email
- **Name** — display name (shows in headers and emails)
- **Created** — account creation date

### Per-user actions

- **Edit** — opens a modal with current email/name pre-filled; password field is optional (leave blank to keep the current password)
- **Delete** — permanent; cannot delete yourself (your own row shows "(you)" instead of a Delete button)

### + Add User

- **Email** (required, becomes the login)
- **Display Name** (required)
- **Password** (required when creating)

Once created, the new user can immediately log in at `/admin` or at `budget.gamma.tech`.

### Password policy

There's no enforced complexity. Use something strong anyway. Consider storing new user passwords in 1Password → "Budget Planner Admin" vault.

---

## 5. Customizing a specific budget (⚙️)

The **⚙️ Customize** button on a budget row opens a modal that lets you rewrite the category list for that single budget. Useful when:

- A client's house is unusual and the default category list doesn't fit
- You want to add a one-off category (like "Home Theater Renovation") without polluting the global list
- You want to override pricing for a specific proposal

### What you can do

- **Hide categories** for this budget only
- **Override pricing, tiers, features** on any category — only affects this budget
- **Add Custom Categories** that only exist in this budget (🆕 button)
- **Lock a tier** so the customer can't select other tiers within that category

### Two important gotchas

1. **First customization locks the sqft.** Once you hit Save on a customization, the home size becomes read-only for that budget. This prevents customers from breaking your pricing logic by bumping sqft up and down.
2. **First customization wipes version history.** The first time you customize, the budget's version history resets. Subsequent customizations only *update* — they don't wipe. So make your big structural changes in one pass if you can.

The info box at the top of the modal tells you which mode you're in ("will lock and wipe" vs "will update existing").

---

## 6. Best practices

- **Back up before big pricing changes.** The Reset button is final. If you're doing a major overhaul, screenshot the current categories first or export them manually.
- **Test pricing on one budget first.** Use the per-budget Customize to preview how numbers look on a real proposal before changing the global list.
- **Review the view history** on the Details modal if a client is negotiating — you'll see when they opened it last, how many times, from what device.
- **Use pinned versions as your "final."** When you Share Link or Email from the main tool, the current state gets pinned in the version history. That gives you a clean "this is what we sent" breadcrumb to restore to if needed.
- **Clean up stale budgets periodically.** A delete every few months keeps the dashboard focused. Test budgets named "asdf" from three weeks ago should go.

---

## 7. What to avoid

- **Don't edit pricing mid-meeting** for an active client — they might see the change mid-conversation, which is jarring.
- **Don't delete a budget you think a client might still have bookmarked.** If they return to the link and it's gone, they see "Budget not found." That's a bad customer moment. Customize it to zero out instead, or just leave it.
- **Don't mass-reset categories** unless you're fully sure. There's no rollback.
- **Don't share one admin login across the whole team.** Give each salesperson their own account. Activity is tagged by the logged-in user (creator email is saved on every new budget).

---

## 8. Troubleshooting

**"I saved category changes but the public tool still shows old pricing."**
The tool caches category data on the client for performance. Have the user hard-refresh (close the Safari tab and reopen) or wait ~1 minute.

**"I can't delete this user."**
The user must not be the currently logged-in admin. Log in as a different admin, then delete.

**"The Restore button for an old version is missing."**
Only non-current versions have Restore. The current one shows "Current" — that's normal.

**"A client says they can't open the budget link."**
Check the Details modal for that budget. If the budget was deleted, they'll get 404. If not, confirm the URL they have matches the one shown in the Details modal. Short-link codes are case-sensitive.

**"I reset categories by accident."**
There's no undo. Reconstruct from memory, from an older Git commit of the app (developer-only), or just rebuild the list. Which is why the button double-confirms.

**"A salesperson is getting notifications for their own viewing."**
They're probably logged out or their session expired. Re-login fixes the creator-match detection.

**"I need to re-send a proposal email."**
Open the budget's `/b/[id]` link, tap **📧 Email**, re-enter the customer's email. Rate limit is 10 emails per hour per IP — rare to hit.

---

## 9. Quick reference

| Task | Where |
|------|-------|
| Find a budget | Budgets tab → scan list by client name or recency |
| Restore to a prior version | Budgets → Details → Version History → Restore |
| Permanently delete a budget | Budgets tab → 🗑️ |
| Create a blank budget with specific sqft/type | Budgets → + New Budget |
| Per-budget category customization | Budgets → ⚙️ Customize |
| Change global pricing | Categories & Pricing → edit → 💾 Save All |
| Add a new category everyone sees | Categories & Pricing → + Add Item |
| Revert all categories to factory | Categories & Pricing → ↺ Reset (double-confirm) |
| Add or remove a staff login | Users tab |
| Reset your own password | `/admin` login screen → "Forgot your password?" |

---

## 10. Who does what

| Role | What they should use |
|------|---------------------|
| Salesperson | Main tool at `budget.gamma.tech` + SALES-GUIDE.md |
| Sales manager | Admin dashboard → Budgets tab mostly + Users tab occasionally |
| Owner / principal | Full admin dashboard including Categories & Pricing |

Pricing edits are the highest-risk action in this tool. Keep that responsibility with one or two people, not the whole team.

---

That's the admin side. If something's unclear, the tool is small enough to tinker with on beta (budget-beta.gamma.tech/admin) — same database, so you'll see the same budgets, but at least you can click around without feeling like every button has teeth.
