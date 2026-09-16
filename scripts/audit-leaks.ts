/**
 * Leak gate — does paid content still reach a browser without a session?
 *
 *   npm run audit:leaks            # needs out/  (npm run build:static first)
 *   npm run audit:leaks -- --print=10
 *
 * Plan: docs/premium-content-protection-plan.md §7. Two tiers, because the mixed-review lazy chunk
 * legitimately carries FREE topic text:
 *
 *   HARD       no window unique to a PREMIUM paper may appear anywhere under out/ (html, .txt RSC
 *              twins, .js chunks).
 *   TIGHTENED  the site-wide chunk referenced by out/index.html must contain no topic CONTENT window
 *              and must stay under MAX_SHARED_CHUNK_BYTES — the tripwire for the 4.8 MB regression.
 *
 * Detection is window-based on purpose: a raw grep for a LaTeX-bearing string misses, because the
 * bundle stores `\\dfrac` where the parsed JSON holds `\dfrac`. Windows strip backslashes on BOTH
 * sides first, and a rolling hash keeps the scan linear over ~120 MB of output.
 */
import fs from 'fs';
import path from 'path';

export const WINDOW = 48;
const MAX_SHARED_CHUNK_BYTES = 1024 * 1024;

const ROOT = path.resolve(__dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'src/content/data/topics');
const PAPERS_DIR = path.join(ROOT, 'src/content/data/papers');
const SCANNABLE = new Set(['.html', '.txt', '.js']);

/** Content-bearing fields only. Metadata (title/description/taxonomy) is deliberately excluded:
 *  it is client-safe by design and would otherwise flag the metadata registry itself. */
const CONTENT_KEYS = new Set(['heading', 'body', 'term', 'definition', 'example', 'stem', 'choices', 'explanation', 'modelAnswer', 'markscheme']);

type Json = unknown;

function* contentStrings(value: Json, key: string | null = null): Generator<string> {
  if (typeof value === 'string') {
    if (key !== null && CONTENT_KEYS.has(key)) yield value;
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) yield* contentStrings(item, key);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* contentStrings(v, k);
  }
}

/** Windows are 48-char fragments of backslash-stripped, whitespace-collapsed CONTENT lines. */
export function windowsFromText(text: string, out: Set<string> = new Set()): Set<string> {
  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('\\').join('').replace(/\s+/g, ' ').trim();
    if (line.length >= WINDOW) out.add(line.slice(0, WINDOW));
  }
  return out;
}

/** Documents must be normalised the SAME way as the source, or a LaTeX-bearing leak never matches:
 *  a bundle stores `\\\\dfrac` where the parsed JSON holds `\dfrac`. */
export const normalizeDocument = (text: string): string => text.split('\\').join('');

export function collectWindows(values: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const value of values) windowsFromText(value, out);
  return out;
}

/** Rolling-hash scan: returns the first window found in `text`, or null. Normalisation happens HERE
 *  rather than in the caller, so no call site can forget it and silently report a false "clean". */
export function scanText(rawText: string, windows: Set<string>): string | null {
  const text = normalizeDocument(rawText);
  if (windows.size === 0 || text.length < WINDOW) return null;
  const hashOf = (value: string, start: number): number => {
    let h = 0;
    for (let i = start; i < start + WINDOW; i += 1) h = (Math.imul(h, 31) + value.charCodeAt(i)) | 0;
    return h >>> 0;
  };
  let power = 1;
  for (let i = 1; i < WINDOW; i += 1) power = (Math.imul(power, 31) | 0) >>> 0;
  const byHash = new Map<number, string[]>();
  for (const w of windows) {
    const key = hashOf(w, 0);
    const bucket = byHash.get(key);
    if (bucket) bucket.push(w);
    else byHash.set(key, [w]);
  }
  let h = hashOf(text, 0);
  for (let i = 0; i + WINDOW <= text.length; i += 1) {
    if (i > 0) {
      h = (Math.imul(h - Math.imul(text.charCodeAt(i - 1), power), 31) + text.charCodeAt(i + WINDOW - 1)) >>> 0;
    }
    const bucket = byHash.get(h >>> 0);
    if (bucket) {
      const slice = text.slice(i, i + WINDOW);
      for (const w of bucket) if (w === slice) return w;
    }
  }
  return null;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNABLE.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function readJsonDir(dir: string): { id: string; data: Json }[] {
  const files: { id: string; data: Json }[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...readJsonDir(path.join(dir, entry.name)));
    else if (entry.name.endsWith('.json') && entry.name !== 'order.json') {
      const full = path.join(dir, entry.name);
      files.push({ id: path.relative(ROOT, full), data: JSON.parse(fs.readFileSync(full, 'utf8')) });
    }
  }
  return files;
}

