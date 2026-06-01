#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const INCLUDE_BUDGETS = process.argv.includes('--budgets');
const DEFAULT_CATEGORY_SNAPSHOT_KEY = '__defaultCategories';
const DEFAULT_SECTION_SNAPSHOT_KEY = '__defaultSections';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function slugifySectionId(value) {
  const slug = String(value || 'other')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'other';
}

function uniqueSectionId(baseId, usedIds) {
  const base = baseId || 'section';
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeSectionList(categories = [], sections = []) {
  const usedIds = new Set();
  const normalized = [];
  const byName = new Map();
  const byId = new Map();

  (sections || []).forEach((section, index) => {
    const name = String(section?.name || section?.label || section?.id || 'Other').trim() || 'Other';
    const id = uniqueSectionId(slugifySectionId(section?.id || name), usedIds);
    const item = { id, name, order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index };
    normalized.push(item);
    byName.set(name.toLowerCase(), item);
    byId.set(id, item);
  });

  (categories || []).forEach(cat => {
    const explicitId = cat?.section_id || cat?.sectionId;
    if (explicitId && byId.has(explicitId)) return;
    const name = String(cat?.section || cat?.sectionName || explicitId || 'Other').trim() || 'Other';
    if (byName.has(name.toLowerCase())) return;
    const id = uniqueSectionId(slugifySectionId(explicitId || name), usedIds);
    const item = { id, name, order: normalized.length };
    normalized.push(item);
    byName.set(name.toLowerCase(), item);
    byId.set(id, item);
  });

  return normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalizeCategoryList(categories = [], sections = []) {
  const normalizedSections = normalizeSectionList(categories, sections);
  const byName = new Map(normalizedSections.map(section => [section.name.toLowerCase(), section]));
  const byId = new Map(normalizedSections.map(section => [section.id, section]));
  const nextOrderBySection = new Map();

  const normalizedCategories = (categories || []).map((cat, index) => {
    const copy = JSON.parse(JSON.stringify(cat || {}));
    let section = byId.get(copy.section_id || copy.sectionId);
    if (!section) {
      const name = String(copy.section || copy.sectionName || 'Other').trim() || 'Other';
      section = byName.get(name.toLowerCase()) || normalizedSections[0] || { id: 'other', name: 'Other', order: 0 };
    }
    const nextOrder = nextOrderBySection.get(section.id) || 0;
    nextOrderBySection.set(section.id, nextOrder + 1);
    copy.section_id = section.id;
    copy.sectionId = section.id;
    copy.section = section.name;
    if (!Number.isFinite(Number(copy.sortOrder))) copy.sortOrder = nextOrder;
    if (!Number.isFinite(Number(copy.order))) copy.order = index;
    return copy;
  });

  return { categories: normalizedCategories, sections: normalizedSections };
}

function backupFile(name, payload) {
  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

async function main() {
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_KEY'));
  const { data, error } = await supabase.from('category_defaults').select('*').eq('id', 'current').single();
  if (error || !data) throw error || new Error('category_defaults row not found');

  const residential = normalizeCategoryList(data.residential_categories || [], data.residential_sections || []);
  const condo = normalizeCategoryList(data.condo_categories || [], data.condo_sections || []);
  const categoryBackup = backupFile('category-defaults', data);

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Category backup: ${categoryBackup}`);
  console.log(`Residential: ${residential.sections.length} sections, ${residential.categories.length} categories`);
  console.log(`Condo: ${condo.sections.length} sections, ${condo.categories.length} categories`);

  if (APPLY) {
    const { error: updateError } = await supabase.from('category_defaults').upsert({
      id: 'current',
      residential_categories: residential.categories,
      residential_sections: residential.sections,
      residential_extras: data.residential_extras || [],
      condo_categories: condo.categories,
      condo_sections: condo.sections,
      condo_extras: data.condo_extras || [],
      base_sqft: data.base_sqft || 4000,
      updated_at: new Date().toISOString(),
      updated_by: 'section-backfill-script'
    });
    if (updateError) throw updateError;
    console.log('Updated category_defaults.');
  }

  if (!INCLUDE_BUDGETS) {
    console.log('Budget snapshot backfill skipped. Add --budgets to include budget category_config updates.');
    return;
  }

  const { data: budgets, error: budgetError } = await supabase.from('budgets').select('id, category_config');
  if (budgetError) throw budgetError;
  const candidates = (budgets || []).filter(budget =>
    budget.category_config?.[DEFAULT_CATEGORY_SNAPSHOT_KEY] &&
    !budget.category_config?.[DEFAULT_SECTION_SNAPSHOT_KEY]
  );
  const budgetBackup = backupFile('budget-section-snapshot-candidates', candidates);
  console.log(`Budget candidates: ${candidates.length}`);
  console.log(`Budget backup: ${budgetBackup}`);

  if (!APPLY) return;

  for (const budget of candidates) {
    const config = budget.category_config || {};
    const residentialSections = normalizeSectionList(config[DEFAULT_CATEGORY_SNAPSHOT_KEY]?.residential || []);
    const condoSections = normalizeSectionList(config[DEFAULT_CATEGORY_SNAPSHOT_KEY]?.condo || []);
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        category_config: {
          ...config,
          [DEFAULT_SECTION_SNAPSHOT_KEY]: {
            residential: residentialSections,
            condo: condoSections
          }
        }
      })
      .eq('id', budget.id);
    if (updateError) throw updateError;
  }
  console.log(`Updated ${candidates.length} budget snapshots.`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
