# QA: Budget Clone, Section Copy, Tier Swap

Scope: beta-only validation for admin budget cloning, copying a category section from one existing budget into another, and swapping adjacent tier definitions inside the customization editor.

## Automated Checks

Run from repo root:

```bash
node --check server.js
node -e "const fs=require('fs'),vm=require('vm');for(const file of ['public/index.html','public/admin.html']){const html=fs.readFileSync(file,'utf8');const scripts=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]);scripts.forEach((s,i)=>new vm.Script(s,{filename:file+':inline-'+(i+1)}));console.log(file,'compiled',scripts.length,'inline scripts');}"
npx playwright test e2e/admin-copy-tools.spec.js --project=chromium
git diff --check -- server.js public/admin.html e2e/admin-copy-tools.spec.js QA-COPY-CLONE-TIER-SWAP.md
```

Expected:

- Server syntax passes.
- Admin/customer inline JavaScript compiles.
- Browser tests pass for clone request payload, section copy, standard tier swap, and custom tier swap.
- Diff check has no whitespace errors.

## Manual Browser QA On Beta

Use `https://budget-beta.gamma.tech/admin`.

### Clone Budget

1. Pick a known customized budget in the admin list.
2. Click `Clone`.
3. Accept the default `Original Name Copy` name or enter a test name.
4. Confirm the new budget appears in the list.
5. Open its customer link.

Expected:

- New budget has a different ID.
- Client/name is the clone name.
- Builder, sqft, home type, selections, extras, modifiers, custom pricing, features, brands, hidden tiers/items, and custom categories match the source.
- View history is empty or new only.
- Version history starts with one pinned `Cloned from ...` entry.
- Clone is active with a fresh expiration date, even if the source was expired.

### Copy One Section Into Another Budget

1. Open the target budget customize modal.
2. In `Copy Section From Another Budget`, choose the source budget.
3. Choose a matching section, for example `Whole-Home WiFi & Networking`.
4. Click `Copy Section`.
5. Inspect the target section before saving.
6. Click `Save Customization`.
7. Reload the target customer link.

Expected:

- The target section is overwritten with source tier labels, prices, features, brands, enabled/disabled tiers, and section visibility.
- Other sections on the target budget are unchanged.
- The copied section persists after saving and reload.
- The customer page reflects the copied values.

### Swap Adjacent Tiers

1. Open any budget customize modal.
2. In a default category, click the up/down swap control between two adjacent tiers.
3. Repeat in a custom category.
4. Save customization and reload.

Expected:

- The two adjacent tier definitions swap completely: label, price, features, brands, and enabled state.
- The tier order remains Good, Standard, Better, Best.
- Non-adjacent tiers are unchanged.
- Disabled/missing tiers can be swapped into place.
- Saved customer page shows the swapped tier content.

### Regression Checks

- Add or edit a tier label with an inch mark, for example `85" Flagship`; it must not truncate.
- Close and reopen customize modal after autosave; copied/swapped draft should restore if not saved.
- Existing budget expiration, status, view history, active browsers, and version changelog still render.
