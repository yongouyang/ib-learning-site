import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.UX_BASE_URL ?? 'http://localhost:3100';
const out = path.resolve('ux-screenshots/revision-funnel');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const question = {
  id: 'angles-q1', stem: 'Which angle is reflex?', choices: ['150°', '90°', '200°', '45°'],
  correctIndex: 2, explanation: 'A reflex angle is between 180° and 360°.', difficulty: 'easy', variantOf: 'angle-types',
};

async function seedMistake(page, theme) {
  await page.goto(`${base}/`);
  await page.evaluate(({ q, theme }) => {
    localStorage.setItem('iblearn-theme', theme);
    localStorage.setItem('iblearn_progress', JSON.stringify({
      version: 2,
      userProgress: { totalStars: 0, currentStreakDays: 1, lastStudyDate: '2026-11-09' },
      topicProgress: {
        'math:math-yr7-angles': {
          topicId: 'math-yr7-angles', subjectId: 'math', topicTitle: 'Angles', subjectTitle: 'Math',
          attempts: [{ date: '2026-11-09T10:00:00.000Z', correctCount: 0, totalCount: 1, questionResults: [{ questionId: q.id, correct: false, selectedIndex: 0, question: q }] }],
        },
      },
      examResults: [], ladderProgress: {}, flashcardProgress: {},
    }));
  }, { q: question, theme });
}

for (const width of [375, 1280]) {
  for (const theme of ['light', 'dark']) {
    const label = `${width === 375 ? 'mobile' : 'desktop'}-${theme}`;
    const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await seedMistake(page, theme);
    await page.goto(`${base}/mistakes`);
    await page.getByRole('button', { name: 'Print revision sheet' }).waitFor();
    await page.screenshot({ path: path.join(out, `mistakes-${label}.png`), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    await page.locator('.revision-sheet').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(out, `revision-sheet-${label}.png`), fullPage: true });
    await page.emulateMedia({ media: 'screen' });

    await page.goto(`${base}/login`);
    const email = `ux-${label}-${Date.now()}@example.com`;
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await page.waitForURL(`${base}/`);
    await page.goto(`${base}/subjects/math/math-yr7-calculations/quiz`);
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    await choice.waitFor({ state: 'visible' });
    await choice.click();
    await page.getByRole('button', { name: 'Explain differently' }).click();
    await page.getByText(/Dummy AI help for simpler/).waitFor();
    await page.screenshot({ path: path.join(out, `ai-help-${label}.png`), fullPage: true });
    await context.close();
  }
}
await browser.close();
console.log(`UX screenshots written to ${out}`);
