import { z } from 'zod';
import type { SessionRecord, UserRecord } from '../auth/types';

// Phase C — progress sync types (docs/architecture-evolution-plan.md §3.2).
//
// STORAGE DESIGN (per-profile namespacing — explicit design decision): every
// progress item's SK carries the CHILD profile id, because the family use
// case (two siblings, one parent account, two devices) needs per-child
// progress that syncs independently:
//   META#<profileId>                                    — per-profile meta
//   TOPIC#<profileId>#<subjectId>:<topicId>#<attemptId> — one item PER quiz
//     attempt (append-only, atomic idempotent via attribute_not_exists; the
//     plan's "attempts array capped at 50" is enforced at READ — the server
//     returns the latest 50 per topic; see PROGRESS.md for the tradeoff)
//   EXAM#<profileId>#<examId>#<attemptId>               — one item per exam
//   LADDER#<profileId>#<courseId>                       — levels map, atomic
//     better-score condition (max-wins per level)
//   FLASHCARD#<profileId>#<cardId>                      — last-write-wins per
//     card, guarded by a monotonic lastReviewed condition
// All items live in the existing octav-progress table (PK userId, SK dataType)
// — one Query by userId returns the whole account (all profiles).

// --- Item shapes ---------------------------------------------------------------

export interface ProgressMetaItem {
  userId: string;
  dataType: string; // "META#<profileId>"
  profileId: string;
  totalStars: number;
  currentStreakDays: number;
  // '' = "never studied" — stored as an empty string because DynamoDB
  // comparison conditions don't evaluate NULL attributes; the API layer
  // converts '' ↔ null (the client's UserProgress shape uses null).
  lastStudyDate: string;
  lastSyncedAt: string;
  migrationCompletedAt?: string; // set exactly once (C5 idempotency marker)
}

export interface QuestionResultItem {
  questionId: string;
  correct: boolean;
}

export interface TopicAttemptItem {
  userId: string;
  dataType: string; // "TOPIC#<profileId>#<subjectId>:<topicId>#<attemptId>"
  profileId: string;
  attemptId: string;
  subjectId: string;
  topicId: string;
  topicTitle: string;
  subjectTitle: string;
  date: string; // ISO
  correctCount: number;
  totalCount: number;
  questionResults?: QuestionResultItem[];
}

export interface ExamAttemptItem {
  userId: string;
  dataType: string; // "EXAM#<profileId>#<examId>#<attemptId>"
  profileId: string;
  attemptId: string;
  examId: string;
  date: string; // ISO
  correctCount: number;
  totalCount: number;
  secondsUsed: number;
}

export interface LadderItem {
  userId: string;
  dataType: string; // "LADDER#<profileId>#<courseId>"
  profileId: string;
  courseId: string;
  // DynamoDB map keys are strings — numeric level keys arrive as strings.
  levels: Record<string, { bestScore: number; completedAt: string }>;
}

export interface FlashcardItem {
  userId: string;
  dataType: string; // "FLASHCARD#<profileId>#<cardId>"
  profileId: string;
  cardId: string;
  status: 'known' | 'learning';
  lastReviewed: string; // ISO
  knownStreak: number;
}

export type ProgressItem =
  | ProgressMetaItem
  | TopicAttemptItem
  | ExamAttemptItem
  | LadderItem
  | FlashcardItem;

// --- Budgets (server-enforced; documented in PROGRESS.md) ----------------------

export const PROGRESS_MAX_EVENTS_PER_SYNC = 100;
export const PROGRESS_MAX_QUESTION_RESULTS = 200;
export const PROGRESS_MAX_ID_LENGTH = 64;
export const PROGRESS_MAX_TITLE_LENGTH = 120;
export const TOPIC_ATTEMPTS_READ_CAP = 50; // latest 50 returned per topic (plan §3.2)
// Durable per-user sync budget (fixed-window, octav-rate-limits): ~1 sync per
// 5s sustained is far above any legit pattern (a session syncs a handful of
// times; the first-login migration is a few chunked syncs).
export const PROGRESS_SYNC_LIMIT_PER_WINDOW = 120;
export const PROGRESS_SYNC_WINDOW_SECONDS = 600; // 10 minutes

// --- Storage interface ---------------------------------------------------------

/** Phase D4 write signals (docs/leaderboard-plan.md §4.1 "Applied-vs-replay plumbing"). */
export interface FlashcardWriteResult {
  /** false = stale (an older write lost the LWW race — replay/no-op). */
  applied: boolean;
  /** Card status BEFORE this write; null = no prior row. Only meaningful when applied. */
  previousStatus: 'known' | 'learning' | null;
}

