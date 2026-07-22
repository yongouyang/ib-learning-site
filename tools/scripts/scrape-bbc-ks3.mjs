#!/usr/bin/env node

/**
 * BBC Bitesize KS3 Content Scraper
 *
 * Traverses BBC Bitesize KS3 subject pages, extracts guide URLs,
 * then scrapes each guide's full content (text, quizzes, vocabulary).
 *
 * Usage:
 *   node tools/scripts/scrape-bbc-ks3.mjs [--subject maths] [--dry-run] [--resume]
 *
 * Options:
 *   --subject <name>   Scrape only one subject (e.g., "biology", "maths")
 *   --dry-run          Collect guide URLs only, don't scrape content
 *   --resume           Skip guides already saved in tools/data/
 *   --delay <ms>       Delay between requests in ms (default: 2500)
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

// All KS3 subject pages verified via scraping July 2026
const SUBJECTS = {
  biology:       { url: '/bitesize/subjects/z4882hv', name: 'Biology',            parent: 'Science' },
  maths:         { url: '/bitesize/subjects/zqhs34j', name: 'Maths' },
  english:       { url: '/bitesize/subjects/z3kw2hv', name: 'English' },
  history:       { url: '/bitesize/subjects/zk26n39', name: 'History' },
  geography:     { url: '/bitesize/subjects/zrw76sg', name: 'Geography' },
  'computer-science': { url: '/bitesize/subjects/zvc9q6f', name: 'Computer Science' },
  french:        { url: '/bitesize/subjects/zgdqxnb', name: 'French',             parent: 'Modern Foreign Languages' },
  spanish:       { url: '/bitesize/subjects/zfckjxs', name: 'Spanish',            parent: 'Modern Foreign Languages' },
  'religious-studies': { url: '/bitesize/subjects/zh3rkqt', name: 'Religious Studies' },
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

// ─── PHASE 1: Extract Guide URLs from a Subject Page ─────────────────────────

async function extractGuideUrls(page, subjectKey) {
  const subject = SUBJECTS[subjectKey];
  const url = `${BASE_URL}${subject.url}`;
  log('info', `Navigating to ${subject.name}: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const guides = await page.evaluate(() => {
    const results = [];
    const main = document.querySelector('main, [role="main"]') || document;
    const links = main.querySelectorAll('a[href*="/bitesize/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';
      if ((href.includes('/articles/') || href.includes('/guides/') || href.includes('/topics/')) &&
          text.length > 0 && !href.includes('/subjects/') && !href.includes('/levels/')) {
        if (!results.find((r) => r.url === href)) {
          results.push({ url: href, title: text });
        }
      }
    }
    return results;
  });

  log('ok', `Found ${guides.length} guide links for ${subject.name}`);

  const topics = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('h2, h3').forEach((h) => {
      const t = h.textContent?.trim();
      if (t && t.length > 3 && t.length < 80) results.push(t);
    });
    return results;
  });

  return { guides, topics };
}

// ─── PHASE 2: Scrape a Single Guide Page ────────────────────────────────────

async function scrapeGuide(page, guideUrl, subjectKey) {
  const fullUrl = guideUrl.startsWith('http') ? guideUrl : `${BASE_URL}${guideUrl}`;
  log('info', `Scraping: ${fullUrl}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for React to render the article content
      await page.waitForSelector('main, [role="main"], article, h1', { timeout: 10000 }).catch(() => {});
      await sleep(1500);  // Extra wait for React hydration

      const content = await page.evaluate(() => {
        // ── Title ──
        const title = document.querySelector('h1')?.textContent?.trim() || '';

        // ── Key Points (summary bullets at top) ──
        const keyPoints = [];
        const kpEl = document.querySelector('[class*="key-point"], [class*="summary"], [data-testid="key-points"]');
        if (kpEl) kpEl.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) keyPoints.push(t); });

        // ── Sections (headings + content) ──
        const sections = [];
        const container = document.querySelector('main, [role="main"], article') || document;
        const headings = container.querySelectorAll('h2, h3, h4');
        const processed = new Set();

        for (const heading of headings) {
          const headingText = heading.textContent?.trim() || '';
          if (!headingText || headingText.length < 2 || headingText.length > 120) continue;
          if (processed.has(headingText)) continue;
          processed.add(headingText);

          const contentItems = [];
          const vocabItems = [];
          let el = heading.nextElementSibling;

          while (el && !['H2', 'H3', 'H4'].includes(el.tagName)) {
            const tag = el.tagName;
            const text = el.textContent?.trim() || '';
            const cls = (typeof el.className === 'string') ? el.className : '';

            if (tag === 'P' && text.length > 10) {
              contentItems.push({ type: 'paragraph', text });
            }
            if (tag === 'UL' || tag === 'OL') {
              const items = [];
              el.querySelectorAll('li').forEach((li) => { const t = li.textContent?.trim(); if (t) items.push(t); });
              if (items.length) contentItems.push({ type: tag === 'OL' ? 'ordered_list' : 'unordered_list', items });
            }
            if (cls.includes('callout') || cls.includes('key-fact') || cls.includes('highlight')) {
              contentItems.push({ type: 'callout', text });
            }
            if (cls.includes('glossary') || cls.includes('vocab')) {
              el.querySelectorAll('dt, [class*="term"]').forEach((dt) => {
                const term = dt.textContent?.trim();
                const def = dt.nextElementSibling?.textContent?.trim();
                if (term && def) vocabItems.push({ term, definition: def });
              });
            }
            el = el.nextElementSibling;
          }

          if (contentItems.length > 0 || vocabItems.length > 0) {
            sections.push({ heading: headingText, content: contentItems, vocabulary: vocabItems });
          }
        }

        // ── Quiz Questions ──
        const quiz = [];
        const quizSection = document.querySelector('[class*="quiz"], [class*="test"], [data-testid="quiz"]');
        if (quizSection) {
          quizSection.querySelectorAll('[class*="question"], [class*="quiz-item"], fieldset').forEach((block) => {
            const qText = block.querySelector('legend, [class*="question-text"], p')?.textContent?.trim() || '';
            const opts = [];
            block.querySelectorAll('label, [class*="option"], [class*="answer"]').forEach((o) => {
              const t = o.textContent?.trim(); if (t) opts.push(t);
            });
            if (qText && opts.length >= 2) quiz.push({ question: qText, options: opts });
          });
        }

        return { title, keyPoints, sections, quiz };
      });

      // Filter out navigation/footer sections
      const noiseWords = ['where next', 'related', 'explore more', 'learn more', 'links', 'explore the bb'];
      content.sections = content.sections.filter(
        (s) => !noiseWords.some((w) => s.heading.toLowerCase().includes(w)) && s.content.length > 0
      );

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

function determineTopic(guideUrl, guideTitle, topics) {
  for (const topic of topics) {
    if (guideTitle.toLowerCase().includes(topic.toLowerCase()) ||
        guideUrl.toLowerCase().includes(slugify(topic))) {
      return topic;
    }
  }
  const parts = guideUrl.replace('/bitesize/', '').split('/');
  return parts[0] || 'uncategorised';
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const subjectsToScrape = opts.subject
    ? { [opts.subject]: SUBJECTS[opts.subject] }
    : SUBJECTS;

  if (opts.subject && !SUBJECTS[opts.subject]) {
    console.error(`Unknown subject: "${opts.subject}"`);
    console.error('Available:', Object.keys(SUBJECTS).join(', '));
    process.exit(1);
  }

  log('prog', `BBC Bitesize KS3 Scraper`);
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

    fs.writeFileSync(path.join(DATA_DIR, '_url-map.json'), JSON.stringify(allGuides, null, 2));
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

      for (let i = 0; i < guides.length; i++) {
        const guide = guides[i];
        const topic = determineTopic(guide.url, guide.title, topics);
        const topicSlug = slugify(topic) || 'uncategorised';
        const guideSlug = slugify(guide.title) || `guide-${i}`;
        const outputDir = path.join(DATA_DIR, subjectKey, topicSlug);
        const outputFile = path.join(outputDir, `${guideSlug}.json`);

        if (opts.resume && isAlreadyScraped(outputFile)) {
          log('warn', `Skipping: ${guide.title.slice(0, 55)}`);
          summary.skipped++;
          continue;
        }

        const progress = `[${i + 1}/${guides.length}]`;
        const content = await scrapeGuide(page, guide.url, subjectKey);
        if (content._error) { summary.errors++; } else { summary.scraped++; }

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
    }
  } catch (err) {
    log('err', `Fatal: ${err.message}`);
    console.error(err);
  } finally {
    summary.completedAt = new Date().toISOString();
    summary.totalGuides = Object.values(allGuides).reduce((s, v) => s + v.guides.length, 0);
    fs.writeFileSync(path.join(DATA_DIR, '_summary.json'), JSON.stringify(summary, null, 2));
    log('prog', `\n═══ Complete ═══`);
    log('prog', `Guides: ${summary.totalGuides} | Scraped: ${summary.scraped} | Skipped: ${summary.skipped} | Errors: ${summary.errors}`);
    log('prog', `Data: ${DATA_DIR}`);
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
