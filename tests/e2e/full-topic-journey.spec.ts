import { test, expect, type Page } from '@playwright/test';

const SAMPLES: Array<{ subjectId: string; topicId: string; title: string }> = [
  { subjectId: 'math', topicId: 'math-yr7-calculations', title: 'Written Calculations' },
  { subjectId: 'math', topicId: 'math-dp-sequences', title: 'Sequences & Series' },
  { subjectId: 'math', topicId: 'math-yr8-probability-trees', title: 'Probability & Tree Diagrams' },
  { subjectId: 'math', topicId: 'math-yr8-straight-line-graphs', title: 'Straight-Line Graphs' },
  { subjectId: 'biology', topicId: 'bio-microorganisms-1', title: 'Microorganisms & Biotechnology' },
  { subjectId: 'physics', topicId: 'phys-forces-action-1', title: 'Forces in Action' },
  { subjectId: 'biology', topicId: 'bio-cell-1', title: 'Cell Structure & Microscopy' },
  { subjectId: 'chemistry', topicId: 'chem-atomic-1', title: 'Atomic Structure' },
  { subjectId: 'physics', topicId: 'phys-forces-1', title: 'Forces & Motion' },
];

test.setTimeout(120000);

async function completeTopicJourney(page: Page, subjectId: string, topicId: string, title: string) {
  // 1. Subject page -> click Study for the chosen topic
  await page.goto(`/subjects/${subjectId}`);
  await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible();

  const studyLink = page.locator(`a[href="/subjects/${subjectId}/${topicId}/study"]`).filter({ hasText: 'Study' });
  await expect(studyLink).toBeVisible();
  await studyLink.click();
  await page.waitForURL(`/subjects/${subjectId}/${topicId}/study`);

  // 2. Study page renders with action links
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  const flashcardsLink = page.getByRole('link', { name: /Study Flashcards/i });
  const quizLink = page.getByRole('link', { name: /Take Quiz/i });
  await expect(flashcardsLink).toBeVisible();
  await expect(quizLink).toBeVisible();

  // 3. Full flashcard deck
  await flashcardsLink.click();
  await page.waitForURL(`/subjects/${subjectId}/${topicId}/flashcards`);

  const card = page.locator('.card').filter({ hasText: 'Tap to flip' });
  await expect(card).toBeVisible();

  let safety = 0;
  while (safety < 100) {
    await card.click();
    const nextButton = page.getByRole('button').filter({ hasText: /Next|Finish/ });
    await expect(nextButton).toBeVisible();
    const label = (await nextButton.textContent())?.trim() ?? '';
    await nextButton.click();
    if (label === 'Finish') break;
    safety++;
  }

  await expect(page.getByRole('heading', { name: 'Deck Complete!' })).toBeVisible();

  // 4. Move from completed deck to the quiz
  const deckQuizLink = page.getByRole('link', { name: /Take Quiz/i });
  await expect(deckQuizLink).toBeVisible();
  await deckQuizLink.click();
  await page.waitForURL(`/subjects/${subjectId}/${topicId}/quiz`);

  // 5. Answer every question
  safety = 0;
  while (safety < 100) {
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    await expect(choice).toBeVisible();
    await choice.click();

    const nextButton = page.getByRole('button', { name: /Next Question|See Results/ });
    await expect(nextButton).toBeVisible();
    // Use JS click on small viewports where the fixed bottom nav can cover the button.
    await nextButton.evaluate((el) => el.click());

    const completeHeading = page.getByRole('heading', { name: 'Quiz Complete!' });
    if (await completeHeading.isVisible().catch(() => false)) break;
    safety++;
  }

  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
  await expect(page.getByText(/out of/)).toBeVisible();
}

for (const sample of SAMPLES) {
  test(`${sample.subjectId} › ${sample.title}: full clickable journey`, async ({ page }) => {
    await completeTopicJourney(page, sample.subjectId, sample.topicId, sample.title);
  });
}
