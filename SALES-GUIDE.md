# Gamma Tech Budget Planner — Sales Staff Guide

**Tool URL:** https://budget.gamma.tech
**Admin URL:** https://budget.gamma.tech/admin (you already know this one — admin-specific workflows are covered in the Admin Guide)

This guide is the playbook for using the Budget Planner during an in-person consultation with a client. Follow it once or twice and it'll be second nature.

---

## 1. What this tool is for

The Budget Planner lets you build a transparent, itemized technology budget live in front of the client. It has Good / Better / Best tiers for each system category (networking, audio, video, automation, lighting, security, etc.) and handles pricing automatically based on home size and property type.

You'll use it two ways:

1. **In-person meeting** (this guide) — building a budget live with the client across two iPads. Saved to the cloud as a "live budget link" so it persists.
2. **Remote share** — quickly creating a budget from your desk and emailing the link to a builder or client for review. Same tool, shorter workflow.

This guide covers the in-person flow. The remote flow is just the same steps without the customer-iPad half.

---

## 2. What you need before the meeting

- **Sales iPad** — the one you control during the meeting, AirPlayed to a TV if available.
- **Customer iPad** — handed to the client. Must be a separate device (not a second tab on yours).
- Both iPads on the internet (LTE is fine).
- You know the client's email address for the final send.
- You know the home size (sqft) and property type (Single Family vs Condo).

---

## 3. Setup before the customer arrives

You're creating two separate budgets so the customer can explore without affecting the version you're building together.

### On the sales iPad

1. Open Safari → go to **https://budget.gamma.tech**.
2. Log in with your admin email and password.
3. Enter the client's project details at the top:
   - **Client / Project Name** — e.g. "Smith Residence"
   - **Builder** — the builder's name if any
   - **Home Size** — square footage
   - **Property Type** — Single Family or Condo
4. Tap **🔗 Share Link** in the footer.
5. A modal pops up with the budget URL highlighted. **Copy this link** — you'll need it for the customer iPad's second tab. The URL bar will also update to `/b/<id>`; this is your live budget.
6. Optionally, AirPlay the sales iPad screen to the TV now.

### On the customer iPad

1. Open Safari → go to **https://budget.gamma.tech**.
2. Log in with your admin email and password.
3. Enter the **same project details**, but **append "CUSTOMER VERSION"** to the Client / Project Name (e.g. "Smith Residence — CUSTOMER VERSION").
4. Tap **🔗 Share Link** to create a second, independent budget.
5. In a **new Safari tab**, paste the URL you copied from the sales iPad. This second tab is the customer's view of what you're building together on the TV.
6. Come back to the first tab (the "CUSTOMER VERSION" one). This is the tab the customer will primarily use.
7. Tap **Log Out** in the header. This locks down project details — the customer can no longer change the client name, builder, sqft, or property type.
8. Hand the iPad to the customer.

**Quick rule:** logout happens on the customer iPad before you hand it over. Never on the sales iPad.

---

## 4. The "simpler" path — one tab on the customer iPad

If the customer isn't tech-savvy, **skip the two-tab setup**. Instead:

- Just set up the "CUSTOMER VERSION" budget on the customer iPad (step 3.1–3.4 above).
- Log out (step 3.7).
- Hand it over with the instruction: "This is your copy to play with. What we build together on the TV is separate. Nothing you do here will change the main budget."
- Don't bother with the second tab. One tab, one purpose, no confusion.

**When to use two tabs:** the client is hands-on, curious, and wants to peek at what you're building together.
**When to use one tab:** everyone else. This is the default unless they specifically want to follow along.

---

## 5. During the meeting

### Sales iPad (what you control)

- Make selections live as the conversation flows. Every tap auto-saves after ~2 seconds.
- Watch the **Estimated Investment** total in the top-right update in real time.
- Use **Expand All** to open every category if you want to walk through everything.
- Use **📄 View Summary** to show the itemized breakdown in a clean modal.

### Customer iPad (what they see)

