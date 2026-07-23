#!/usr/bin/env node
/**
 * convert-bbc-to-topics.mjs — Phase 1.5 converter (revised-implementation-plan.md)
 *
 * Transforms scraped BBC Bitesize guides (tools/data/<subject>/<topicSlug>/*.json)
 * into REFERENCE-DRAFT staging files (tools/data/_staging/<subjectId>/<topic-id>.json)
 * driven by a curation map (tools/scripts/bbc-curation-map.json).
 *
 * IMPORTANT: staging files are NOT publishable content. Per user decision (plan §7 /
 * Phase 1.5), BBC text is reference only — an authoring pass rewrites notes in our own
 * voice (CONTENT_STYLE.md) and writes flashcards/questions before anything lands in
 * src/content/data/topics/.
 *
 * Usage:
 *   node scripts/convert-bbc-to-topics.mjs [--only <topic-id>] [--map <path>]
 *                                          [--force] [--list-unmapped]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'tools', 'data');
const OUT_DIR = path.join(DATA_DIR, '_staging');
const APP_TOPICS_DIR = path.join(REPO_ROOT, 'src', 'content', 'data', 'topics');
const DEFAULT_MAP = path.join(SCRIPT_DIR, 'bbc-curation-map.json');

const VALID_SUBJECT_IDS = ['english', 'math', 'biology', 'chemistry', 'physics'];
// tools/data dir name → app subjectId (identity except maths)
const SUBJECT_KEY_TO_ID = { maths: 'math', english: 'english', biology: 'biology', chemistry: 'chemistry', physics: 'physics' };
const ID_PREFIX = { math: 'math-', english: 'eng-', biology: 'bio-', chemistry: 'chem-', physics: 'phys-' };

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { only: null, map: DEFAULT_MAP, force: false, listUnmapped: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--only': opts.only = args[++i]; break;
      case '--map': opts.map = path.resolve(args[++i]); break;
      case '--force': opts.force = true; break;
      case '--list-unmapped': opts.listUnmapped = true; break;
      case '--help':
        console.log('Usage: node convert-bbc-to-topics.mjs [--only <topic-id>] [--map <path>] [--force] [--list-unmapped]');
        process.exit(0);
      default:
        console.error(`Unknown flag: ${args[i]}`); process.exit(1);
    }
  }
  return opts;
}

// ─── Text cleaning ───────────────────────────────────────────────────────────

/** Fix smashed-together heading artifacts from BBC's show/hide toggles. */
function cleanHeading(h) {
  let out = h.replace(/([a-z])(?=[A-Z])/g, '$1 $2'); // "answerHide" → "answer Hide"
  if (/show answer|hide answer|show more|show less/i.test(out)) return 'Worked example';
  out = out.replace(/^(video transcript[\s:]*)+/i, 'Video transcript — ');
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Fix missing spaces at element boundaries ("...discounted.The digit..." → "...discounted. The digit..."). */
function cleanText(t) {
  return t
    .replace(/(\d)∙(\d)/g, '$1.$2')              // BBC decimal bullet: "34∙6" → "34.6"
    .replace(/([a-z][.!?…])(?=\d)/g, '$1 ')       // "unchanged.4" → "unchanged. 4" (decimals "4.5" untouched: digit before the dot)
    .replace(/([.!?…])(?=[A-Z"“])/g, '$1 ')       // "discounted.The" → "discounted. The"
    .replace(/(\d)(?=[A-Z][a-z])/g, '$1 ')        // "the 2This is" → "the 2 This is"
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Markdown rendering ──────────────────────────────────────────────────────

function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return cleanText(block.text || '');
    case 'unordered_list':
      return (block.items || []).map((i) => `- ${cleanText(i)}`).join('\n');
    case 'ordered_list':
      return (block.items || []).map((it, n) => `${n + 1}. ${cleanText(it)}`).join('\n');
    case 'table': {
      const rows = (block.rows || []).map((r) => r.map((c) => cleanText(c)));
      if (!rows.length) return '';
      const header = `| ${rows[0].join(' | ')} |`;
      const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
      const body = rows.slice(1).map((r) => `| ${r.join(' | ')} |`);
      return [header, sep, ...body].join('\n');
    }
    case 'callout':
      return `> ${cleanText(block.text || '')}`;
    default:
      return '';
  }
}

// ─── Map validation ──────────────────────────────────────────────────────────

function validateEntry(entry, existingIds) {
  const errors = [];
  if (!entry.id || typeof entry.id !== 'string') errors.push('missing id');
  if (!VALID_SUBJECT_IDS.includes(entry.subjectId)) errors.push(`bad subjectId "${entry.subjectId}"`);
  if (entry.id && ID_PREFIX[entry.subjectId] && !entry.id.startsWith(ID_PREFIX[entry.subjectId])) {
    errors.push(`id "${entry.id}" does not start with "${ID_PREFIX[entry.subjectId]}"`);
  }
  if (!entry.title) errors.push('missing title');
  if (!entry.description) errors.push('missing description');
  if (entry.stage !== 'ks3') errors.push(`stage must be "ks3" for BBC content, got "${entry.stage}"`);
  if (entry.year !== undefined && ![7, 8, 9].includes(entry.year)) errors.push(`bad year "${entry.year}"`);
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) errors.push('sources must be a non-empty array');
  for (const src of entry.sources || []) {
    if (!SUBJECT_KEY_TO_ID[src.subject]) errors.push(`unknown source subject "${src.subject}"`);
    else if (SUBJECT_KEY_TO_ID[src.subject] !== entry.subjectId) {
      errors.push(`source subject "${src.subject}" does not match subjectId "${entry.subjectId}"`);
    }
    if (!src.topicSlug) errors.push('source missing topicSlug');
  }
  if (existingIds.has(entry.id)) errors.push(`COLLISION: ${entry.id} already exists in src/content/data/topics`);
  return errors;
}

// ─── Guide loading ───────────────────────────────────────────────────────────

function loadGuidesForSource(src) {
  const dir = path.join(DATA_DIR, src.subject, src.topicSlug);
  if (!fs.existsSync(dir)) return { guides: [], missing: `${src.subject}/${src.topicSlug}` };
  const allow = src.guides ? new Set(src.guides) : null;
  const deny = src.excludeGuides ? new Set(src.excludeGuides) : null;
  const guides = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const slug = file.replace(/\.json$/, '');
    if (allow && !allow.has(slug)) continue;
    if (deny && deny.has(slug)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        guides.push({ slug, file: `${src.subject}/${src.topicSlug}/${file}`, data });
      }
    } catch { /* skip unparseable file */ }
  }
  return { guides, missing: null };
}

