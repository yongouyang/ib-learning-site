// Renders the site-wide social card (public/og/og.svg, 1200x630) to
// public/og/og-1200x630.png, the file referenced by SOCIAL_IMAGE in src/lib/seo/site.ts.
// Same mechanism as scripts/generate-icons.mjs — Playwright Chromium is already a dev
// dependency, so no new deps. Run manually when the SVG changes and commit the PNG:
//   node scripts/generate-og-image.mjs
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;

const svg = readFileSync(path.join(root, 'public/og/og.svg'));
const uri = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.setContent(
    `<!doctype html><html><body style="margin:0"><img src="${uri}" width="${WIDTH}" height="${HEIGHT}" style="display:block" alt=""></body></html>`,
  );
  await page.screenshot({ path: path.join(root, 'public/og/og-1200x630.png'), omitBackground: false });
  console.log(`wrote public/og/og-1200x630.png (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
