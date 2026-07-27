// Regenerates the PWA PNG icons from public/icons/icon.svg by screenshotting it
// with Playwright Chromium (already a dev dependency — no new deps).
// Run manually whenever the SVG changes and commit the outputs:
//   node scripts/generate-icons.mjs
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'public/icons/icon.svg'));
const svgDataUri = `data:image/svg+xml;base64,${svg.toString('base64')}`;

// The SVG is full-bleed with the monogram inside the 80% safe zone, so the same
// artwork serves both "any" and "maskable" purposes; apple-touch-icon is opaque.
const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { name, size } of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0"><img src="${svgDataUri}" width="${size}" height="${size}" style="display:block" alt=""></body></html>`,
    );
    await page.screenshot({
      path: path.join(root, 'public/icons', name),
      omitBackground: false,
    });
    console.log(`wrote public/icons/${name} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