export interface LadderWriteResult {
  /** false = an equal-or-better score was already stored (replay/no-op). */
  improved: boolean;
  /** Stored best BEFORE this write; null = first write for that level. Only meaningful when improved. */
  previousBestScore: number | null;
}

// Session-validation subset (one source of truth: src/lib/auth/session.ts)
// plus the progress ops. The DynamoDB adapter composes DynamoAuthStorage for
// the session subset; the dummy implements everything in one in-memory
// universe so dev/e2e auth + progress routes share state.
export interface ProgressStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  listProgressByUser(userId: string): Promise<ProgressItem[]>;
  deleteProgressByUser(userId: string): Promise<void>;
  /** Read one profile's META item (null when absent). */
  getMeta(userId: string, profileId: string): Promise<ProgressMetaItem | null>;
  /**
   * CI smoke probe (C6): an unauthenticated, fixed-probe-key, Limit-1 Query
   * on octav-progress that exercises the REAL failure class (missing table /
   * missing Query grant) with zero data exposure. The dummy resolves
   * immediately.
   */
  probeProgressTable(): Promise<void>;

  /**
   * Durable fixed-window per-user sync budget (octav-rate-limits bucket
   * `progress-sync:<userId>:<epoch>`): true = within budget, false = limit
   * reached for the current window (the handler 429s). Same pattern as the
   * auth/analytics limiters — the window epoch in the key makes the counter
   * reset ATOMICALLY when the window rolls.
   */
  incrementProgressSyncCount(userId: string, limit: number, windowSeconds: number): Promise<boolean>;

  /** Atomic + idempotent: attribute_not_exists on the item SK. false = already applied. */
  putTopicAttempt(item: TopicAttemptItem): Promise<boolean>;
  putExamAttempt(item: ExamAttemptItem): Promise<boolean>;
  /**
   * LWW per card guarded by a monotonic lastReviewed condition. applied=false
   * = stale (older write). previousStatus is the card's status BEFORE this
   * write (the D4 "newly known" signal); null = no prior row. Only meaningful
   * when applied — a rejected (stale) write reports previousStatus null.
   */
  putFlashcard(item: FlashcardItem): Promise<FlashcardWriteResult>;
  /**
   * Atomic max-wins per level. improved=false = an equal-or-better score exists
   * (treated as applied). previousBestScore is the stored best BEFORE this
   * write (the D4 "first clear" signal); null = first write for that level.
   * Only meaningful when improved — a rejected write reports null.
   */
  updateLadderLevel(
    item: LadderItem,
    level: number,
    bestScore: number,
    completedAt: string
  ): Promise<LadderWriteResult>;
  /** Conditional per-field max-merge. false = nothing better to store (no-op success). */
  mergeMeta(item: ProgressMetaItem): Promise<boolean>;
  /** C5 idempotency marker: true exactly once per profile. */
  setMigrationCompleted(userId: string, profileId: string, completedAt: string): Promise<boolean>;

  /**
   * Phase D4 daily-XP-cap bucket (octav-rate-limits `xpday:<profileId>:<dateUtc>`,
   * TTL ~2d — the aimark: precedent): ONE conditional command, `ADD #c :delta`
   * with `attribute_not_exists(#c) OR #c < :cap`, ReturnValues ALL_NEW. Returns
   * how much of `delta` is still awardable under the cap — 0 when the bucket is
   * already at/over the cap (condition failure). The bucket itself may
   * overshoot the cap by one delta (documented, harmless — plan §4.1).
   */
  incrementXpDayBucket(profileId: string, dateUtc: string, delta: number, cap: number): Promise<number>;
  /**
   * Phase D4 diminishing-repeats bucket (octav-rate-limits
   * `xp-topic:<profileId>:<topicId>:<weekKey>`, TTL ~10d): ONE unconditional
   * `ADD #c 1`, ReturnValues ALL_NEW — returns the new count, i.e. the 1-based
   * weekly attempt ordinal that picks the repeatMultiplier.
   */
  incrementXpTopicBucket(profileId: string, topicId: string, weekKey: string): Promise<number>;
}

// --- Wire schemas (POST /api/progress/sync) ------------------------------------

export const questionResultSchema = z.object({
  questionId: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(PROGRESS_MAX_ID_LENGTH),
  correct: z.boolean(),
});

// Charset-restricted ids (round 2): '#' (and ':' for topic/subject composites)
// would break the server's SK parsing and the read-side grouping — reject
// anything outside [A-Za-z0-9_-] rather than let a hostile id re-trigger
// migration or split items across wrong groups.
const idField = () => z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(PROGRESS_MAX_ID_LENGTH);