- On their "CUSTOMER VERSION" tab, they can play with tier selections, extras, and custom adjustments freely. Their experiments don't touch your version.
- Project detail fields (name, builder, sqft, property type) are locked — they cannot change them because you logged out before handing over.
- If they flip to the second tab (your shared version), they see exactly what's on the TV. If they try to edit there, it would affect yours — so only direct power users to that tab, and make clear it's read-along, not play.

### If the customer asks something that changes scope

- Make the change on the **sales iPad**, not theirs.
- Customer iPad is for them to explore only.

---

## 6. Ending the meeting — which version wins

You and the client now have two budgets in the cloud: the **main version** (built together) and the **CUSTOMER VERSION** (their sandbox).

Decide which one represents where you actually landed:

- **99% of the time**: main version wins. That's what you were building together.
- **Occasionally**: the customer's sandbox has changes you want to carry forward. In that case, *the customer version wins* and from here on that's the one you treat as "the budget."

Once you've picked a winner:

1. Open the winning budget on the sales iPad (either by tapping the URL or by being on the tab already).
2. Tap **📧 Email** in the footer.
3. Enter the customer's email address. The full itemized proposal goes out — all line items, extras, custom adjustments, subtotals, tax, and total. The customer receives a link they can click to return to the budget anytime.
4. Tell the customer: "I just emailed you this budget. Click the link in that email when you're home and make any final adjustments there. Changes you make auto-save."

### If the customer version won

Mentally note it. The link you email them is the CUSTOMER VERSION's URL. You can rename the project by editing it after the meeting (only you can — customers can't change project details, that's why we lock them out).

### What the customer sees at home

- They open the link on their laptop / phone / whatever.
- They can adjust tier selections, add extras, add custom adjustments.
- They **cannot** change client name, builder, sqft, or property type — those are locked because they aren't logged in.
- Their changes auto-save to our cloud. Every change notifies you by email, bundled so you don't get spammed (15-minute window — you'll get one email per burst of edits, not per click).
- You'll also get an email the first time they view it after leaving.

---

## 7. Tool features you should know

### Project Details (top of page)

- **Client / Project Name** — shows up on the summary and in the email.
- **Builder** — shows up on the email and helps tag the budget in the admin list.
- **Home Size** — drives most pricing. Minimum floor is 2,500 sqft even if you enter less.
- **Property Type** — Single Family (full category list) or Condo (slightly reduced list — no exterior speakers, no certain HVAC categories, etc.).

### Categories (system sections)

Each category has **Good / Better / Best** tiers. Tap a category to expand it, then tap a tier to select. Tap the tier again to deselect. Pricing is included in each tier card so the client sees the math.

Categories are grouped under section headers: Infrastructure → Audio → Video → Control & Automation → Lighting & Shades → Security.

### Mutual Exclusivity

Some categories are mutually exclusive — for example, choosing **Centralized Lighting** will automatically deselect **Wireless Lighting**, and vice versa. The tool handles this for you; don't fight it.

### Extras (checkboxes)

Below the main categories there's an **Additional Items** section. These are yes/no adds (shade types, certain extras) that scale with home size or are flat-priced. Tap to toggle.

### Custom Adjustments (line items)

Below Additional Items is **Custom Adjustments**. Use this for anything not covered by a category — e.g., "Tear out old wiring: +$2,500" or "Use existing equipment credit: -$1,200." Enter a name and an amount (can be negative).

### Per-Category Adjustments

Inside an expanded category card there's a small adjustment option where you can add or subtract from that specific category's total. Useful for unusual circumstances.

### Summary Modal (📄 View Summary)

Shows everything on one screen — each category's tier and price, extras, adjustments, subtotal, estimated tax, and grand total. Good to review with the client before emailing.

### Share Link (🔗 Share Link)

- Saves the current state as a live cloud budget.
- Returns a shareable URL (`/b/<id>`).
- Shows a modal with the URL highlighted so you can AirPlay / read aloud / copy.
- Anyone with the link can view and make tier changes, but only logged-in admins can change project details.