function collectFlashcardCandidates(guides) {
  const seen = new Set();
  const withDef = [];
  const termOnly = [];
  for (const { data } of guides) {
    for (const section of data.sections) {
      for (const v of section.vocabulary || []) {
        const term = (v.term || '').trim();
        const key = term.toLowerCase();
        if (!term || term.length > 60 || /^[\d\s.,%-]+$/.test(term) || seen.has(key)) continue;
        seen.add(key);
        const def = cleanText(v.definition || '');
        (def ? withDef : termOnly).push({ term, ...(def ? { definition: def } : {}) });
      }
    }
  }
  return [...withDef, ...termOnly].slice(0, 20);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();
  const map = JSON.parse(fs.readFileSync(opts.map, 'utf-8'));
  let entries = map.topics || [];
  if (opts.only) entries = entries.filter((e) => e.id === opts.only);

  // Existing app topic IDs (existing topics always win)
  const existingIds = new Set();
  for (const subjDir of fs.readdirSync(APP_TOPICS_DIR)) {
    const dir = path.join(APP_TOPICS_DIR, subjDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      existingIds.add(f.replace(/\.json$/, ''));
    }
  }

  if (opts.listUnmapped) {
    const mapped = new Set();
    for (const e of map.topics || []) for (const s of e.sources) mapped.add(`${s.subject}/${s.topicSlug}`);
    console.log('BBC topic dirs NOT referenced by the curation map:');
    for (const subj of fs.readdirSync(DATA_DIR).filter((d) => !d.startsWith('_') && !d.startsWith('.'))) {
      const subjDir = path.join(DATA_DIR, subj);
      if (!fs.statSync(subjDir).isDirectory()) continue;
      for (const topicDir of fs.readdirSync(subjDir).sort()) {
        const full = path.join(subjDir, topicDir);
        if (!fs.statSync(full).isDirectory()) continue;
        if (mapped.has(`${subj}/${topicDir}`)) continue;
        const count = fs.readdirSync(full).filter((f) => f.endsWith('.json')).length;
        console.log(`  ${subj}/${topicDir} (${count} guides)`);
      }
    }
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { converted: [], skipped: [], errors: [] };

  for (const entry of entries) {
    const validationErrors = validateEntry(entry, existingIds);
    const hasCollision = validationErrors.some((e) => e.startsWith('COLLISION'));
    const fatal = validationErrors.filter((e) => !e.startsWith('COLLISION'));
    if (fatal.length > 0) {
      report.errors.push({ id: entry.id, errors: fatal });
      continue;
    }
    if (hasCollision && !opts.force) {
      report.skipped.push({ id: entry.id, reason: 'already exists in src/content/data/topics (use --force to override)' });
      continue;
    }

    // Gather guides from all sources
    const allGuides = [];
    const missing = [];
    for (const src of entry.sources) {
      const { guides, missing: m } = loadGuidesForSource(src);
      allGuides.push(...guides);
      if (m) missing.push(m);
    }
    if (missing.length > 0) report.errors.push({ id: entry.id, errors: [`missing source dirs: ${missing.join(', ')}`] });
    if (allGuides.length === 0) {
      report.errors.push({ id: entry.id, errors: ['no usable guides found'] });
      continue;
    }

    // Build reference sections (cleaned, rendered to markdown)
    const referenceSections = [];
    const seenHeadings = new Set();
    for (const { slug, data } of allGuides) {
      for (const section of data.sections) {
        const heading = cleanHeading(section.heading || '');
        const markdown = (section.content || []).map(renderBlock).filter(Boolean).join('\n\n');
        if (!markdown) continue;
        const dedupeKey = `${heading}::${markdown.slice(0, 80)}`;
        if (seenHeadings.has(dedupeKey)) continue;
        seenHeadings.add(dedupeKey);
        referenceSections.push({ heading, markdown, sourceGuide: slug });
      }
    }

    const staging = {
      id: entry.id,
      subjectId: entry.subjectId,
      title: entry.title,
      description: entry.description,
      stage: entry.stage,
      ...(entry.year ? { year: entry.year } : {}),
      status: 'reference-draft',
      generatedAt: new Date().toISOString(),
      sources: allGuides.map(({ slug, file, data }) => ({ guide: slug, file, url: data.url || null, title: data.title || slug })),
      referenceSections,
      flashcardCandidates: collectFlashcardCandidates(allGuides),
    };

    const outDir = path.join(OUT_DIR, entry.subjectId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${entry.id}.json`), JSON.stringify(staging, null, 2));
    report.converted.push({
      id: entry.id,
      guides: allGuides.length,
      sections: referenceSections.length,
      flashcardCandidates: staging.flashcardCandidates.length,
    });
  }

  // ─── Report ───
  console.log('\n═══ Conversion report ═══');
  for (const c of report.converted) {
    console.log(`✅ ${c.id} — ${c.guides} guides, ${c.sections} reference sections, ${c.flashcardCandidates} flashcard candidates`);
  }
  for (const s of report.skipped) console.log(`⏭️  ${s.id} — skipped: ${s.reason}`);
  for (const e of report.errors) console.log(`❌ ${e.id} — ${e.errors.join('; ')}`);
  console.log(`\nStaging output: ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  console.log('REMINDER: staging files are reference drafts — notes must be rewritten in our own voice,');
  console.log('flashcards/questions authored, and validate:content + audit:content must pass before merge.');
}

main();
