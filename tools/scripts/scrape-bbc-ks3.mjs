#!/usr/bin/env node

/**
 * BBC Bitesize KS3 Content Scraper (v2 — fixed topic resolution + content extractors)
 *
 * Traverses BBC Bitesize KS3 subject pages, extracts guide URLs with topic context,
 * resolves topic-collection pages to article URLs, then scrapes each guide's full
 * content (text, quizzes, vocabulary).
 *
 * Usage:
 *   node tools/scripts/scrape-bbc-ks3.mjs [--subject maths] [--dry-run] [--resume] [--delay <ms>]
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Output:
 *   tools/data/{subject}/{topic-slug}/{guide-slug}.json
 *   tools/data/_summary.json
 *   tools/data/_url-map.json
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Configuration ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'tools', 'data');
const BASE_URL = 'https://www.bbc.co.uk';

const DEFAULT_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const TOPIC_RESOLVE_DELAY_MS = 1500;

// Known BBC topic-ID → human-readable topic name mappings (stable, verified 2026-07)
// Used as seed — the scraper will visit unknown pages to discover new mappings.
const KNOWN_TOPIC_MAP = {
  // Biology (verified 2026-07-22)
  znyycdm: 'Living organisms',          zf339j6: 'Nutrition, digestion and excretion',
  zvrrd2p: 'Respiration and gas exchange', ztnnb9q: 'Health and disease',
  zybbkqt: 'Reproduction',              znbx2v4: 'Games',
  zxhhvcw: 'Ecosystems and habitats',   zpffr82: 'Inheritance and genetics',
  zhssgk7: 'Humans and the environment', zsg6m39: 'Working scientifically',
  // French (verified 2026-07-22)
  zrrfscw: 'Games',                     zkqgbdm: 'Phonics',
  zjx947h: 'Topics',                    z7t8kmn: 'Grammar',
  // Spanish
  zgfqwnb: 'Phonics',                   zg9mhyc: 'Topics',
  z9fkr2p: 'Grammar',
  // Maths
  zc3d7ty: 'Place value',               zp26n39: 'Positive and negative numbers',
  znmtsbk: 'Operations/Calculations',   zmdqxnb: 'Rounding and estimating',
  // English
  zwpfvwx: 'Literature',
  // History
  z6wg3j6: 'History Detectives game',   zhxmn39: 'The Romans',
  zp6xsbk: 'Anglo-Saxon England',       zshtyrd: 'The Norman Conquest',
  zvhjdp3: 'Medieval England',
  // Geography
  zs6j2v4: 'Planet Planners game',      zm38q6f: 'Geographical skills',
  // Computer Science (verified 2026-07-22) — mapped to parent topic categories
  zp92mp3: 'Computational thinking',    zqqfyrd: 'Computational thinking',
  zxxbgk7: 'Computational thinking',    zttrcdm: 'Computational thinking',
  zpp49j6: 'Computational thinking',    zssk87h: 'Computational thinking',
  z3bq7ty: 'Algorithms',               zcjfyrd: 'Algorithms',
  zgr2mp3: 'Algorithms',               zsf8d2p: 'Algorithms',
  z9nk87h: 'Algorithms',               zg46tfr: 'Algorithms',
  z8jfyrd: 'Algorithms',               zy9thyc: 'Programming',
  zws8d2p: 'Programming',              zcxgr82: 'Programming',
  zqp9kqt: 'Programming',              zts8d2p: 'Programming',
  z3khpv4: 'Programming',              zwmbgk7: 'Programming',
  z2p9kqt: 'Programming',              z26rcdm: 'Data representation',
  zy3q7ty: 'Data representation',      zxb72hv: 'Hardware and software',
  z2m3b9q: 'Hardware and software',    zpkhpv4: 'Hardware and software',
  zc6rcdm: 'Hardware and software',    z8nk87h: 'Internet communication',
  zpfdwmn: 'Internet communication',   z9p9kqt: 'Safety and responsibility',
  z2g2mp3: 'Safety and responsibility', zqh49j6: 'Safety and responsibility',
};

// All KS3 subject pages verified via scraping July 2026
// `archived: true` = outside the project's 5-subject scope (see docs/revised-implementation-plan.md §9).
// Archived subjects are excluded from a default (no --subject) run but can still be
// scraped explicitly with `--subject <key>`; their data lives in tools/data/_archive/.
const SUBJECTS = {
  biology:       { url: '/bitesize/subjects/z4882hv', name: 'Biology',            parent: 'Science' },
  chemistry:     { url: '/bitesize/subjects/znxtyrd', name: 'Chemistry',          parent: 'Science' },
  physics:       { url: '/bitesize/subjects/zh2xsbk', name: 'Physics',            parent: 'Science' },
  maths:         { url: '/bitesize/subjects/zqhs34j', name: 'Maths' },
  english:       { url: '/bitesize/subjects/z3kw2hv', name: 'English' },
  history:       { url: '/bitesize/subjects/zk26n39', name: 'History',            archived: true },
  geography:     { url: '/bitesize/subjects/zrw76sg', name: 'Geography',          archived: true },
  'computer-science': { url: '/bitesize/subjects/zvc9q6f', name: 'Computer Science', archived: true },
  french:        { url: '/bitesize/subjects/zgdqxnb', name: 'French',             parent: 'Modern Foreign Languages', archived: true },
  spanish:       { url: '/bitesize/subjects/zfckjxs', name: 'Spanish',            parent: 'Modern Foreign Languages', archived: true },
  'religious-studies': { url: '/bitesize/subjects/zh3rkqt', name: 'Religious Studies', archived: true },
};

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { subject: null, dryRun: false, resume: false, delay: DEFAULT_DELAY_MS };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--subject': opts.subject = args[++i]; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--resume':  opts.resume = true; break;
      case '--delay':   opts.delay = parseInt(args[++i], 10); break;
      case '--help':
        console.log('Usage: node scrape-bbc-ks3.mjs [--subject <name>] [--dry-run] [--resume] [--delay <ms>]\n');
        console.log('Available subjects:');
        Object.entries(SUBJECTS).forEach(([k, s]) => console.log(`  ${k.padEnd(20)} ${s.name}`));
        process.exit(0);
    }
  }
  return opts;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function isAlreadyScraped(outputPath) {
  try {
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    return data && data.title && data.sections && data.sections.length > 0;
  } catch { return false; }
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const icons = { info: 'ℹ', ok: '✅', warn: '⚠️', err: '❌', prog: '📦' };
  console.log(`[${ts}] ${icons[level] || '•'} ${msg}`);
}

/** Strip protocol + host from a URL, keeping the path */
function toPath(url) {
  return url.replace(/^https?:\/\/[^\/]+/, '');
}

