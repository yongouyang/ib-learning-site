import { test, expect, type Page } from '@playwright/test';

async function installSpeechDummy(page: Page, shouldFail = false) {
  await page.addInitScript((fail) => {
    const spoken: Array<{ text: string; lang: string; rate: number }> = [];
    Object.assign(window, { __spokenUtterances: spoken });

    class TestUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: TestUtterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: () => {},
        getVoices: () => [{ lang: 'de-DE' }, { lang: 'zh-CN' }],
        speak: (utterance: { text: string; lang: string; rate: number; onerror: ((event: { error: string }) => void) | null }) => {
          if (fail) utterance.onerror?.({ error: 'not-allowed' });
          else spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
        },
      },
    });
  }, shouldFail);
}

async function spokenUtterances(page: Page) {
  return page.evaluate(() => (window as unknown as {
    __spokenUtterances: Array<{ text: string; lang: string; rate: number }>;
  }).__spokenUtterances);
}

test.describe('Language pronunciation', () => {
  test('plays and stops a German flashcard without flipping it', async ({ page }) => {
    await installSpeechDummy(page);
    await page.goto('/subjects/german/germ-yr7-greetings-basics/flashcards');

    const listen = page.getByRole('button', { name: 'Listen to Guten Tag' });
    await expect(listen).toBeVisible();
    const box = await listen.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await listen.click();

    await expect(page.getByRole('button', { name: 'Stop Guten Tag' })).toBeVisible();
    expect(await spokenUtterances(page)).toEqual([{ text: 'Guten Tag', lang: 'de-DE', rate: 0.9 }]);
    await expect(page.getByRole('heading', { name: 'Guten Tag' })).toBeVisible();
    await expect(page.getByText('Good day / hello', { exact: false })).toHaveCount(0);

    await page.getByRole('button', { name: 'Stop Guten Tag' }).click();
    await expect(page.getByRole('button', { name: 'Listen to Guten Tag' })).toBeVisible();
    await page.getByRole('button', { name: 'Flip card' }).click();
    await expect(page.getByText('Good day / hello', { exact: false })).toBeVisible();
    expect(await spokenUtterances(page)).toHaveLength(1);
  });

  test('speaks only the Chinese characters with a Mandarin voice', async ({ page }) => {
    await installSpeechDummy(page);
    await page.goto('/subjects/chinese/chin-yr7-greetings-names/flashcards');

    await expect(page.getByRole('heading', { name: '你好 nǐ hǎo' })).toBeVisible();
    await page.getByRole('button', { name: 'Listen to 你好' }).click();
    expect(await spokenUtterances(page)).toEqual([{ text: '你好', lang: 'zh-CN', rate: 0.9 }]);

    await page.goto('/subjects/math/math-yr7-calculations/flashcards');
    await expect(page.getByRole('button', { name: /^(?:Listen to|Stop) / })).toHaveCount(0);
  });

  test('reports a playback failure and allows a retry', async ({ page }) => {
    await installSpeechDummy(page, true);
    await page.goto('/subjects/german/germ-yr7-greetings-basics/flashcards');

    const error = page.getByRole('alert').filter({ hasText: 'Audio is unavailable on this device.' });
    await page.getByRole('button', { name: 'Listen to Guten Tag' }).click();
    await expect(error).toHaveText('Audio is unavailable on this device. Please try again.');
    const errorBox = await error.boundingBox();
    expect(errorBox?.x).toBeGreaterThanOrEqual(0);
    expect((errorBox?.x ?? 0) + (errorBox?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page.getByRole('button', { name: 'Listen to Guten Tag' })).toBeVisible();
    expect(await spokenUtterances(page)).toHaveLength(0);

    await page.getByRole('button', { name: 'Listen to Guten Tag' }).click();
    await expect(error).toHaveCount(1);

    await page.goto('/subjects/german/germ-yr7-greetings-basics/vocabulary-quiz');
    const input = page.getByRole('textbox', { name: 'Type the full German word or phrase' });
    const inputWidth = (await input.boundingBox())!.width;
    await input.fill('Woher kommst du?');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: 'Listen to Woher kommst du?' }).click();
    await expect(error).toBeVisible();
    expect((await input.boundingBox())!.width).toBeCloseTo(inputWidth, 0);
    const quizErrorBox = await error.boundingBox();
    expect(quizErrorBox?.x).toBeGreaterThanOrEqual(0);
    expect((quizErrorBox?.x ?? 0) + (quizErrorBox?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('offers German pronunciation after a typed vocabulary answer', async ({ page }) => {
    await installSpeechDummy(page);
    await page.goto('/subjects/german/germ-yr7-greetings-basics/vocabulary-quiz');

    await expect(page.getByRole('button', { name: /^(?:Listen to|Stop) / })).toHaveCount(0);
    await page.getByRole('textbox').fill('Woher kommst du?');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: 'Listen to Woher kommst du?' }).click();
    expect(await spokenUtterances(page)).toEqual([{ text: 'Woher kommst du?', lang: 'de-DE', rate: 0.9 }]);

    await page.getByRole('button', { name: 'Next Question' }).evaluate((element) => (element as HTMLElement).click());
    await expect(page.getByRole('button', { name: 'Next Question' })).toHaveCount(0);
    await expect(page.locator('main').getByRole('button', { name: /^(?:Listen to|Stop) / })).toHaveCount(0);
    expect(await spokenUtterances(page)).toHaveLength(1);
  });
});