### Email (📧 Email)

- Auto-creates a live budget if one doesn't exist yet.
- Sends a branded itemized proposal to the email you enter.
- Includes the live-budget URL so the customer can come back anytime.

### Log Out button

- Shown in the top-right of the header when you're logged in as an admin.
- Tap it before handing the iPad to a customer.
- It removes your admin session on that device. The customer can't edit project details, and can't get back to the admin dashboard.

---

## 8. Tips and best practices

- **Always log out before handing the iPad to a customer.** This is what prevents them from accidentally changing the project name or sqft.
- **Let the auto-save do its work.** Every selection saves within 2 seconds. You don't need to tap a "Save" button. There isn't one.
- **If AirPlay isn't showing the right URL** — tap the iPad once to force Safari's URL bar to repaint. This is an iOS quirk, not a bug in the tool.
- **One budget per client.** Don't reuse an old budget for a new client — each meeting gets a fresh one.
- **If you make a mistake and want to start over**, just tap each selection to deselect. Or close the tab and restart from a fresh `budget.gamma.tech`.
- **Name the project clearly.** The client name shows up in your admin dashboard, the email subject, and the proposal header. "Smith Residence" is better than "Test1."
- **Watch the customer's reactions on the TV.** The live total is a conversation driver — it's the whole point of the tool.

---

## 9. What to avoid

- **Don't edit project details on the customer iPad.** You logged out; they can't change them either. This is by design.
- **Don't share the customer iPad's URL publicly.** That's their exploration sandbox. It'll still be in the system.
- **Don't use the customer's iPad to edit your version.** Flip to the other tab only if you need to check something; edit from the sales iPad.
- **Don't delete budgets mid-meeting.** If the customer changes their mind, just change the selections. Every change creates a version in the history — we can roll back later from the admin dashboard.

---

## 10. Troubleshooting

**"The tool says 'Budget not found'."** — The URL is wrong or was mistyped. Double-check the `/b/<id>` portion. If you're copy-pasting, make sure you got the whole string.

**"I tapped Share Link and nothing happened."** — Wait 2 seconds; the server might be creating the budget. If a modal still doesn't appear, try again once. If still broken, reload the page and rebuild (the state should reload if the URL already has a `/b/<id>`).

**"The Email button says rate-limited."** — You've sent more than 10 proposal emails in the last hour from that IP. Wait or switch devices.

**"My selections disappeared!"** — Did you close the tab before the URL updated to `/b/<id>`? Selections only persist once a live budget has been created (either by sharing or emailing). Before that, you're in local memory only. If you entered everything but never tapped Share or Email, it's gone. Always tap Share early in the meeting.

**"The customer changed the project name despite being logged out."** — They shouldn't be able to. If you see this, check that you actually tapped Log Out before handing over. Screenshot and report it — that would be a bug.

**"I need to look up a past budget."** — Use the Admin Dashboard (covered in the Admin Guide).

---

## 11. Quick reference card

| Task | Steps |
|------|-------|
| Start a new live budget | Visit `budget.gamma.tech` → login → enter project details → tap Share Link |
| Set up customer iPad for meeting | Login → enter details with "CUSTOMER VERSION" → Share Link → Log Out → hand over |
| AirPlay the sales iPad | Swipe down Control Center → Screen Mirroring → select the TV |
| Get the budget URL | Tap Share Link; URL is shown in the modal |
| Send final budget to customer | Tap 📧 Email → enter email → send |
| Review a past budget | Admin Dashboard at `/admin` |

---

## 12. End-of-meeting script

Feel free to adapt, but here's a rough script for ending the meeting cleanly:

> "Okay — I'm going to email you this budget right now. You'll get it at [email] in a minute. The link in that email takes you right back to this same budget, so tonight or this weekend, you can open it on your laptop and make any last changes. Everything you adjust saves automatically, and I'll see what you've changed. Give me a call when you're happy with where it landed and we'll set up the next meeting."

Done. That's the whole tool.