// ─── PHASE 1: Extract Guide URLs + Topic Context from a Subject Page ─────────

async function extractGuideUrls(page, subjectKey) {
  const subject = SUBJECTS[subjectKey];
  const url = `${BASE_URL}${subject.url}`;
  log('info', `Navigating to ${subject.name}: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Flat link scan (handles React-rendered BBC pages reliably).
  // Simultaneously build a topicId→topicName map from topic-page links.
  const result = await page.evaluate(() => {
    const guides = [];          // { url, title, topicName }
    const topicIdMap = {};      // topicHash → topicName
    const topicNames = [];      // unique topic heading strings
    const main = document.querySelector('main, [role="main"]') || document;
    const seenUrls = new Set();

    // 1. Collect all guide/article links (flat scan — most reliable for React SPAs)
    const allLinks = main.querySelectorAll('a[href*="/bitesize/"]');
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';
      if (!seenUrls.has(href) &&
          (href.includes('/articles/') || href.includes('/guides/') || href.includes('/topics/')) &&
          text.length > 0 &&
          !href.includes('/subjects/') && !href.includes('/levels/')) {
        seenUrls.add(href);
        guides.push({ url: href, title: text, topicName: '' });
      }
    }

    // 2. Build topicId→topicName map from topic-page links
    // BBC subject pages have topic cards/links that point to /bitesize/topics/<id>
    // Scan ALL links, find topic-page-only links (no /articles/), use their text as topic name
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      // Only match topic-page links (NOT article links)
      if (!href.includes('/articles/') && !href.includes('/guides/') && href.includes('/topics/')) {
        const topicMatch = href.match(/\/topics\/([a-z0-9]+)/i);
        const text = link.textContent?.trim() || '';
        if (topicMatch && text.length > 1 && text.length < 80) {
          const topicId = topicMatch[1].toLowerCase();
          // Prefer longer text (full topic name) over short labels
          if (!topicIdMap[topicId] || text.length > (topicIdMap[topicId]?.length || 0)) {
            topicIdMap[topicId] = text;
          }
        }
      }
    }
    // Also collect H2/H3 headings as topic-names fallback
    const headings = main.querySelectorAll('h2, h3');
    for (const heading of headings) {
      const headingText = heading.textContent?.trim() || '';
      if (!headingText || headingText.length < 3 || headingText.length > 120) continue;
      if (!topicNames.includes(headingText)) topicNames.push(headingText);
    }

    return { guides, topicNames, topicIdMap };
  });

  // 3. Retroactively assign topicName to each guide by extracting the BBC topic ID from its URL
  //    KNOWN_TOPIC_MAP (manually verified) wins over the DOM-derived map, which is unreliable.
  for (const guide of result.guides) {
    const match = guide.url.match(/\/(?:topics|guides)\/([a-z0-9]+)/i);
    if (match) {
      const tid = match[1].toLowerCase();
      if (KNOWN_TOPIC_MAP[tid]) {
        guide.topicName = KNOWN_TOPIC_MAP[tid];
      } else if (result.topicIdMap[tid]) {
        guide.topicName = result.topicIdMap[tid];
      }
    }
  }

  // 4. Resolve unresolved topic-IDs (check known map first, then visit pages)
  const unresolvedIds = new Set();
  for (const guide of result.guides) {
    if (!guide.topicName) {
      const match = guide.url.match(/\/(?:topics|guides)\/([a-z0-9]+)/i);
      if (match) {
        const tid = match[1].toLowerCase();
        // Check known map first
        if (KNOWN_TOPIC_MAP[tid]) {
          guide.topicName = KNOWN_TOPIC_MAP[tid];
          result.topicIdMap[tid] = KNOWN_TOPIC_MAP[tid];
        } else {
          unresolvedIds.add(tid);
        }
      }
    }
  }

  if (unresolvedIds.size > 0) {
    log('info', `Resolving ${unresolvedIds.size} unknown topic-IDs by visiting topic pages...`);
    for (const tid of unresolvedIds) {
      try {
        const topicPageUrl = `${BASE_URL}/bitesize/topics/${tid}`;
        await page.goto(topicPageUrl, { waitUntil: 'networkidle', timeout: 20000 });
        await sleep(1000);
        const topicTitle = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return h1?.textContent?.trim() || '';
        });
        const is404 = /sorry, we couldn.t find|page not found|404/i.test(topicTitle);
        if (topicTitle && !is404) {
          result.topicIdMap[tid] = topicTitle;
          log('ok', `  ${tid} → "${topicTitle}"`);
        } else if (is404) {
          log('warn', `  ${tid} → topic page is a 404, skipping`);
        } else {
          log('warn', `  ${tid} → no H1 found`);
        }
      } catch (e) {
        log('warn', `  ${tid} → error: ${e.message}`);
      }
      await sleep(TOPIC_RESOLVE_DELAY_MS);
    }
    // Re-assign now that we have the map
    for (const guide of result.guides) {
      if (!guide.topicName) {
        const match = guide.url.match(/\/(?:topics|guides)\/([a-z0-9]+)/i);
        if (match && result.topicIdMap[match[1].toLowerCase()]) {
          guide.topicName = result.topicIdMap[match[1].toLowerCase()];
        }
      }
    }
  }

  log('ok', `Found ${result.guides.length} guide links for ${subject.name} across ${result.topicNames.length} topics`);

  return {
    guides: result.guides,
    topics: result.topicNames,
  };
}

// ─── PHASE 1.5: Resolve Topic-Collection Pages → Article URLs ────────────────

/**
 * For guides whose URL is a topic-collection page (no /articles/ or /guides/),
 * navigate to that page and extract the individual article links.
 */
async function resolveTopicPages(page, guides, delay, summary) {
  const resolved = [];
  let topicPagesResolved = 0;
  let newArticlesFound = 0;

  for (const guide of guides) {
    const pathUrl = toPath(guide.url);
    const isArticle = pathUrl.includes('/articles/');
    const isGuideRevision = pathUrl.includes('/guides/') && pathUrl.includes('/revision/');

    if (isArticle || isGuideRevision) {
      // Already an article-level URL, keep as-is
      resolved.push(guide);
      continue;
    }

    // This is a topic-collection page — resolve it
    topicPagesResolved++;
    const pageUrl = guide.url.startsWith('http') ? guide.url : `${BASE_URL}${guide.url}`;
    log('info', `Resolving topic page: ${guide.title.slice(0, 50)}`);

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(1500);

      const subArticles = await page.evaluate((parentTopicName) => {
        const results = [];
        const main = document.querySelector('main, [role="main"]') || document;
        const links = main.querySelectorAll('a[href*="/bitesize/"]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || '';
          if (href.includes('/articles/') && text.length > 0 &&
              !href.includes('/subjects/') && !href.includes('/levels/')) {
            results.push({ url: href, title: text, topicName: parentTopicName });
          }
        }
        return results;
      }, guide.topicName);

      if (subArticles.length > 0) {
        log('ok', `  → ${subArticles.length} articles found under "${guide.title.slice(0, 40)}"`);
        resolved.push(...subArticles);
        newArticlesFound += subArticles.length;
      } else {
        // No articles found — might be a leaf topic with only /topics/ links; keep original
        log('warn', `  → 0 articles found, keeping original topic link`);
        resolved.push(guide);
      }
    } catch (err) {
      log('err', `  → Failed to resolve: ${err.message}`);
      resolved.push(guide); // keep original
      summary.errors++;
    }

    await sleep(Math.min(delay, TOPIC_RESOLVE_DELAY_MS));
  }

  log('prog', `Topic-page resolution: ${topicPagesResolved} pages resolved → ${newArticlesFound} new article URLs`);
  return { guides: resolved, topicPagesResolved, newArticlesFound };
}

// ─── PHASE 2: Scrape a Single Guide Page ────────────────────────────────────

async function scrapeGuide(page, guideUrl) {
  const fullUrl = guideUrl.startsWith('http') ? guideUrl : `${BASE_URL}${guideUrl}`;
  log('info', `Scraping: ${fullUrl}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('main, [role="main"], article, h1', { timeout: 10000 }).catch(() => {});
      await sleep(1500);

      const content = await page.evaluate(() => {
        // Helper: extract content from a DOM element
        function extractContent(el, items, vocab) {
          const tag = el.tagName;
          const text = el.textContent?.trim() || '';
          const cls = (typeof el.className === 'string') ? el.className : '';
          if (tag === 'P' && text.length > 10) {
            items.push({ type: 'paragraph', text });
          }
          if (tag === 'UL' || tag === 'OL') {
            const liItems = [];
            el.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) liItems.push(t); });
            if (liItems.length) items.push({ type: tag === 'OL' ? 'ordered_list' : 'unordered_list', items: liItems });
          }
          if (tag === 'DIV' && (cls.includes('text-block') || cls.includes('TextWrapper') || cls.includes('RichText'))) {
            el.querySelectorAll('p').forEach((p) => {
              const pt = p.textContent?.trim();
              if (pt && pt.length > 10) items.push({ type: 'paragraph', text: pt });
            });
            el.querySelectorAll('ul, ol').forEach((list) => {
              const liItems = [];
              list.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) liItems.push(t); });
              if (liItems.length) items.push({ type: list.tagName === 'OL' ? 'ordered_list' : 'unordered_list', items: liItems });
            });
          }
          if (cls.includes('callout') || cls.includes('key-fact') || cls.includes('highlight')) {
            items.push({ type: 'callout', text });
          }
          if (tag === 'TABLE') {
            const rows = [];
            el.querySelectorAll('tr').forEach((tr) => {
              const cells = [];
              tr.querySelectorAll('th, td').forEach((td) => { const t = td.textContent?.trim(); if (t) cells.push(t); });
              if (cells.length) rows.push(cells);
            });
            if (rows.length) items.push({ type: 'table', rows });
          }
          el.querySelectorAll('dt').forEach((dt) => {
            const term = dt.textContent?.trim();
            const def = dt.nextElementSibling?.textContent?.trim();
            if (term && def && !vocab.find((v) => v.term === term)) {
              vocab.push({ term, definition: def });
            }
          });
          if (tag === 'P' && text.length > 20) {
            el.querySelectorAll('b, strong').forEach((b) => {
              const term = b.textContent?.trim();
              if (term && term.length > 2 && !vocab.find((v) => v.term === term)) {
                vocab.push({ term, definition: '' });
              }
            });
          }
        }

        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const allH = document.querySelectorAll('h2, h3, h4, [class*="heading"]');

        // --- Key Points ---
        const keyPoints = [];
        for (const h of allH) {
          if (h.textContent?.toLowerCase().includes('key point')) {
            let sib = h.nextElementSibling;
            while (sib && !['H2', 'H3', 'H4'].includes(sib.tagName)) {
              if (sib.tagName === 'UL' || sib.tagName === 'OL') {
                sib.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) keyPoints.push(t); });
                break;
              }
              sib = sib.nextElementSibling;
            }
            break;
          }
        }
        if (keyPoints.length === 0) {
          const kpEl = document.querySelector('[class*="key-point"], [class*="summary"], [data-testid="key-points"]');
          if (kpEl) kpEl.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) keyPoints.push(t); });
        }

        // --- Sections ---
        const sections = [];
        const container = document.querySelector('main, [role="main"], article') || document;
        const headings = container.querySelectorAll('h2, h3, h4');
        const processed = new Set();

        for (const heading of headings) {
          const headingText = heading.textContent?.trim() || '';
          if (!headingText || headingText.length < 2 || headingText.length > 120) continue;
          if (processed.has(headingText)) continue;
          processed.add(headingText);

          const items = [];
          const vocab = [];

          // Strategy 1: sibling walk (works for article pages)
          let el = heading.nextElementSibling;
          while (el && !['H2', 'H3', 'H4'].includes(el.tagName)) {
            extractContent(el, items, vocab);
            el = el.nextElementSibling;
          }

          // Strategy 2: parent-container tree walker (works for revision guide pages)
          if (items.length === 0) {
            let ancestor = heading.parentElement;
            for (let i = 0; i < 4 && ancestor && items.length === 0; i++) {
              let foundHeading = false;
              const expandedDivs = []; // container divs already expanded by extractContent — skip their children
              const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT);
              let node = walker.nextNode();
              while (node) {
                if (node === heading) { foundHeading = true; node = walker.nextNode(); continue; }
                if (!foundHeading) { node = walker.nextNode(); continue; }
                if (['H2', 'H3', 'H4'].includes(node.tagName)) break; // stop at the next heading
                if (expandedDivs.some((d) => d.contains(node))) { node = walker.nextNode(); continue; }
                const nodeCls = (typeof node.className === 'string') ? node.className : '';
                if (node.tagName === 'DIV' && (nodeCls.includes('text-block') || nodeCls.includes('TextWrapper') || nodeCls.includes('RichText'))) {
                  expandedDivs.push(node);
                }
                extractContent(node, items, vocab);
                node = walker.nextNode();
              }
              ancestor = ancestor.parentElement;
            }
          }

          if (items.length > 0 || vocab.length > 0) {
            sections.push({ heading: headingText, content: items, vocabulary: vocab });
          }
        }

        // --- Quiz ---
        const quiz = [];
        for (const h of allH) {
          const ht = h.textContent?.toLowerCase() || '';
          if (ht.includes('quiz') || ht.includes('test your') || ht.includes('check your')) {
            let sib = h.nextElementSibling;
            while (sib && !['H2', 'H3', 'H4'].includes(sib.tagName)) {
              sib.querySelectorAll('fieldset, [class*="question"], [class*="quiz-item"]').forEach((block) => {
                const qText = block.querySelector('legend, [class*="question-text"], p, span')?.textContent?.trim() || '';
                const opts = [];
                block.querySelectorAll('label').forEach((o) => {
                  const t = o.textContent?.trim(); if (t && t.length > 1) opts.push(t);
                });
                if (qText && opts.length >= 2) quiz.push({ question: qText, options: opts });
              });
              sib = sib.nextElementSibling;
            }
            break;
          }
        }
        if (quiz.length === 0) {
          const quizEl = document.querySelector('[class*="quiz"], [class*="test"], [data-testid="quiz"]');
          if (quizEl) {
            quizEl.querySelectorAll('[class*="question"], [class*="quiz-item"], fieldset').forEach((block) => {
              const qText = block.querySelector('legend, [class*="question-text"], p')?.textContent?.trim() || '';
              const opts = [];
              block.querySelectorAll('label, [class*="option"], [class*="answer"]').forEach((o) => {
                const t = o.textContent?.trim(); if (t) opts.push(t);
              });
              if (qText && opts.length >= 2) quiz.push({ question: qText, options: opts });
            });
          }
        }

        return { title, keyPoints, sections, quiz };
      });

      // Post-process title: fix concatenated H1 (BBC revision guides append subtitle)
      if (content.title) {
        // e.g. "Introduction to computational thinkingWhat is computational thinking?"
        // Detect camelCase join: lowercase letter followed by uppercase
        const splitIdx = content.title.search(/[a-z][A-Z]/);
        if (splitIdx >= 0) {
          const mainTitle = content.title.slice(0, splitIdx + 1).trim();
          const subtitle = content.title.slice(splitIdx + 1).trim();
          // If the subtitle looks like a real heading (not noise), prefer it
          if (subtitle.length > 5 && !subtitle.startsWith('Sign in')) {
            content.title = mainTitle;
            // Prepend subtitle as a first section if sections look empty for this guide
            if (content.sections.length === 0) {
              content.sections.unshift({ heading: subtitle, content: [], vocabulary: [] });
            }
          } else {
            content.title = mainTitle;
          }
        }
      }

      // For revision-guide format (/guides/.../revision/1): scrape sibling pages 2-N
      if (fullUrl.includes('/guides/') && fullUrl.includes('/revision/')) {
        const nextPages = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll('a[href*="revision/"]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const m = href.match(/revision\/(\d+)/);
            if (m) links.push({ num: parseInt(m[1]), href });
          });
          return [...new Map(links.map(l => [l.num, l])).values()]
            .filter(l => l.num > 1)
            .sort((a, b) => a.num - b.num);
        });

        for (const next of nextPages.slice(0, 8)) { // max 8 additional pages
          const nextUrl = next.href.startsWith('http') ? next.href : `${BASE_URL}${next.href}`;
          try {
            await page.goto(nextUrl, { waitUntil: 'networkidle', timeout: 20000 });
            await sleep(1000);
            const nextContent = await page.evaluate(() => {
              const sections = [];
              const container = document.querySelector('main, [role=\"main\"], article') || document;
              const headings = container.querySelectorAll('h2, h3, h4');
              const processed = new Set();
              // Find the content after the first real content heading (skip nav)
              for (const heading of headings) {
                const ht = heading.textContent?.trim() || '';
                if (!ht || ht.length < 2 || processed.has(ht)) continue;
                if (['sign in', 'in this guide', 'pages', 'more guides', 'related links', 'where next'].some(w => ht.toLowerCase().includes(w))) continue;
                processed.add(ht);
                const items = [];
                let el = heading.nextElementSibling;
                while (el && !['H2', 'H3', 'H4'].includes(el.tagName)) {
                  const tag = el.tagName;
                  const cls = (typeof el.className === 'string') ? el.className : '';
                  if (tag === 'P') {
                    const t = el.textContent?.trim();
                    if (t && t.length > 10) items.push({ type: 'paragraph', text: t });
                  }
                  if (tag === 'UL' || tag === 'OL') {
                    const liItems = [];
                    el.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) liItems.push(t); });
                    if (liItems.length) items.push({ type: tag === 'OL' ? 'ordered_list' : 'unordered_list', items: liItems });
                  }
                  if (tag === 'DIV' && (cls.includes('text-block') || cls.includes('TextWrapper'))) {
                    el.querySelectorAll('p').forEach((p) => { const t = p.textContent?.trim(); if (t && t.length > 10) items.push({ type: 'paragraph', text: t }); });
                  }
                  el = el.nextElementSibling;
                }
                if (items.length) sections.push({ heading: ht, content: items, vocabulary: [] });
              }
              return sections;
            });
            if (nextContent.length > 0) {
              content.sections.push(...nextContent);
            }
          } catch (e) {
            log('warn', `  Skipping revision page ${nextUrl}: ${e.message}`);
          }
        }
      }
      const noiseWords = ['where next', 'related', 'explore more', 'learn more', 'links', 'explore the bb', 'more on', 'find out more', 'sign in', 'in this guide', 'pages', 'more guides', 'game -', 'play ', 'bitesize', 'up next', 'next page'];
      content.sections = content.sections.filter(
        (s) => !noiseWords.some((w) => s.heading.toLowerCase().includes(w)) && s.content.length > 0
      );

      // Dedupe content blocks within each section (guards against double-push from
      // overlapping extraction strategies and duplicated mobile/desktop DOM)
      for (const s of content.sections) {
        const seen = new Set();
        s.content = s.content.filter((item) => {
          const key = item.type + ':' + (item.text || (item.items || []).join('|') || JSON.stringify(item.rows || []));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      // Drop sections left empty by dedupe
      content.sections = content.sections.filter((s) => s.content.length > 0);

      if (!content.title) throw new Error('No title found');
      return content;

    } catch (err) {
      if (attempt < MAX_RETRIES) {
        log('warn', `Retry ${attempt}/${MAX_RETRIES} for ${guideUrl}: ${err.message}`);
        await sleep(RETRY_DELAY_MS);
      } else {
        log('err', `Failed after ${MAX_RETRIES} attempts: ${guideUrl}`);
        return { title: '', keyPoints: [], sections: [], quiz: [], _error: err.message };
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function determineTopic(guideUrl, guideTitle, topics, guideTopicName) {
  // If Phase 1 captured a topic name from the DOM, use it (most reliable)
  if (guideTopicName && guideTopicName.length > 1) {
    return guideTopicName;
  }
  // Try matching against known topic headings
  for (const topic of topics) {
    if (guideTitle.toLowerCase().includes(topic.toLowerCase()) ||
        guideUrl.toLowerCase().includes(slugify(topic))) {
      return topic;
    }
  }
  // Parse URL path properly (handle full URLs with protocol)
  const pathUrl = toPath(guideUrl).replace('/bitesize/', '');
  const parts = pathUrl.split('/').filter(Boolean);
  // Skip known structural segments, find first meaningful one
  const skipWords = new Set(['topics', 'articles', 'guides', 'revision', 'levels', 'subjects']);
  for (const part of parts) {
    if (!skipWords.has(part) && !/^\d+$/.test(part) && !/^z[a-z0-9]+$/.test(part)) {
      return part;
    }
  }
  return 'uncategorised';
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const subjectsToScrape = opts.subject
    ? { [opts.subject]: SUBJECTS[opts.subject] }
    : Object.fromEntries(Object.entries(SUBJECTS).filter(([, s]) => !s.archived));

  if (opts.subject && !SUBJECTS[opts.subject]) {
    console.error(`Unknown subject: "${opts.subject}"`);
    console.error('Available:', Object.keys(SUBJECTS).join(', '));
    process.exit(1);
  }

  log('prog', `BBC Bitesize KS3 Scraper v2`);
  log('prog', `Mode: ${opts.dryRun ? 'DRY RUN (URLs only)' : 'FULL SCRAPE'}`);
  log('prog', `Subjects: ${Object.keys(subjectsToScrape).join(', ')}`);
  log('prog', `Delay: ${opts.delay}ms | Retries: ${MAX_RETRIES} | Resume: ${opts.resume}`);
  console.log('');

  ensureDir(DATA_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const allGuides = {};
  const summary = {
    startedAt: new Date().toISOString(),
    totalGuides: 0, scraped: 0, skipped: 0, errors: 0,
    topicPagesResolved: 0, articlesFromResolution: 0,
    subjects: {},
  };

  try {
    // ═══ PHASE 1: Collect guide URLs ═══
    log('prog', '═══ PHASE 1: Collecting guide URLs ═══');
    for (const [key, subject] of Object.entries(subjectsToScrape)) {
      const result = await extractGuideUrls(page, key);
      allGuides[key] = result;
      summary.subjects[key] = {
        name: subject.name,
        guideCount: result.guides.length,
        topics: result.topics.slice(0, 15),
      };
      summary.totalGuides += result.guides.length;
      await sleep(opts.delay);
    }

    // ═══ PHASE 1.5: Resolve topic-collection pages to article URLs ═══
    log('prog', '\n═══ PHASE 1.5: Resolving topic pages → article URLs ═══');
    for (const [key, result] of Object.entries(allGuides)) {
      const before = result.guides.length;
      const res = await resolveTopicPages(page, result.guides, opts.delay, summary);
      result.guides = res.guides;
      summary.topicPagesResolved += res.topicPagesResolved;
      summary.articlesFromResolution += res.newArticlesFound;
      const after = result.guides.length;
      if (after !== before) {
        summary.subjects[key].guideCount = after;
        summary.totalGuides += (after - before);
        log('ok', `${SUBJECTS[key].name}: ${before} → ${after} guides after resolution`);
      }
    }

    // Drop game placeholder pages (e.g. "Play KS3 Maths game", "Science game - Atomic Labs") — no scrapable content
    for (const result of Object.values(allGuides)) {
      const before = result.guides.length;
      result.guides = result.guides.filter((g) => !/(^play\b)|(\bgame\s*[-–])/i.test(g.title.trim()));
      const dropped = before - result.guides.length;
      if (dropped > 0) {
        summary.totalGuides -= dropped;
        log('info', `Dropped ${dropped} game links`);
      }
    }

    // Merge with the existing URL map so single-subject runs don't lose other subjects
    const urlMapPath = path.join(DATA_DIR, '_url-map.json');
    let mergedUrlMap = allGuides;
    try {
      const existing = JSON.parse(fs.readFileSync(urlMapPath, 'utf-8'));
      mergedUrlMap = { ...existing, ...allGuides };
    } catch { /* no usable prior map */ }
    fs.writeFileSync(urlMapPath, JSON.stringify(mergedUrlMap, null, 2));
    log('ok', `URL map saved: ${summary.totalGuides} total guides`);

    if (opts.dryRun) {
      log('prog', 'Dry run complete. See tools/data/_url-map.json');
      await browser.close();
      return;
    }

    // ═══ PHASE 2: Scrape each guide ═══
    log('prog', '\n═══ PHASE 2: Scraping guide content ═══');

    for (const [subjectKey, { guides, topics }] of Object.entries(allGuides)) {
      const subjectName = SUBJECTS[subjectKey].name;
      log('prog', `\n── ${subjectName} (${guides.length} guides) ──`);
      const subjStats = { scraped: 0, skipped: 0, errors: 0 };

      for (let i = 0; i < guides.length; i++) {
        const guide = guides[i];
        const topic = determineTopic(guide.url, guide.title, topics, guide.topicName);
        const topicSlug = slugify(topic) || 'uncategorised';
        const guideSlug = slugify(guide.title) || `guide-${i}`;
        const outputDir = path.join(DATA_DIR, subjectKey, topicSlug);
        const outputFile = path.join(outputDir, `${guideSlug}.json`);

        if (opts.resume && isAlreadyScraped(outputFile)) {
          log('warn', `Skipping: ${guide.title.slice(0, 55)}`);
          summary.skipped++;
          subjStats.skipped++;
          continue;
        }

        const progress = `[${i + 1}/${guides.length}]`;
        const content = await scrapeGuide(page, guide.url);
        if (content._error) { summary.errors++; subjStats.errors++; } else { summary.scraped++; subjStats.scraped++; }

        ensureDir(outputDir);
        const output = {
          subject: subjectName,
          subjectKey,
          topic, topicSlug,
          title: guide.title, guideSlug,
          url: guide.url.startsWith('http') ? guide.url : `${BASE_URL}${guide.url}`,
          scrapedAt: new Date().toISOString(),
          ...content,
        };
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        log('ok', `${progress} ${guide.title.slice(0, 55)}`);
        await sleep(opts.delay);
      }

      summary.subjects[subjectKey].lastRun = { ...subjStats, at: new Date().toISOString() };
    }
  } catch (err) {
    log('err', `Fatal: ${err.message}`);
    console.error(err);
  } finally {
    summary.completedAt = new Date().toISOString();
    // Merge with the previous summary so single-subject runs stay cumulative
    const summaryPath = path.join(DATA_DIR, '_summary.json');
    try {
      const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      summary.subjects = { ...(prev.subjects || {}), ...summary.subjects };
    } catch { /* no usable prior summary */ }
    summary.totalGuides = Object.values(summary.subjects).reduce((s, v) => s + (v.guideCount || 0), 0);
    summary.scrapeScope = Object.keys(subjectsToScrape);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    log('prog', `\n═══ Complete ═══`);
    log('prog', `Guides: ${summary.totalGuides} | Scraped: ${summary.scraped} | Skipped: ${summary.skipped} | Errors: ${summary.errors}`);
    if (summary.topicPagesResolved) {
      log('prog', `Topic pages resolved: ${summary.topicPagesResolved} → ${summary.articlesFromResolution} article URLs`);
    }
    log('prog', `Data: ${DATA_DIR}`);
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