// Client clocks are untrusted: a far-future date would permanently block that
// item's LWW/append ordering (e.g. a 9999 flashcard review wins every compare
// forever). Allow 24h of skew, reject the rest (round 2).
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const clientDate = () =>
  z.iso.datetime().refine(
    (d) => new Date(d).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS,
    { message: 'timestamp is too far in the future' }
  );

export const quizAttemptEventSchema = z.object({
  type: z.literal('quizAttempt'),
  profileId: idField(),
  attemptId: idField(),
  topicId: idField(),
  subjectId: idField(),
  topicTitle: z.string().min(1).max(PROGRESS_MAX_TITLE_LENGTH),
  subjectTitle: z.string().min(1).max(PROGRESS_MAX_TITLE_LENGTH),
  correctCount: z.number().int().min(0).max(500),
  totalCount: z.number().int().min(1).max(500),
  date: clientDate(),
  questionResults: z.array(questionResultSchema).max(PROGRESS_MAX_QUESTION_RESULTS).optional(),
});

export const examResultEventSchema = z.object({
  type: z.literal('examResult'),
  profileId: idField(),
  attemptId: idField(),
  examId: idField(),
  correctCount: z.number().int().min(0).max(500),
  totalCount: z.number().int().min(1).max(500),
  secondsUsed: z.number().int().min(0).max(86_400),
  date: clientDate(),
});

export const ladderResultEventSchema = z.object({
  type: z.literal('ladderResult'),
  profileId: idField(),
  courseId: idField(),
  level: z.number().int().min(1).max(50),
  score: z.number().min(0).max(1),
  date: clientDate(),
});

export const flashcardResultEventSchema = z.object({
  type: z.literal('flashcardResult'),
  profileId: idField(),
  cardId: idField(),
  status: z.enum(['known', 'learning']),
  knownStreak: z.number().int().min(0).max(1000),
  date: clientDate(), // the review timestamp — LWW key
});

export const progressEventSchema = z.discriminatedUnion('type', [
  quizAttemptEventSchema,
  examResultEventSchema,
  ladderResultEventSchema,
  flashcardResultEventSchema,
]);

export const syncRequestSchema = z.object({
  events: z.array(progressEventSchema).min(1).max(PROGRESS_MAX_EVENTS_PER_SYNC),
  clientMeta: z.object({
    // Sane cap: Phase D's leaderboard will inherit this value — don't hand it
    // unbounded client-supplied trust (round 2).
    totalStars: z.number().int().min(0).max(1_000_000),
    currentStreakDays: z.number().int().min(0).max(100_000),
    // The client's native lastStudyDate is DATE-ONLY ('YYYY-MM-DD', from
    // progress-store's streak logic); full datetimes are also accepted (the
    // per-field max-merge compares them lexicographically — same date wins
    // either way). Same clock-skew guard as event dates (round 3): the
    // per-field MAX-merge makes a far-future value IRREVERSIBLE (it can never
    // merge back down) — reject anything past server-now + 24h. An unparseable
    // date (e.g. '9999-99-99') fails the refine via the NaN comparison.
    lastStudyDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/)
      .refine(
        (d) => new Date(d).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS,
        { message: 'lastStudyDate is too far in the future' }
      )
      .nullable(),
  }),
  // C5: set on the first-login bulk migration; the server stamps the META
  // marker exactly once per profile (replays are no-ops).
  markMigrationComplete: z.boolean().optional(),
});

export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;

// --- GET /api/progress response shape ------------------------------------------
// Mirrors the client's stored shapes (src/lib/progress-store.ts) per profile.

export interface ProfileProgressSnapshot {
  userProgress: { totalStars: number; currentStreakDays: number; lastStudyDate: string | null };
  topicProgress: Record<
    string,
    {
      topicId: string;
      subjectId: string;
      topicTitle: string;
      subjectTitle: string;
      attempts: {
        attemptId: string;
        date: string;
        correctCount: number;
        totalCount: number;
        questionResults?: QuestionResultItem[];
      }[];
    }
  >;
  examResults: {
    attemptId: string;
    examId: string;
    date: string;
    correctCount: number;
    totalCount: number;
    secondsUsed: number;
  }[];
  ladderProgress: Record<string, Record<string, { bestScore: number; completedAt: string }>>;
  flashcardProgress: Record<string, { status: 'known' | 'learning'; lastReviewed: string; knownStreak: number }>;
}

export type ProgressSnapshotResponse = { profiles: Record<string, ProfileProgressSnapshot> };
