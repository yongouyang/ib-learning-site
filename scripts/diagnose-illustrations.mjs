import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const IMAGE_DIR = 'public/images';
const MARGIN = 2;

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

async function diagnose(file, page) {
  const content = fs.readFileSync(file, 'utf8');
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }</style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
  await page.setContent(html, { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (!svg) return { width: 0, height: 0, texts: [] };
    const vb = svg.viewBox.baseVal;
    const width = vb.width || 800;
    const height = vb.height || 600;
    svg.style.width = width + 'px';
    svg.style.height = height + 'px';
    svg.style.display = 'block';

    const svgRect = svg.getBoundingClientRect();
    const scaleX = width / svgRect.width;
    const scaleY = height / svgRect.height;

    const boxes = [];
    const collect = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNode(node);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const parent = node.parentElement;
          const fontSize = parent ? parseFloat(window.getComputedStyle(parent).fontSize) || 12 : 12;
          boxes.push({
            text: (node.textContent || '').trim().slice(0, 50),
            x: (rect.left - svgRect.left) * scaleX,
            y: (rect.top - svgRect.top) * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY,
            fontSize,
          });
        }
      } else {
        Array.from(node.childNodes).forEach((child) => collect(child));
      }
    };
    Array.from(svg.childNodes).forEach((child) => collect(child));

    return { width, height, texts: boxes };
  });

  // Group vertically-stacked label+sublabel pairs so they are not reported as overlapping each other.
  const groups = new Array(result.texts.length).fill(-1);
  let nextGroup = 0;
  for (let i = 0; i < result.texts.length; i++) {
    if (groups[i] !== -1) continue;
    groups[i] = nextGroup;
    const a = result.texts[i];
    const aCx = a.x + a.width / 2;
    for (let j = i + 1; j < result.texts.length; j++) {
      if (groups[j] !== -1) continue;
      const b = result.texts[j];
      const bCx = b.x + b.width / 2;
      const hClose = Math.abs(aCx - bCx) < Math.max(a.width, b.width) * 0.6;
      const vClose =
        Math.abs(a.y + a.height - b.y) < Math.max(a.height, b.height) * 1.5 ||
        Math.abs(b.y + b.height - a.y) < Math.max(a.height, b.height) * 1.5;
      if (hClose && vClose) {
        groups[j] = nextGroup;
      }
    }
    nextGroup++;
  }

  const outOfBounds = [];
  for (const t of result.texts) {
    if (
      t.x < -1 ||
      t.y < -1 ||
      t.x + t.width > result.width + 1 ||
      t.y + t.height > result.height + 1
    ) {
      outOfBounds.push(
        `"${t.text}" at (${t.x.toFixed(1)},${t.y.toFixed(1)}) size ${t.width.toFixed(1)}x${t.height.toFixed(1)}`
      );
    }
  }

  const overlaps = [];
  for (let i = 0; i < result.texts.length; i++) {
    const a = result.texts[i];
    for (let j = i + 1; j < result.texts.length; j++) {
      const b = result.texts[j];
      if (groups[i] === groups[j]) continue;
      if (
        a.x < b.x + b.width + MARGIN &&
        a.x + a.width + MARGIN > b.x &&
        a.y < b.y + b.height + MARGIN &&
        a.y + a.height + MARGIN > b.y
      ) {
        overlaps.push(`"${a.text}" overlaps "${b.text}"`);
      }
    }
  }

  return { file, outOfBounds, overlaps };
}

(async () => {
  const arg = process.argv[2];
  const files = arg ? [arg] : svgFiles(IMAGE_DIR);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const issues = [];
  for (const file of files) {
    const issue = await diagnose(file, page);
    if (issue.outOfBounds.length || issue.overlaps.length) {
      issues.push(issue);
    }
  }

  await browser.close();

  if (issues.length === 0) {
    console.log('No text overlap or out-of-bounds issues detected.');
    process.exit(0);
  }

  console.log(`Found issues in ${issues.length} SVG(s):\n`);
  for (const issue of issues) {
    console.log(issue.file);
    if (issue.outOfBounds.length) {
      console.log('  Out of bounds:');
      for (const line of issue.outOfBounds) console.log('    - ' + line);
    }
    if (issue.overlaps.length) {
      console.log('  Overlaps:');
      for (const line of issue.overlaps) console.log('    - ' + line);
    }
    console.log('');
  }
  process.exit(1);
})();
