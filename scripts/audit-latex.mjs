#!/usr/bin/env node
/**
 * REPORT-ONLY: finds LaTeX command names that have lost their leading backslash.
 *
 * WHY: this damage has happened twice — `math-dp-ai-vectors` etc. on 2026-09-25 (129 sites
 * across 2 topics) and the 2026-09-05 `$$`-in-`replaceAll` incident. The symptom is that
 * KaTeX renders the command NAME as prose: students saw the literal words `sqrt`, `mathbfi`,
 * `overrightarrowAB`, `lambda`, `quad`. Rendered-output checks only catch it if you happen to
 * load the page (and `validate:content` accepts it, because it is valid JSON and valid text).
 *
 * HOW: the command vocabulary is derived from the corpus itself (every `\name` used anywhere),
 * so nothing is hard-coded. A bare word inside a math span that matches that vocabulary is
 * reported, with the three known false-positive classes listed separately rather than silently
 * dropped. It NEVER fails the build — deliberately: it is a triage aid, not a gate. (Making it a
 * gate needs the exclusions below encoded and tested, which is its own decision.)
 *
 * Usage:
 *   npm run audit:latex            # report
 *   npm run audit:latex -- --all   # include the ignored/known-notation hits inline
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/content/data/topics', 'src/content/data/papers'];
const SHOW_IGNORED = process.argv.includes('--all');

// Command NAMES that are also ordinary English words. Inside `\text{...}` bodies they are prose,
// and the corpus legitimately uses some as subscript labels, so they are reported separately.
const ENGLISH = new Set([
  'in', 'to', 'le', 'ge', 'pm', 'mp', 'int', 'log', 'sin', 'cos', 'tan', 'sum', 'prod', 'lim',
  'for', 'and', 'or', 'not', 'over', 'at', 'left', 'right', 'text', 'cases', 'begin', 'end',
  'min', 'max', 'times', 'nP', 'ar', 'det', 'dim', 'ker', 'deg', 'gcd', 'mod', 'box', 'it',
]);

const TEXT_BODY = /\\(?:text|mathrm|operatorname|mathbf)\{(?:[^{}]|\{[^{}]*\})*\}/g;
// Math spans. Display first (its body may legitimately contain `$`, e.g. `\text{($n$ times)}`),
// then inline. This is deliberately permissive: it is a triage aid, not the renderer.
const DISPLAY = /\$\$([\s\S]*?)\$\$/g;
const INLINE = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;

function* walk(o, path_ = '') {
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) yield* walk(o[i], `${path_}[${i}]`);
  } else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) yield* walk(v, `${path_}.${k}`);
  } else if (typeof o === 'string') {
    yield [path_, o];
  }
}

function jsonFiles(root) {
  const out = [];
  const walkDir = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walkDir(full);
      else if (entry.endsWith('.json')) out.push(full);
    }
  };
  if (statSync(root).isDirectory()) walkDir(root);
  return out;
}

const files = ROOTS.flatMap(jsonFiles);

// 1. The corpus's own LaTeX command vocabulary.
const vocabulary = new Set();
for (const file of files) {
  for (const m of readFileSync(file, 'utf8').matchAll(/\\([a-zA-Z]+)/g)) vocabulary.add(m[1]);
}

// 2. Bare command-like words in math-ish text (prose bodies, excluding \text{...} bodies).
const findings = [];
const ignored = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    continue;
  }
  const id = data.id ?? path.basename(file, '.json');
  for (const [field, value] of walk(data)) {
    if (!value.includes('$')) continue;
    const spans = [
      ...[...value.matchAll(DISPLAY)].map((m) => m[1]),
      ...[...value.matchAll(INLINE)].map((m) => m[1]),
    ];
    for (const span of spans) {
      const scan = span.replace(TEXT_BODY, ' ');
      for (const m of scan.matchAll(/(?<![\\A-Za-z])([a-zA-Z]{2,})(?![A-Za-z])/g)) {
        const word = m[1];
        if (!vocabulary.has(word)) continue;
        const context = scan.slice(Math.max(0, m.index - 34), m.index + 26).replace(/\s+/g, ' ');
        const row = { id, field, word, context };
        (ENGLISH.has(word) ? ignored : findings).push(row);
      }
    }
  }
}

const byFile = new Map();
for (const f of findings) {
  const list = byFile.get(f.id) ?? [];
  list.push(f);
  byFile.set(f.id, list);
}

console.log(`audit:latex — bare LaTeX command names (vocabulary: ${vocabulary.size} names from ${files.length} files)`);
if (findings.length === 0) {
  console.log('  no lost backslashes found.');
} else {
  for (const [id, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    const counts = list.reduce((acc, r) => ({ ...acc, [r.word]: (acc[r.word] ?? 0) + 1 }), {});
    console.log(`\n  ${id} — ${list.length} site(s): ${Object.entries(counts).map(([w, n]) => `${w}×${n}`).join(', ')}`);
    for (const r of list.slice(0, 6)) console.log(`      ${r.field}: …${r.context}…`);
    if (list.length > 6) console.log(`      (+${list.length - 6} more)`);
  }
  console.log(
    '\n  REPORT ONLY — this command never fails the build. Triage each hit by hand: a real hit is a\n' +
      '  missing backslash; a false positive is a subscript label, notation, or a prose word.',
  );
}
if (ignored.length > 0) {
  const counts = ignored.reduce((acc, r) => ({ ...acc, [r.word]: (acc[r.word] ?? 0) + 1 }), {});
  console.log(
    `\n  ${ignored.length} hit(s) in the known-benign set (${Object.entries(counts)
      .map(([w, n]) => `${w}×${n}`)
      .join(', ')}) — command names that are also English words.`,
  );
  if (SHOW_IGNORED) for (const r of ignored.slice(0, 20)) console.log(`      ${r.id} ${r.field}: …${r.context}…`);
}
