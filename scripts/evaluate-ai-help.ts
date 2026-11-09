import { writeFile } from 'node:fs/promises';
import { getContentTopic } from '../src/content/registry.content';
import { getSubject } from '../src/content/registry';
import { getAiHelpProvider } from '../src/lib/ai-help';
import type { AiHelpRequest } from '../src/lib/ai-help/types';

const allowDummy = process.argv.includes('--allow-dummy');
if (process.env.FEEDBACK_PROVIDER === 'dummy' && !allowDummy) {
  throw new Error('Dummy output is not a quality evaluation. Pass --allow-dummy only to test the harness.');
}
const provider = getAiHelpProvider();
const actions = ['simpler', 'hint', 'worked-example', 'why-wrong'] as const;
const subjectIds = process.argv.includes('--all') ? (['math', 'biology', 'english'] as const) : (['math'] as const);
const results: unknown[] = [];

async function main(): Promise<void> {
  for (const subjectId of subjectIds) {
    const meta = getSubject(subjectId)?.topics[0];
    if (!meta) throw new Error(`No topic for ${subjectId}`);
    const topic = getContentTopic(subjectId, meta.id);
    const question = topic?.questions[0];
    if (!topic || !question) throw new Error(`No question for ${meta.id}`);
    for (const action of actions) {
      const request: AiHelpRequest = {
        action,
        subjectId: subjectId as AiHelpRequest['subjectId'],
        topicId: topic.id,
        selectedIndex: (question.correctIndex + 1) % 4,
        question,
      };
      const startedAt = Date.now();
      try {
        const result = await provider.help(request, {
          topicTitle: topic.title,
          year: topic.year,
          notes: topic.notes.map((note) => `${note.heading}: ${note.body}`).join('\n'),
        });
        results.push({
          subjectId,
          topicId: topic.id,
          questionId: question.id,
          correctAnswer: question.choices[question.correctIndex],
          reviewedExplanation: question.explanation,
          action,
          latencyMs: Date.now() - startedAt,
          ...result,
        });
      } catch (error) {
        results.push({ subjectId, topicId: topic.id, questionId: question.id, action, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  const output = `/tmp/octav-ai-help-${allowDummy ? 'dummy-' : ''}evaluation.json`;
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify({ output, evaluations: results.length, failures: results.filter((result) => typeof result === 'object' && result !== null && 'error' in result).length }));
}

void main();
