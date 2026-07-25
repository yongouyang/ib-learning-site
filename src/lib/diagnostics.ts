import { SubjectId, Topic } from '@/content/types';
import { getSubjects } from '@/content/registry';
import { DIFFICULTY_LEVELS, seededShuffle } from '@/lib/quiz-utils';
import type { Difficulty } from '@/content/types';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

// One short cross-topic diagnostic per course grouping. Results are recorded
// as per-topic quiz attempts so the weak-areas system is seeded immediately
// (see revised-implementation-plan.md Phase 2).
export interface DiagnosticCourse {
  id: string;
  title: string;
  matches: (topic: Topic) => boolean;
}

const DIAGNOSTIC_COURSES: DiagnosticCourse[] = [
  {
    id: 'math-y7',
    title: 'Math — Year 7',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 7,
  },
  {
    id: 'math-y8',
    title: 'Math — Year 8',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 8,
  },
  {
    id: 'math-y9',
    title: 'Math — Year 9',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 9,
  },
  {
    id: 'math-dp-ai',
    title: 'Math — DP Applications & Interpretation',
    matches: (t) => t.subjectId === 'math' && t.stage === 'dp' && t.course === 'ai',
  },
  {
    id: 'eng-ks3',
    title: 'English — KS3',
    matches: (t) => t.subjectId === 'english' && t.stage === 'ks3',
  },
  {
    id: 'bio-ks3',
    title: 'Biology — KS3',
    matches: (t) => t.subjectId === 'biology' && t.stage === 'ks3',
  },
  {
    id: 'chem-ks3',
    title: 'Chemistry — KS3',
    matches: (t) => t.subjectId === 'chemistry' && t.stage === 'ks3',
  },
  {
    id: 'phys-ks3',
    title: 'Physics — KS3',
    matches: (t) => t.subjectId === 'physics' && t.stage === 'ks3',
  },
];

export const DIAGNOSTIC_LENGTH = 15;
// Band targets for a 15-question diagnostic (≈30/40/30, sums to DIAGNOSTIC_LENGTH).
export const DIAGNOSTIC_BAND_TARGETS = { easy: 4, medium: 7, hard: 4 } as const;

export interface DiagnosticCourseInfo {
  id: string;
  title: string;
  topicCount: number;
  questionCount: number; // actual set length (capped at DIAGNOSTIC_LENGTH)
}

function courseTopics(course: DiagnosticCourse): Topic[] {
  return getSubjects().flatMap((s) => s.topics).filter(course.matches);
}

export function getDiagnosticCourse(id: string): DiagnosticCourse | undefined {
  return DIAGNOSTIC_COURSES.find((c) => c.id === id);
}

export function getDiagnosticCourses(): DiagnosticCourseInfo[] {
  return DIAGNOSTIC_COURSES.map((course) => ({
    id: course.id,
    title: course.title,
    topicCount: courseTopics(course).length,
    questionCount: buildDiagnosticQuestions(course.id).length,
  }));
}

// Deterministic (seeded) so server and client renders match and a retake sees
// the same set. Topic spread is maximized by walking all topics in seeded
// order and letting each topic satisfy whichever band still needs questions
// (priority rotates per round), so each topic contributes at most one question
// until the pool of topics runs out.
export function buildDiagnosticQuestions(courseId: string): MixedReviewQuestion[] {
  const course = getDiagnosticCourse(courseId);
  if (!course) return [];

  const seed = `diagnostic:${courseId}`;
  const topics = seededShuffle(courseTopics(course), `${seed}:topics`);

  // Bucket each topic's questions by band (untagged = medium), deterministically
  // shuffled within the bucket.
  const buckets = topics.map((topic) => {
    const byBand: Record<Difficulty, MixedReviewQuestion[]> = { easy: [], medium: [], hard: [] };
    for (const question of topic.questions) {
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

  const want: Record<Difficulty, number> = { ...DIAGNOSTIC_BAND_TARGETS };
  const picked: MixedReviewQuestion[] = [];
  const pickedIds = new Set<string>();

  // Round r lets each topic offer its r-th question of a band still in demand.
  const maxRounds = Math.max(
    ...buckets.flatMap((b) => DIFFICULTY_LEVELS.map((level) => b[level].length)),
    0
  );
  for (let r = 0; r < maxRounds && picked.length < DIAGNOSTIC_LENGTH; r++) {
    const priority = DIFFICULTY_LEVELS.map((_, i) => DIFFICULTY_LEVELS[(i + r) % DIFFICULTY_LEVELS.length]);
    for (const bucket of buckets) {
      if (picked.length >= DIAGNOSTIC_LENGTH) break;
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
  if (picked.length < DIAGNOSTIC_LENGTH) {
    for (const bucket of buckets) {
      for (const level of DIFFICULTY_LEVELS) {
        for (const candidate of bucket[level]) {
          if (picked.length >= DIAGNOSTIC_LENGTH) break;
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
