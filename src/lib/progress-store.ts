import { UserProgress, TopicProgress, QuizAttempt, QuestionResult, SubjectId, ExamResult, LadderLevelResult, FlashcardProgress } from '@/content/types';
import type { ProgressEvent } from './progress/types';

const STORAGE_KEY = 'iblearn_progress';
const STORAGE_VERSION = 2;

// Phase C — per-profile namespacing + sync enqueue hook (offline-first sync).
//
// The ANONYMOUS store (`iblearn_progress`) is byte-for-byte unchanged: when no
// namespace is active, load()/save() route there exactly as before. When a
// namespace IS active (a signed-in account + child profile), load()/save()
// route to `octav_progress:<userId>:<profileId>` so each profile keeps its own
// local cache (the family use case — two siblings, one parent account, two
// devices, syncing independently). Attempts recorded while a namespace is
// active also carry an `attemptId` (so the server-side union-by-attemptId
// merge dedupes correctly) and are offered to the sync enqueue hook.

// Local attempt shapes widen the shared content types with an optional
// `attemptId`, assigned only when a namespace is active (logged in) — the
// logged-out anonymous bytes therefore stay identical to before.
export interface LocalQuizAttempt extends QuizAttempt {
  attemptId?: string;
}
export interface LocalExamResult extends ExamResult {
  attemptId?: string;
}
export interface StoredTopicProgress {
  topicId: string;
  subjectId: SubjectId;
  topicTitle: string;
  subjectTitle: string;
  attempts: LocalQuizAttempt[];
}
export interface StoredData {
  version?: number; // absent in legacy payloads — treated as STORAGE_VERSION
  userProgress: UserProgress;
  topicProgress: Record<string, StoredTopicProgress>;
  examResults?: LocalExamResult[];
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

// --- Active namespace (per-profile local cache) -------------------------------

let activeNamespace: { userId: string; profileId: string } | null = null;

function currentKey(): string {
  return activeNamespace
    ? `octav_progress:${activeNamespace.userId}:${activeNamespace.profileId}`
    : STORAGE_KEY;
}

function loadKey(key: string): StoredData {
  if (typeof window === 'undefined') {
    return structuredClone(DEFAULT_DATA);
  }
  try {
    const raw = localStorage.getItem(key);
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

function load(): StoredData {
  return loadKey(currentKey());
}

function save(data: StoredData): void {
  if (typeof window === 'undefined') return;
  data.version = STORAGE_VERSION;
  localStorage.setItem(currentKey(), JSON.stringify(data));
}

/**
 * Route load()/save() to the profile's namespaced key, or back to the
 * anonymous `iblearn_progress` store when either id is null (logged out).
 */
export function setActiveNamespace(userId: string | null, profileId: string | null): void {
  if (userId && profileId) {
    activeNamespace = { userId, profileId };
  } else {
    activeNamespace = null;
  }
}

/** Read the active store's full payload (namespaced when a namespace is set). */
export function loadStoredData(): StoredData {
  return load();
}

/** Persist a full payload to the active store (used by the login merge). */
export function saveStoredData(data: StoredData): void {
  save(data);
}

/** Read the anonymous `iblearn_progress` blob regardless of the active namespace. */
export function loadAnonymousData(): StoredData {
  return loadKey(STORAGE_KEY);
}

/** Persist a payload to the anonymous `iblearn_progress` blob (migration ids). */
export function saveAnonymousData(data: StoredData): void {
  if (typeof window === 'undefined') return;
  data.version = STORAGE_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Clear the anonymous blob (after a successful first-login migration — round 2). */
export function clearAnonymousData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

const ANON_CLAIMED_KEY = 'octav_anon_claimed';

/** Device-side "the anonymous blob was migrated" flag (round 2, item 5). */
export function isAnonymousClaimed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ANON_CLAIMED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAnonymousClaimed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANON_CLAIMED_KEY, '1');
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Add `attemptId: crypto.randomUUID()` to every topic attempt and exam result
 * that lacks one. PURE (round 2): it mutates + returns the payload WITHOUT
 * saving — the caller decides WHICH store to persist (the migration persists
 * back to the ANONYMOUS blob so a retried bulk upload reuses the SAME ids;
 * saving into the active namespaced store would both strand the anon blob
 * id-less AND overwrite the just-merged namespaced data). Idempotent —
 * existing ids are never replaced.
 */
export function assignMissingAttemptIds(data: StoredData): StoredData {
  for (const tp of Object.values(data.topicProgress)) {
    for (const attempt of tp.attempts) {
      if (!attempt.attemptId) attempt.attemptId = crypto.randomUUID();
    }
  }
  for (const exam of data.examResults ?? []) {
    if (!exam.attemptId) exam.attemptId = crypto.randomUUID();
  }
  return data;
}

// --- Sync enqueue hook --------------------------------------------------------

type SyncEventHook = ((event: ProgressEvent) => void) | null;
let syncEventHook: SyncEventHook = null;

/**
 * Register the module-level enqueue hook (the sync manager wires this). Each
 * record* below offers the corresponding ProgressEvent — including the
 * attemptId (quiz/exam), the active namespace's profileId, and the ISO
 * timestamp used locally — when a namespace is active. The hook stays null
 * when logged out, so nothing is enqueued.
 */
export function setSyncEventHook(hook: SyncEventHook): void {
  syncEventHook = hook;
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
  const tp: StoredTopicProgress = data.topicProgress[key] || { topicId, subjectId, topicTitle, subjectTitle, attempts: [] };

  const ns = activeNamespace;
  const attemptId = ns ? crypto.randomUUID() : undefined;
  const now = new Date().toISOString();
  const attempt: LocalQuizAttempt = { date: now, correctCount, totalCount };
  if (attemptId) attempt.attemptId = attemptId;
  // Per-question outcomes feed variant-group mastery (src/lib/mastery.ts);
  // omitted by callers that only know aggregates (diagnostics, mixed review).
  if (questionResults && questionResults.length > 0) {
    attempt.questionResults = questionResults;
  }
  tp.attempts.push(attempt);
  data.topicProgress[key] = tp;

  applyStudyRewards(data.userProgress, correctCount / Math.max(totalCount, 1));

  save(data);

  if (syncEventHook && ns && attemptId) {
    syncEventHook({
      type: 'quizAttempt',
      profileId: ns.profileId,
      attemptId,
      topicId,
      subjectId,
      topicTitle,
      subjectTitle,
      correctCount,
      totalCount,
      date: now,
      ...(questionResults && questionResults.length > 0 ? { questionResults } : {}),
    });
  }
}

// Exams and the revision ladder record into their own fields — never into
// topicProgress, so aggregate exam scores can't pollute the weak-areas system.

export function recordExamResult(result: ExamResult): void {
  const data = load();
  const ns = activeNamespace;
  const attemptId = ns ? crypto.randomUUID() : undefined;
  const stored: LocalExamResult = attemptId ? { ...result, attemptId } : { ...result };
  data.examResults!.push(stored);
  applyStudyRewards(data.userProgress, result.correctCount / Math.max(result.totalCount, 1));
  save(data);

  if (syncEventHook && ns && attemptId) {
    syncEventHook({
      type: 'examResult',
      profileId: ns.profileId,
      attemptId,
      examId: result.examId,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      secondsUsed: result.secondsUsed,
      date: result.date,
    });
  }
}

export function getExamResults(): ExamResult[] {
  return load().examResults!;
}

export function recordLadderResult(courseId: string, level: number, score: number): void {
  const data = load();
  const course = data.ladderProgress![courseId] ?? {};
  const existing = course[level];
  const bestScore = Math.max(existing?.bestScore ?? 0, score);
  const completedAt = new Date().toISOString();
  course[level] = { bestScore, completedAt };
  data.ladderProgress![courseId] = course;
  applyStudyRewards(data.userProgress, score);
  save(data);

  const ns = activeNamespace;
  if (syncEventHook && ns) {
    // The event's `score` is the FINAL bestScore (the max is applied locally),
    // so the server's own max-wins condition never regresses a better score.
    syncEventHook({
      type: 'ladderResult',
      profileId: ns.profileId,
      courseId,
      level,
      score: bestScore,
      date: completedAt,
    });
  }
}

export function getLadderProgress(): Record<string, Record<number, LadderLevelResult>> {
  return load().ladderProgress!;
}

// Phase 6 — flashcard self-sorting. No stars for flashcards (stars stay
// quiz/exam), but reviewing cards counts as study activity for the day streak.
export function recordFlashcardResult(cardId: string, status: 'known' | 'learning'): void {
  const data = load();
  const existing = data.flashcardProgress![cardId];
  const lastReviewed = new Date().toISOString();
  const knownStreak = status === 'known' ? (existing?.knownStreak ?? 0) + 1 : 0;
  data.flashcardProgress![cardId] = {
    status,
    lastReviewed,
    knownStreak,
  };
  updateStreak(data.userProgress);
  save(data);

  const ns = activeNamespace;
  if (syncEventHook && ns) {
    syncEventHook({
      type: 'flashcardResult',
      profileId: ns.profileId,
      cardId,
      status,
      knownStreak,
      date: lastReviewed,
    });
  }
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
