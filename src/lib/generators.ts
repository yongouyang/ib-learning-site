import type { Question, Topic } from '@/content/types';
import { getGenerator } from '@/content/generators';
import { createRng } from './quiz-utils';

// Question-template engine (docs/question-variations-plan.md, Phase 2).
// Each topic `templates` entry produces ONE question instance per session
// (D8), deterministic per (topic, seed) so SSR and the client agree; the
// session reseed ("New Question Set") redraws fresh values.

/** ID of a template instance — matches templatePlaceholders in mastery.ts. */
export function templateQuestionId(index: number, generatorId: string): string {
  return `tpl:${index}:${generatorId}`;
}

export function materializeTemplates(topic: Topic, seed: string): Question[] {
  return (topic.templates ?? []).map((tpl, index) => {
    const generator = getGenerator(tpl.generator);
    if (!generator) {
      // validate-content's checkTemplates guards this earlier; a throw here
      // means the content checks were skipped.
      throw new Error(
        `Topic "${topic.id}" template ${index} references unknown generator "${tpl.generator}" (not in src/content/generators)`
      );
    }
    const params = generator.paramsSchema.parse(tpl.params ?? {});
    const rng = createRng(`${seed}:tpl:${index}`);
    const output = generator.generate(params, rng);
    // Shuffle correct + distractors with the same rng (Fisher-Yates, matching
    // seededShuffle's use of mulberry32) so correctIndex is deterministic.
    const choices = [output.correct, ...output.distractors];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      id: templateQuestionId(index, generator.id),
      stem: output.stem,
      choices,
      correctIndex: choices.indexOf(output.correct),
      explanation: output.explanation,
      difficulty: generator.difficulty,
      ...(tpl.variantOf !== undefined ? { variantOf: tpl.variantOf } : {}),
    };
  });
}
