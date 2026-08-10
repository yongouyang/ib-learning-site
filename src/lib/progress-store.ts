import { UserProgress, TopicProgress, QuizAttempt, QuestionResult, SubjectId, ExamResult, LadderLevelResult, FlashcardProgress } from '@/content/types';

const STORAGE_KEY = 'iblearn_progress';
const STORAGE_VERSION = 2;

interface StoredData {
  version?: number; // absent in legacy payloads — treated as STORAGE_VERSION
  userProgress: UserProgress;
  topicProgress: Record<string, TopicProgress>;
  examResults?: ExamResult[];
  ladderProgress?: Record<string, Record<number, LadderLevelResult>>;
  flashcardProgress?: Record<string /* cardId */, FlashcardProgress>; // v2
}

const DEFAULT_DATA: StoredData = {
  version: STORAGE_VERSION,
  userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
  topicProgress: {},
  examResults: [],
  ladderProgress: {},
  flashcardProgress: {},
};

function load(): StoredData {
  if (typeof window === 'undefined') {
    return structuredClone(DEFAULT_DATA);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredData;
      // Additive defaults — legacy payloads lack the newer fields.
      return {
        ...structuredClone(DEFAULT_DATA),
        ...parsed,
        examResults: parsed.examResults ?? [],
        ladderProgress: parsed.ladderProgress ?? {},
        flashcardProgress: parsed.flashcardProgress ?? {},
      };
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_DATA);
}

function save(data: StoredData): void {
  if (typeof window === 'undefined') return;
  data.version = STORAGE_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getUserProgress(): UserProgress {
  return load().userProgress;
}

export function getTopicProgress(topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string): TopicProgress {
  const data = load();
  const key = `${subjectId}:${topicId}`;
  if (!data.topicProgress[key]) {
    data.topicProgress[key] = { topicId, subjectId, topicTitle, subjectTitle, attempts: [] };
  }
  return data.topicProgress[key];
}

export function getAllTopicProgress(): TopicProgress[] {
  return Object.values(load().topicProgress);
}

export function recordQuizAttempt(
  topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string,
  correctCount: number, totalCount: number,
  questionResults?: QuestionResult[]
): void {
  const data = load();
  const key = `${subjectId}:${topicId}`;
  const tp = data.topicProgress[key] || { topicId, subjectId, topicTitle, subjectTitle, attempts: [] };

  const attempt: QuizAttempt = { date: new Date().toISOString(), correctCount, totalCount };
  // Per-question outcomes feed variant-group mastery (src/lib/mastery.ts);
  // omitted by callers that only know aggregates (diagnostics, mixed review).
  if (questionResults && questionResults.length > 0) {
    attempt.questionResults = questionResults;
  }
  tp.attempts.push(attempt);
  data.topicProgress[key] = tp;

  applyStudyRewards(data.userProgress, correctCount / Math.max(totalCount, 1));

  save(data);
}

// Exams and the revision ladder record into their own fields — never into
// topicProgress, so aggregate exam scores can't pollute the weak-areas system.

export function recordExamResult(result: ExamResult): void {
  const data = load();
  data.examResults!.push(result);
  applyStudyRewards(data.userProgress, result.correctCount / Math.max(result.totalCount, 1));
  save(data);
}

export function getExamResults(): ExamResult[] {
  return load().examResults!;
}

export function recordLadderResult(courseId: string, level: number, score: number): void {
  const data = load();
  const course = data.ladderProgress![courseId] ?? {};
  const existing = course[level];
  course[level] = {
    bestScore: Math.max(existing?.bestScore ?? 0, score),
    completedAt: new Date().toISOString(),
  };
  data.ladderProgress![courseId] = course;
  applyStudyRewards(data.userProgress, score);
  save(data);
}

export function getLadderProgress(): Record<string, Record<number, LadderLevelResult>> {
  return load().ladderProgress!;
}

// Phase 6 — flashcard self-sorting. No stars for flashcards (stars stay
// quiz/exam), but reviewing cards counts as study activity for the day streak.
export function recordFlashcardResult(cardId: string, status: 'known' | 'learning'): void {
  const data = load();
  const existing = data.flashcardProgress![cardId];
  data.flashcardProgress![cardId] = {
    status,
    lastReviewed: new Date().toISOString(),
    knownStreak: status === 'known' ? (existing?.knownStreak ?? 0) + 1 : 0,
  };
  updateStreak(data.userProgress);
  save(data);
}

export function getFlashcardProgress(): Record<string, FlashcardProgress> {
  return load().flashcardProgress!;
}

function applyStudyRewards(up: UserProgress, scorePercent: number): void {
  up.totalStars += starsForScore(scorePercent);
  updateStreak(up);
}

function updateStreak(up: UserProgress): void {
  const today = new Date().toISOString().split('T')[0];
  if (!up.lastStudyDate) {
    up.lastStudyDate = today;
    up.currentStreakDays = 1;
    return;
  }
  const lastDate = up.lastStudyDate.split('T')[0];
  if (lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (lastDate === yesterday) {
    up.currentStreakDays += 1;
  } else {
    up.currentStreakDays = 1;
  }
  up.lastStudyDate = today;
}

function starsForScore(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.7) return 2;
  if (score >= 0.4) return 1;
  return 0;
}

export function getRecentAverageScore(attempts: QuizAttempt[]): number {
  if (attempts.length === 0) return 0;
  const recent = attempts.slice(-5);
  const total = recent.reduce((sum, a) => sum + (a.correctCount / a.totalCount), 0);
  return total / recent.length;
}

export function getStarRating(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.7) return 2;
  if (score >= 0.4) return 1;
  return 0;
}
