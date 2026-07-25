import { getCourse, getCourseTopics } from '@/lib/courses';
import { DIFFICULTY_LEVELS, seededShuffle } from '@/lib/quiz-utils';
import type { Difficulty } from '@/content/types';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

export interface QuestionSetOptions {
  courseId: string;
  /** Per-band pick counts; the set length is their sum. */
  targets: Record<Difficulty, number>;
  /** Seed namespace (e.g. "diagnostic", "exam:math-y7:paper-1") — output is deterministic per seed. */
  seed: string;
  /** When true, calculator-tagged questions are excluded (Phase 3 non-calculator policy). */
  excludeCalculator?: boolean;
}

// Deterministic seeded cross-topic set builder, shared by diagnostics, mock
// exams and the revision ladder. Topic spread is maximized by walking all
// topics in seeded order and letting each topic satisfy whichever band still
// needs questions (priority rotates per round), so each topic contributes at
// most one question until the pool of topics runs out. Shortfalls (a band
// running dry) are filled from any remaining questions.
export function buildQuestionSet(options: QuestionSetOptions): MixedReviewQuestion[] {
  const { courseId, targets, seed, excludeCalculator = false } = options;
  const course = getCourse(courseId);
  if (!course) return [];

  const length = Object.values(targets).reduce((sum, n) => sum + n, 0);
  const topics = seededShuffle(getCourseTopics(course), `${seed}:topics`);

  // Bucket each topic's questions by band (untagged = medium), deterministically
  // shuffled within the bucket.
  const buckets = topics.map((topic) => {
    const byBand: Record<Difficulty, MixedReviewQuestion[]> = { easy: [], medium: [], hard: [] };
    for (const question of topic.questions) {
      if (excludeCalculator && question.calculator) continue;
      byBand[question.difficulty ?? 'medium'].push({
        question,
        topicId: topic.id,
        subjectId: topic.subjectId,
        topicTitle: topic.title,
      });
    }
    for (const level of DIFFICULTY_LEVELS) {
      byBand[level] = seededShuffle(byBand[level], `${seed}:${topic.id}:${level}`);
    }
    return byBand;
  });

  const want: Record<Difficulty, number> = { ...targets };
  const picked: MixedReviewQuestion[] = [];
  const pickedIds = new Set<string>();

  // Round r lets each topic offer its r-th question of a band still in demand.
  const maxRounds = Math.max(
    ...buckets.flatMap((b) => DIFFICULTY_LEVELS.map((level) => b[level].length)),
    0
  );
  for (let r = 0; r < maxRounds && picked.length < length; r++) {
    const priority = DIFFICULTY_LEVELS.map((_, i) => DIFFICULTY_LEVELS[(i + r) % DIFFICULTY_LEVELS.length]);
    for (const bucket of buckets) {
      if (picked.length >= length) break;
      for (const level of priority) {
        const candidate = bucket[level][r];
        if (want[level] > 0 && candidate && !pickedIds.has(candidate.question.id)) {
          picked.push(candidate);
          pickedIds.add(candidate.question.id);
          want[level] -= 1;
          break; // one question per topic per round
        }
      }
    }
  }

  // Shortfall: fill from any remaining questions (band targets unmet).
  if (picked.length < length) {
    for (const bucket of buckets) {
      for (const level of DIFFICULTY_LEVELS) {
        for (const candidate of bucket[level]) {
          if (picked.length >= length) break;
          if (!pickedIds.has(candidate.question.id)) {
            picked.push(candidate);
            pickedIds.add(candidate.question.id);
          }
        }
      }
    }
  }

  return picked;
}
