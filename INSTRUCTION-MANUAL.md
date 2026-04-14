# Gamma Tech Budget Planner — Team Instruction Manual

**Tool URL:** https://budget.gamma.tech
**Admin URL:** https://budget.gamma.tech/admin

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Building a Budget](#2-building-a-budget)
3. [Selecting Categories & Tiers](#3-selecting-categories--tiers)
4. [Special Category Rules](#4-special-category-rules)
5. [Extras & Custom Adjustments](#5-extras--custom-adjustments)
6. [Understanding the Total](#6-understanding-the-total)
7. [Viewing the Summary](#7-viewing-the-summary)
8. [Sharing a Budget Link](#8-sharing-a-budget-link)
9. [Emailing a Budget](#9-emailing-a-budget)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Creating Custom Budgets](#11-creating-custom-budgets-admin)
12. [Tips & Best Practices](#12-tips--best-practices)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Getting Started

**URL:** https://budget.gamma.tech

The Budget Planner is an interactive tool that helps clients see estimated pricing for residential home technology projects — things like structured wiring, audio, video, lighting, security, and automation. It's designed for luxury homes in the 3,000–5,000+ square foot range.

**When to use it:**

- **Before a client meeting** — build a budget ahead of time so you have a link ready to share
- **During a consultation** — walk through categories together on a tablet or laptop
- **After a meeting** — email the client a link so they can explore options on their own

The tool works on any device — phone, tablet, or laptop. No app to install, no login required for the client-facing side.

---

## 2. Building a Budget

**URL:** https://budget.gamma.tech

When you open the Budget Planner, the first thing you'll see is the **Project Details** section at the top. Fill in these fields:

1. **Client / Project Name** — Type the client's name or project name (e.g., "Smith Residence"). This name appears on shared budget links and in emails you send, so always fill it in.

2. **Builder** — Type the builder's name if known. This is optional but will be included if you email a proposal.

3. **Home Size (sq ft)** — Enter the home's square footage. This is important because prices scale with home size.
   - The minimum is 1,500 sq ft
   - The maximum is 35,000 sq ft
   - The default is 4,000 sq ft
   - Prices are calculated based on a 4,000 sq ft baseline — smaller homes cost less, larger homes cost more

4. **Property Type** — Choose either:
   - **Single Family** — the standard category set for residential homes
   - **Condo** — a modified category set tailored for condos (some categories and pricing are adjusted)

Once you've entered the project details, scroll down to start selecting categories.

---

## 3. Selecting Categories & Tiers

**URL:** https://budget.gamma.tech

Below the project details, you'll see **System Categories** organized into sections:

- **Infrastructure** — Structured Wiring & Pre-Wire, Whole-Home WiFi & Networking
- **Audio** — Multi-Room Audio, Invisible Speakers, Surround Sound, Home Theater / Media Room, Yard/Pool Audio
- **Video** — TV Mounting & Video Distribution
- **Control & Automation** — Control & Automation System, Touchscreens
- **Lighting & Shades** — Wireless Lighting Control, Centralized / Hybrid Lighting Control, Designer Lighting Keypads, Motorized Shades
- **Security** — Surveillance & Security Cameras, Security & Alarm System

### How category cards work

Each category appears as a card with the category name, icon, and a brief description. To make a selection:

1. **Click a category card** to expand it and see the available tiers
2. **Click a tier** to select it — the card will highlight and the price will be added to your total
3. **Click "Skip"** (or click the same tier again) to deselect a category and remove it from the total

### What the tiers mean

Most categories offer tiers labeled by their tag name (Good, Standard, Better, Best), but each tier also has a descriptive label that tells you what level of service it represents:

- **Good** — Essential coverage, entry-level equipment, core functionality
- **Standard** — A step up from Good with more coverage and better components (not all categories have this tier)
- **Better** — Comprehensive coverage, premium equipment, expanded zones
- **Best** — Full coverage, top-of-the-line equipment, maximum capability

When you select a tier, you'll see a detailed list of what's included — specific features, equipment, and the brands used.

### Preset buttons

Instead of selecting each category one at a time, you can use the preset buttons to set all categories at once:

- **Good** — sets every category to its Good tier
- **Better** — sets every category to its Better tier
- **Best** — sets every category to its Best tier
- **Clear All** — removes all selections and resets to zero

Presets are a great starting point. After applying a preset, you can go back and adjust individual categories up or down.

If a category doesn't have the exact tier you selected (for example, not every category has a "Standard" tier), the tool will pick the closest available tier.

### How prices scale with home size

Prices shown are based on a 4,000 sq ft home. When you change the square footage, prices adjust automatically. Larger homes cost more because they need more equipment, more wiring, and more installation time. Some categories scale more than others — for example, wiring scales heavily with home size, while a surround sound system stays the same regardless of how big the house is.

---

## 4. Special Category Rules

Some categories have dependencies on each other. If you see a category card that's grayed out and you can't click it, one of these rules is the reason:

### Wireless Lighting vs. Centralized Lighting — pick one, not both

You can only select **one** lighting control system:
- If you select **Wireless Lighting Control**, then **Centralized / Hybrid Lighting Control** will be grayed out
- If you select **Centralized / Hybrid Lighting Control**, then **Wireless Lighting Control** will be grayed out

To switch from one to the other, first deselect (skip) the one you've chosen, then select the other.

### Designer Keypads — requires a lighting selection first

**Designer Lighting Keypads** will be grayed out until you select either Wireless Lighting or Centralized Lighting. Additionally:
- Designer Keypads are **not available** if you've selected the **Good tier of Wireless Lighting** (Lutron Caseta doesn't support designer keypads)
- The **Bespoke (Best) tier** of Designer Keypads is not available with Wireless Lighting — it requires Centralized Lighting

### Invisible Speakers — requires Multi-Room Audio first

**Invisible Speakers** will be grayed out until you select a tier for **Multi-Room Audio**. This makes sense because invisible speakers replace the standard speakers included in your audio system — you need the audio system first.

---

## 5. Extras & Custom Adjustments

**URL:** https://budget.gamma.tech

### Additional Items (Extras)

Below the main categories, you'll find the **Additional Items** section. These are add-on items that don't fit neatly into the tier system:

- **Pool Alarm & Child Safety** — Required by Florida building code
- **Low Voltage Fire Detection** — Monitored smoke/heat/CO
- **Leak Detection System** — Water heater, laundry, sinks

To add an extra, click it. Click again to remove it. Active extras are highlighted. Extra prices also scale with home size.

Note: Extras are available for Single Family properties only. Condos do not show an extras section.

### Custom Adjustments (Modifiers)

Below the extras, there's a **Custom Adjustments** section. This lets you add or subtract custom line items for anything outside the standard categories.

To add a custom line item:

1. Click the **"+ Add Line Item"** button
2. Enter a **name** for the item (e.g., "Outdoor TV - Pool Area")
3. Enter an **amount** — use a positive number to add cost, or a negative number to subtract
4. The item will be included in the total and will appear on the summary and in emails

You can add as many custom line items as you need. To remove one, click the delete button next to it.

Each category card also has a small **"Adjust"** field at the bottom. This lets you add a per-category modifier — for example, adding $2,000 to the Networking category for a specific piece of equipment with a note explaining why.

---

## 6. Understanding the Total

**URL:** https://budget.gamma.tech

The running total is always visible in two places:

1. **Header bar** (top right, stays visible as you scroll) — shows the grand total in large blue text
2. **Bottom bar** — shows the Subtotal and Tax Estimate side by side

### How the total is calculated

- **Subtotal** = all selected category prices + extras + custom adjustments
- **Tax Estimate** = 7.5% of the subtotal (Florida sales tax on equipment)
- **Estimated Investment** = Subtotal + Tax Estimate

The header also shows a **tier label** (e.g., "Better Tier Budget") based on whichever tier you've selected most often. This gives clients a quick sense of where the budget falls.

**Important:** This is an **estimate**, not a quote. The summary page includes a disclaimer that final pricing requires detailed design and engineering. TV/display costs are generally not included unless specifically noted. Prices reflect new construction — retrofit projects may need additional assessment.

---

## 7. Viewing the Summary

**URL:** https://budget.gamma.tech

To see a complete breakdown of the budget:

1. Click the **"View Summary"** button in the bottom bar
2. A full-screen summary will appear showing:
   - The client name and tier label at the top
   - A table with every selected category, its tier name, and price
   - Any extras that were added
   - Any custom adjustments
   - Subtotal, tax estimate, and grand total
3. From the summary view, you can:
   - Click **"Share Link"** to create a shareable link
   - Click **"Email Budget"** to send it to the client
   - **Print** the page (use your browser's print function — the summary is formatted for printing)
4. Click the **X** or click outside the summary to close it and go back to editing

---

## 8. Sharing a Budget Link

**URL:** https://budget.gamma.tech

To share a budget with a client:

1. Click the **"Share Link"** button (in the bottom bar or from the summary view)
2. The tool will create a **live budget link** (e.g., `https://budget.gamma.tech/b/abc123`)
3. The link is automatically **copied to your clipboard**
4. Paste the link into a text, email, or message and send it to the client

### What happens when a client opens the link

- They see the budget exactly as you set it up — with all your selections, the client name, and the pricing
- They **can adjust selections** — change tiers, add or remove categories, change extras
- Every change they make is **saved automatically** (there's a 2-second delay, then it saves)
- Multiple people can use the same link — if you share it with the client and their builder, both can view and adjust it
- There's no login required for clients

### Important notes about shared links

- Links are **permanent** — once created, they stay active. Don't create throwaway budgets.
- If you open a shared link yourself, you'll see a green banner at the top confirming it's a shared budget
- You can share the same link to multiple people

---

## 9. Emailing a Budget

**URL:** https://budget.gamma.tech

To email a budget directly to a client:

1. Click the **"Email"** button in the bottom bar (or **"Email Budget"** from the summary view)
2. A form will pop up. Fill in:
   - **Recipient Name** — the client's name
   - **Email Address** — where to send it
   - **Subject** — a subject line for the email (pre-filled, but you can edit it)
3. Click **"Send Email"**

### What the client receives

The email includes:
- A professional breakdown table showing all selected categories, tiers, and prices
- The total estimated investment and tier label
- A **"View & Customize Your Budget"** button that links to the live budget

The email comes from **BudgetPlanner@gamma.tech**.

### Limits

There is a limit of **10 emails per hour**. If you hit the limit, wait a bit before sending more. This is to prevent accidental spam.

---

## 10. Admin Dashboard

**URL:** https://budget.gamma.tech/admin

The admin dashboard is where you manage budgets, pricing, and user accounts. You'll need to log in.

**Login credentials:** Stored in 1Password — search for **"Budget Planner Admin"**.

### Budgets Tab

This is the default tab when you log in. It shows a list of all budgets that have been created (through sharing or the admin panel).

For each budget, you can see:
- **Client name** and budget ID
- **Total** estimated investment
- **View count** — how many times the budget link has been opened
- **Version count** — how many times the budget has been saved
- **Last viewed** — when someone last opened the budget

**Click "Details"** on any budget to see:
- Full version history (every time the budget is saved, a new version is created)
- View count and when it was last viewed
- Option to **restore a previous version** if the client changed something you want to undo
- Option to **delete** the budget

You can also **search and filter** budgets using the search bar at the top.

### Categories & Pricing Tab

This is where you view and edit all category pricing that appears on the budget tool.

You can:
- View every category and its tiers
- **Change prices** for any tier
- **Edit tier names and labels**
- **Edit feature lists** and brand names
- **Add or remove tiers** from a category
- **Reset to defaults** (use this with caution — it resets all pricing back to the original values)

**Important: Changes go live immediately.** Both the beta site and the production site share the same database. When you change a price here, it changes everywhere, right away. Double-check before saving.

### Users Tab

Manage who can log in to the admin dashboard:
- Add new admin users
- Change passwords
- Remove admin access

---

## 11. Creating Custom Budgets (Admin)

**URL:** https://budget.gamma.tech/admin

A **custom budget** is a budget where you've tailored the categories and pricing for a specific client. Use this when the standard pricing doesn't fit — for example, a negotiated rate, a project with a specific scope, or when you want to hide categories the client doesn't need.

### When to use it

- A client has negotiated pricing that differs from standard rates
- You want to present only certain categories (hide the rest)
- You need to create a custom category that doesn't exist in the standard list
- You want to lock the home size and pricing so the client can't change them

### Step-by-step: Creating a custom budget

1. Go to **https://budget.gamma.tech/admin**
2. Click the **Budgets** tab
3. Either:
   - Click **"New Budget"** to create a fresh budget from scratch (enter client name, home size, and property type), OR
   - Find an existing budget in the list and click the **gear icon** next to it
4. The **Customize** panel will open

### What you can do in the Customize panel

- **Show/Hide categories** — Uncheck a category to hide it from the client. They won't see it at all.
- **Edit tier pricing** — Change the price for any tier. The price you enter is what the client sees — it won't scale with home size anymore.
- **Enable/disable tiers** — Turn off specific tiers within a category so the client can only choose from the tiers you want.
- **Edit features** — Modify the feature descriptions and brand names for any tier.
- **Add custom categories** — Create entirely new categories with your own name, tiers, prices, and features. These appear alongside the standard categories.

### Saving the customization

When you click **"Save Customization"**, the following happens:

1. **Home size and property type are locked** — The client can no longer change the square footage or switch between Single Family and Condo. The fields will be grayed out.
2. **Pricing becomes fixed** — Prices no longer scale with square footage. What you set is what they see.
3. The budget is marked as "Custom" in the admin dashboard (you'll see a gear icon next to it).

### Sharing the custom budget

After saving the customization:
1. Go back to the **Budgets** tab
2. Click **"Details"** on the budget
3. Copy the budget link
4. Send it to the client — they'll see only the categories and pricing you configured

---

## 12. Tips & Best Practices

1. **Create the budget before the meeting.** Open the Budget Planner, set up a rough budget with the client's name and home size, click "Share Link," and have the link ready to go. It's much smoother than building it from scratch in front of the client.

2. **Use presets as a starting point.** Click "Better" to set everything to the Better tier, then adjust individual categories up or down. It's faster than selecting each one.

3. **Always enter the client name.** It appears on shared budgets and in emails. A budget that says "Smith Residence" looks much more professional than a blank one.

4. **Shared links are permanent.** Don't create throwaway budgets just to test things. Every budget you share lives in the system and shows up in the admin dashboard.

5. **Check the admin dashboard regularly.** You can see which budgets clients are viewing and how many times they've looked at them. This is a great signal for follow-up — if a client has viewed their budget 5 times this week, they're interested.

6. **Use Customize for special pricing.** If a client needs different pricing, use the admin Customize feature rather than telling them to ignore the displayed prices. It looks more professional and prevents confusion.

7. **Walk clients through the tiers.** The Good/Better/Best structure is intuitive, but clients get more value when you explain what changes between tiers — especially for categories like Structured Wiring and Lighting where the differences are significant.

8. **Remember: estimates, not quotes.** The Budget Planner gives ballpark figures for planning purposes. Always clarify to clients that final pricing comes after detailed design and engineering.

---

## 13. Troubleshooting

**Budget shows blank or won't load**
- Refresh the page. If it still doesn't load, try a different browser or clear your cache.

**Can't change the home size or property type**
- This is a **customized budget** with locked fields. The admin who customized it locked the home size and property type. If you need to change them, go to the admin dashboard, open the budget, and re-customize it.

**A category is grayed out and I can't select it**
- Check the dependency rules in [Section 4](#4-special-category-rules):
  - **Wireless Lighting** grays out if you already selected Centralized Lighting (and vice versa)
  - **Designer Keypads** grays out if no lighting system is selected, or if Wireless Lighting is set to Good tier
  - **Invisible Speakers** grays out if Multi-Room Audio hasn't been selected yet

**A specific tier says "N/A" or "Not available"**
- Some tiers are restricted based on other selections. For example, the Bespoke tier of Designer Keypads isn't available with Wireless Lighting — it requires Centralized Lighting.

**Email didn't arrive**
- Ask the client to check their spam/junk folder — emails come from BudgetPlanner@gamma.tech
- There's a limit of 10 emails per hour. If you've been sending a lot, wait a bit.

**Shared link doesn't work**
- Make sure you're using the full URL starting with `https://`
- The link format should be `https://budget.gamma.tech/b/` followed by a short code

**Admin page won't let me log in**
- Check 1Password for the current credentials under "Budget Planner Admin"
- If the password was recently changed, make sure you're using the updated one

**I changed pricing in the admin and it didn't update**
- Changes should take effect immediately. Try refreshing the budget page. If the budget was customized, the custom pricing overrides the default pricing — you'd need to update it through the Customize panel instead.

**Prices seem wrong for the home size**
- Prices scale from a 4,000 sq ft baseline. A 2,500 sq ft home will show lower prices, while a 6,000 sq ft home will show higher prices. Each category scales differently — some categories (like Surround Sound) don't scale at all because the equipment is the same regardless of home size.

---

*Last updated: April 2026*
*Questions? Ask Bradd or reach out to the Gamma Tech team.*