/** Mirrors isFreePaperSet (src/lib/entitlements/exam-access.ts) — no aliased import in a script. */
const isFreeSet = (paperId: string): boolean => {
  const m = /-set-(\d+)$/.exec(paperId);
  return (m ? Number.parseInt(m[1], 10) : 1) <= 1;
};

function main() {
  const args = process.argv.slice(2);
  const outDir = path.resolve(ROOT, args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'out');
  const print = Number(args.find((a) => a.startsWith('--print='))?.slice(8) ?? 5);

  if (!fs.existsSync(outDir)) {
    console.error(`✗ ${path.relative(ROOT, outDir)}/ not found — run \`npm run build:static\` first.`);
    process.exit(1);
  }

  const topics = readJsonDir(TOPICS_DIR);
  const papers = readJsonDir(PAPERS_DIR);
  const freePaperIds = new Set(papers.filter((p) => isFreeSet(path.basename(p.id, '.json'))).map((p) => p.id));

  const freeWindows = collectWindows([
    ...topics.flatMap((t) => [...contentStrings(t.data)]),
    ...papers.filter((p) => freePaperIds.has(p.id)).flatMap((p) => [...contentStrings(p.data)]),
  ]);
  const topicContentWindows = collectWindows(topics.flatMap((t) => [...contentStrings(t.data)]));
  const premiumOnly = collectWindows(
    papers.filter((p) => !freePaperIds.has(p.id)).flatMap((p) => [...contentStrings(p.data)]),
  );
  for (const w of freeWindows) premiumOnly.delete(w);

  const files = walk(outDir);
  const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  console.log(`\nscanning ${files.length} generated files (${(bytes / 1e6).toFixed(1)} MB) under ${path.relative(ROOT, outDir)}/`);
  console.log(`windows: ${premiumOnly.size} premium-only · ${topicContentWindows.size} topic-content · ${freeWindows.size} free-corpus\n`);

  const hits: { file: string; window: string }[] = [];
  for (const file of files) {
    const window = scanText(fs.readFileSync(file, 'utf8'), premiumOnly);
    if (window) hits.push({ file: path.relative(ROOT, file), window });
  }

  const indexHtml = path.join(outDir, 'index.html');
  const sharedProblems: string[] = [];
  const sharedScripts = fs.existsSync(indexHtml)
    ? [...fs.readFileSync(indexHtml, 'utf8').matchAll(/(?:src|href)="\/_next\/static\/chunks\/[^"]+\.js"/g)]
        .map((m) => /\/_next\/static\/chunks\/[^"]+\.js/.exec(m[0])![0])
    : [];
  const shared = [...new Set(sharedScripts)];
  if (shared.length === 0) {
    sharedProblems.push('no chunk referenced by index.html — cannot run the site-wide checks');
  }
  let sharedBytes = 0;
  for (const script of shared) {
    const sharedPath = path.join(outDir, script.replace(/^\//, ''));
    let sharedText: string;
    try {
      sharedText = fs.readFileSync(sharedPath, 'utf8');
    } catch {
      sharedProblems.push(`${script} is referenced by index.html but missing from the build`);
      continue;
    }
    const size = fs.statSync(sharedPath).size;
    sharedBytes += size;
    if (size > MAX_SHARED_CHUNK_BYTES) {
      sharedProblems.push(`${script} is ${(size / 1e6).toFixed(1)} MB (limit ${(MAX_SHARED_CHUNK_BYTES / 1e6).toFixed(1)} MB)`);
    }
    const topicHit = scanText(sharedText, topicContentWindows);
    if (topicHit) sharedProblems.push(`${script} carries topic content: "${topicHit}"`);
  }

  if (hits.length > 0) {
    console.log(`✗ HARD — ${hits.length} generated file(s) carry premium-paper content:`);
    for (const hit of hits.slice(0, print)) console.log(`   ${hit.file}\n     "${hit.window}"`);
    if (hits.length > print) console.log(`   … and ${hits.length - print} more`);
    console.log('');
  } else {
    console.log('✓ HARD — no premium-paper content under out/');
  }
  if (sharedProblems.length === 0) {
    console.log(`✓ TIGHTENED — ${shared.length} chunk(s) loaded by every page (${(sharedBytes / 1e6).toFixed(1)} MB total) carry no topic content\n`);
  } else {
    console.log('✗ TIGHTENED — site-wide chunk:');
    for (const problem of sharedProblems) console.log(`   ${problem}`);
    console.log('');
  }

  if (hits.length > 0 || sharedProblems.length > 0) {
    console.log('see docs/premium-content-protection-plan.md §7\n');
    process.exit(1);
  }
}

if (require.main === module) main();
