import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface TopicInfo {
  subjectId: string;
  topicId: string;
  title: string;
  illustrationCount: number;
}

function discoverTopicsWithIllustrations(): TopicInfo[] {
  const topicsDir = path.join(process.cwd(), 'src/content/data/topics');
  const subjectsPath = path.join(process.cwd(), 'src/content/data/subjects.json');
  const subjects = JSON.parse(fs.readFileSync(subjectsPath, 'utf8')) as Array<{ id: string }>;
  const topics: TopicInfo[] = [];

  for (const subject of subjects) {
    const dir = path.join(topicsDir, subject.id);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const illustrationCount = data.notes.filter((n: { illustration?: unknown }) => n.illustration).length;
      if (illustrationCount > 0) {
        topics.push({
          subjectId: subject.id,
          topicId: data.id,
          title: data.title,
          illustrationCount,
        });
      }
    }
  }

  return topics;
}

const topics = discoverTopicsWithIllustrations();

test.describe.configure({ mode: 'serial' });

test.describe('Study page illustrations', () => {
  for (const topic of topics) {
    test(`${topic.topicId}: ${topic.title} renders ${topic.illustrationCount} illustration(s)`, async ({ page }) => {
      await page.goto(`/subjects/${topic.subjectId}/${topic.topicId}/study`);

      // Wait for the topic heading to ensure the page has rendered
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Study notes should be on the page
      await expect(page.locator('h2').first()).toBeVisible();

      const images = page.locator('figure img[src^="/images/"]');
      await expect(images).toHaveCount(topic.illustrationCount);

      const count = await images.count();
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        await expect(img, `image ${i} is visible`).toBeVisible();

        // Scroll the image into view so lazy-loaded images can start loading
        await img.scrollIntoViewIfNeeded();

        // Wait for the image to actually decode (naturalWidth > 0)
        await expect
          .poll(
            async () => {
              return await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
            },
            { message: `image ${i} failed to load (naturalWidth stayed 0)`, timeout: 10000 }
          )
          .toBeGreaterThan(0);

        const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
        const naturalHeight = await img.evaluate((el) => (el as HTMLImageElement).naturalHeight);
        expect(naturalWidth, `image ${i} failed to load (naturalWidth is 0)`).toBeGreaterThan(0);
        expect(naturalHeight, `image ${i} failed to load (naturalHeight is 0)`).toBeGreaterThan(0);

        // Image must be rendered at a positive size and fit within the viewport width
        const box = await img.boundingBox();
        expect(box, `image ${i} has no bounding box`).not.toBeNull();
        expect(box!.width, `image ${i} has zero rendered width`).toBeGreaterThan(0);
        expect(box!.height, `image ${i} has zero rendered height`).toBeGreaterThan(0);
        expect(
          box!.x + box!.width,
          `image ${i} overflows the right edge of the viewport`
        ).toBeLessThanOrEqual(viewport!.width + 1);
        expect(box!.x, `image ${i} is positioned off the left edge of the viewport`).toBeGreaterThanOrEqual(-1);
      }
    });
  }
});
