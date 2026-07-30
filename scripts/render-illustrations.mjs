// Renders every illustration SVG to a PNG for visual review.
//
// Usage:
//   node scripts/render-illustrations.mjs                      # all subjects
//   node scripts/render-illustrations.mjs --subject=chemistry  # one subject
//   node scripts/render-illustrations.mjs <path-to.svg>        # one file
//
// Output: illustration-previews/<subject>/<name>.png plus an index.html
// contact sheet grouping every render by subject. The output directory is
// gitignored — it is a review artefact, not a site asset.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { chromium } from '@playwright/test';

const IMAGE_DIR = 'public/images';
const OUT_DIR = 'illustration-previews';
const MAX_DIMENSION = 1600; // cap viewport so huge viewBoxes stay manageable

function svgFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(svgFiles(full));
    } else if (entry.name.endsWith('.svg')) {
      files.push(full);
    }
  }
  return files;
}

function viewBoxSize(file) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);
  if (!match) return { width: 800, height: 600 };
  return { width: Math.ceil(parseFloat(match[1])), height: Math.ceil(parseFloat(match[2])) };
}

function scaledViewport({ width, height }) {
  const scale = Math.min(1, MAX_DIMENSION / width, MAX_DIMENSION / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const arg = process.argv[2];
let files;
if (arg?.startsWith('--subject=')) {
  const subject = arg.slice('--subject='.length);
  files = svgFiles(path.join(IMAGE_DIR, subject));
} else if (arg) {
  files = [arg];
} else {
  files = svgFiles(IMAGE_DIR);
}

if (files.length === 0) {
  console.error('No SVG files found.');
  process.exit(1);
}

// Subset runs (single file / --subject) overwrite their own PNGs in place and
// leave the rest of the preview tree untouched, so concurrent runs are safe.
// Only a full run rebuilds the whole tree and the contact sheet.
const fullRun = !arg;
if (fullRun) fs.rmSync(OUT_DIR, { recursive: true, force: true });

const browser = await chromium.launch();
const page = await browser.newPage();

let rendered = 0;
for (const file of files) {
  const rel = path.relative(IMAGE_DIR, file);
  const out = path.join(OUT_DIR, rel.replace(/\.svg$/, '.png'));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  await page.setViewportSize(scaledViewport(viewBoxSize(file)));
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await page.locator('svg').screenshot({ path: out });
  rendered++;
}

await browser.close();

if (!fullRun) {
  console.log(`Rendered ${rendered} SVG(s) to ${OUT_DIR}/ (subset run — contact sheet not rebuilt).`);
  process.exit(0);
}

// Contact sheet: one section per subject, filename under each render.
const bySubject = new Map();
for (const file of files) {
  const rel = path.relative(IMAGE_DIR, file).replace(/\.svg$/, '.png');
  const subject = rel.split(path.sep)[0] ?? '';
  if (!bySubject.has(subject)) bySubject.set(subject, []);
  bySubject.get(subject).push(rel);
}

const sections = [...bySubject.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([subject, pngs]) => {
    const figures = pngs
      .sort()
      .map(
        (png) =>
          `    <figure><img src="${png}" loading="lazy"><figcaption>${path.basename(png, '.png')}</figcaption></figure>`
      )
      .join('\n');
    return `  <h2>${subject}</h2>\n  <section>\n${figures}\n  </section>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Illustration previews</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f3f4f6; color: #111827; }
    h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 32px; text-transform: capitalize; }
    section { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
    figure { margin: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
    img { width: 100%; height: auto; display: block; }
    figcaption { font-size: 12px; color: #6b7280; margin-top: 6px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Illustration previews — ${rendered} SVGs (generated ${new Date().toISOString().slice(0, 10)})</h1>
${sections}
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
console.log(`Rendered ${rendered} SVG(s) to ${OUT_DIR}/ — open ${OUT_DIR}/index.html to review.`);
