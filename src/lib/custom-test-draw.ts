import { getAllContentTopics } from '@/content/registry.content';
import type { CustomTestSettings } from './custom-test';
import { materializeTemplates } from './generators';
import type { MixedReviewQuestion } from './mixed-review';
import { orderQuestionsByDifficulty, seededShuffle } from './quiz-utils';

export function drawCustomTest(
  settings: Omit<CustomTestSettings, 'count'> & { count: number },
  templateVariants = 1
): MixedReviewQuestion[] {
  const wanted = new Set(settings.topicIds);
  const topics = getAllContentTopics().filter((topic) => wanted.has(topic.id));
  const perTopic = topics.map((topic) => {
    const generated = Array.from({ length: templateVariants }, (_, index) =>
      materializeTemplates(topic, templateVariants === 1 ? settings.seed : `${settings.seed}:candidate-${index}`)
    ).flat();
    const questions = [...topic.questions, ...generated].filter((question) =>
      settings.difficulty === 'all' || (question.difficulty ?? 'medium') === settings.difficulty
    );
    return seededShuffle(questions, `${settings.seed}:${topic.id}`).map((question): MixedReviewQuestion => ({
      question,
      topicId: topic.id,
      subjectId: topic.subjectId,
      topicTitle: topic.title,
    }));
  });

  const picked: MixedReviewQuestion[] = [];
  for (let round = 0; picked.length < settings.count; round++) {
    let added = false;
    for (let index = 0; index < perTopic.length && picked.length < settings.count; index++) {
      const topicIndex = (index + round) % perTopic.length;
      const question = perTopic[topicIndex][round];
      if (question) {
        picked.push(question);
        added = true;
      }
    }
    if (!added) break;
  }

  return orderQuestionsByDifficulty(
    picked.map((entry) => ({ ...entry, difficulty: entry.question.difficulty })),
    settings.seed
  );
}
