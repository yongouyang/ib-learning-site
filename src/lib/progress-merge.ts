import type { FlashcardProgress, LadderLevelResult, SubjectId, UserProgress } from '@/content/types';
import type { LocalExamResult, LocalQuizAttempt, StoredData } from './progress-store';
import type { ProgressEvent, ProfileProgressSnapshot } from './progress/types';

// Phase C — conflict-resolution merge (PURE functions, no store/network/React).
// These are THE documented conflict rules (docs/architecture-evolution-plan.md
// §3.2), the client-side mirror of the server's write semantics:
//   * topic attempts — union by attemptId (server + local kept; a replayed
//     attempt is never duplicated);
//   * exam results — union by attemptId;
//   * ladder levels — max(bestScore) per course/level, keeping the winner's
//     completedAt;
//   * flashcards — last-write-wins per card by lastReviewed (ISO string
//     compare; a stale review never regresses a newer one);
//   * userProgress (META) — per-field max; lastStudyDate max with null =
//     oldest (an unknown "never studied" must not overwrite a real date).
// Legacy LOCAL attempts/exams that lack an attemptId are assigned an id IN
// PLACE (so the caller saving the merged store persists it and a re-run over
// the same objects is idempotent). Round 2: localOnlyEvents contains EVERY
// local attempt/exam the server does NOT have — legacy (just id'd) AND
// id-bearing — because server writes are idempotent and re-uploading is the
// self-healing path for events lost to a queue purge or multi-tab clobber.
// Deterministic ordering: attempts/exams sorted by date ascending after merge.

/** The local progress shape — mirrors progress-store's StoredData. */
export type StoredDataLike = StoredData;

function quizEventFor(
  entry: { topicId: string; subjectId: string; topicTitle: string; subjectTitle: string },
  a: LocalQuizAttempt,
  profileId: string
): ProgressEvent {
  return {
    type: 'quizAttempt',
    profileId,
    attemptId: a.attemptId!,
    topicId: entry.topicId,
    subjectId: entry.subjectId as SubjectId,
    topicTitle: entry.topicTitle,
    subjectTitle: entry.subjectTitle,
    correctCount: a.correctCount,
    totalCount: a.totalCount,
    date: a.date,
    ...(a.questionResults && a.questionResults.length > 0 ? { questionResults: a.questionResults } : {}),
  };
}

function examEventFor(e: LocalExamResult, profileId: string): ProgressEvent {
  return {
    type: 'examResult',
    profileId,
    attemptId: e.attemptId!,
    examId: e.examId,
    correctCount: e.correctCount,
    totalCount: e.totalCount,
    secondsUsed: e.secondsUsed,
    date: e.date,
  };
}

/** Server-side "no progress yet" snapshot, used when a profile is absent. */
export const EMPTY_PROFILE_SNAPSHOT: ProfileProgressSnapshot = {
  userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
  topicProgress: {},
  examResults: [],
  ladderProgress: {},
  flashcardProgress: {},
};

function maxStudyDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  // The local streak date is DATE-only ('YYYY-MM-DD') while the server stores a
  // full datetime; a plain string compare already ranks a later calendar date
  // above an earlier one and keeps the fuller (datetime) form on a same-day tie.
  return a >= b ? a : b;
}

/**
 * Normalize the local `lastStudyDate` for the sync wire. The local store keeps
 * it DATE-only ('YYYY-MM-DD', see updateStreak); the schema now accepts both
 * forms, so this conversion is belt-and-braces — sending the full datetime
 * keeps same-day max-merge comparisons consistent across devices.
 */
export function toSyncClientMeta(userProgress: UserProgress): UserProgress {
  const d = userProgress.lastStudyDate;
  return {
    totalStars: userProgress.totalStars,
    currentStreakDays: userProgress.currentStreakDays,
    lastStudyDate: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d,
  };
}

/**
 * Merge a server profile snapshot with the local store for that profile.
 * `profileId` is required to build the `localOnlyEvents` (the legacy local
 * attempts that get ids and must be re-uploaded) as complete ProgressEvents.
 */
export function mergeProfileSnapshot(
  server: ProfileProgressSnapshot,
  local: StoredDataLike,
  profileId: string
): { merged: StoredDataLike; localOnlyEvents: ProgressEvent[] } {
  const localOnlyEvents: ProgressEvent[] = [];

  // --- userProgress: per-field max ------------------------------------------
  const mergedUser: UserProgress = {
    totalStars: Math.max(server.userProgress.totalStars, local.userProgress.totalStars),
    currentStreakDays: Math.max(server.userProgress.currentStreakDays, local.userProgress.currentStreakDays),
    lastStudyDate: maxStudyDate(server.userProgress.lastStudyDate, local.userProgress.lastStudyDate),
  };

  // --- topic attempts: union by attemptId -----------------------------------
  const mergedTopics: StoredData['topicProgress'] = {};
  const topicKeys = new Set([...Object.keys(server.topicProgress), ...Object.keys(local.topicProgress)]);
  for (const key of topicKeys) {
    const s = server.topicProgress[key];
    const l = local.topicProgress[key];
    const entry = s ?? l!;
    const attempts: LocalQuizAttempt[] = [];

    const serverIds = new Set<string>();
    for (const a of s?.attempts ?? []) {
      serverIds.add(a.attemptId);
      attempts.push({ ...a });
    }
    for (const a of l?.attempts ?? []) {
      if (a.attemptId && serverIds.has(a.attemptId)) {
        continue; // server already has this attempt — skip the local copy
      }
      if (!a.attemptId) {
        // Legacy local attempt: assign an id IN PLACE (the caller persists the
        // merged store, so re-runs are idempotent) and re-upload.
        a.attemptId = crypto.randomUUID();
        attempts.push({ ...a });
        localOnlyEvents.push(quizEventFor(entry, a, profileId));
        continue;
      }
      // Round 2: id-bearing attempts that the server DOESN'T have are ALSO
      // re-uploaded — this is the self-healing path for events lost to a
      // purge/multi-tab clobber/401 wipe. Server writes are idempotent
      // (attribute_not_exists), so re-uploading is free.
      attempts.push({ ...a });
      localOnlyEvents.push(quizEventFor(entry, a, profileId));
    }
    attempts.sort((x, y) => x.date.localeCompare(y.date));
    mergedTopics[key] = {
      topicId: entry.topicId,
      subjectId: entry.subjectId as SubjectId,
      topicTitle: entry.topicTitle,
      subjectTitle: entry.subjectTitle,
      attempts,
    };
  }

  // --- exam results: union by attemptId -------------------------------------
  const mergedExams: LocalExamResult[] = [];
  const serverExamIds = new Set(server.examResults.map((e) => e.attemptId));
  for (const e of server.examResults) mergedExams.push({ ...e });
  for (const e of local.examResults ?? []) {
    if (e.attemptId && serverExamIds.has(e.attemptId)) {
      continue;
    }
    if (!e.attemptId) {
      e.attemptId = crypto.randomUUID();
      mergedExams.push({ ...e });
      localOnlyEvents.push(examEventFor(e, profileId));
      continue;
    }
    // Round 2: id-bearing exams the server lacks are re-uploaded too (the
    // same self-healing path as topic attempts).
    mergedExams.push({ ...e });
    localOnlyEvents.push(examEventFor(e, profileId));
  }
  mergedExams.sort((x, y) => x.date.localeCompare(y.date));

  // --- ladder: max(bestScore) per course/level, winner's completedAt --------
  const mergedLadder: Record<string, Record<number, LadderLevelResult>> = {};
  const courses = new Set([...Object.keys(server.ladderProgress), ...Object.keys(local.ladderProgress ?? {})]);
  for (const courseId of courses) {
    const sLevels = server.ladderProgress[courseId] ?? {};
    const lLevels = local.ladderProgress?.[courseId] ?? {};
    const levelKeys = new Set([...Object.keys(sLevels), ...Object.keys(lLevels)]);
    const mergedLevels: Record<number, LadderLevelResult> = {};
    for (const lk of levelKeys) {
      const level = Number(lk);
      const s = sLevels[lk];
      const l = lLevels[level];
      let winner: LadderLevelResult;
      if (!s) winner = l!;
      else if (!l) winner = { bestScore: s.bestScore, completedAt: s.completedAt };
      else if (s.bestScore > l.bestScore) winner = { bestScore: s.bestScore, completedAt: s.completedAt };
      else if (l.bestScore > s.bestScore) winner = l;
      else winner = s.completedAt >= l.completedAt ? { bestScore: s.bestScore, completedAt: s.completedAt } : l;
      mergedLevels[level] = winner;
    }
    mergedLadder[courseId] = mergedLevels;
  }

  // --- flashcards: last-write-wins by lastReviewed --------------------------
  const mergedFlash: Record<string, FlashcardProgress> = {};
  const cardIds = new Set([...Object.keys(server.flashcardProgress), ...Object.keys(local.flashcardProgress ?? {})]);
  for (const cardId of cardIds) {
    const s = server.flashcardProgress[cardId];
    const l = local.flashcardProgress?.[cardId];
    if (!s) mergedFlash[cardId] = l!;
    else if (!l) mergedFlash[cardId] = s;
    else mergedFlash[cardId] = s.lastReviewed >= l.lastReviewed ? s : l;
  }

  localOnlyEvents.sort((a, b) => a.date.localeCompare(b.date));

  return {
    merged: {
      version: local.version ?? 2,
      userProgress: mergedUser,
      topicProgress: mergedTopics,
      examResults: mergedExams,
      ladderProgress: mergedLadder,
      flashcardProgress: mergedFlash,
    },
    localOnlyEvents,
  };
}

/**
 * Convert a full local store into sync events for a bulk upload (the
 * first-login migration). Attempts/exams must already carry ids (see
 * assignMissingAttemptIds); items still missing one are skipped defensively.
 * Deterministic: events are sorted by date ascending.
 */
export function extractLocalEventsForProfile(data: StoredDataLike, profileId: string): ProgressEvent[] {
  const events: ProgressEvent[] = [];

  for (const tp of Object.values(data.topicProgress)) {
    for (const a of tp.attempts) {
      if (!a.attemptId) continue;
      events.push({
        type: 'quizAttempt',
        profileId,
        attemptId: a.attemptId,
        topicId: tp.topicId,
        subjectId: tp.subjectId,
        topicTitle: tp.topicTitle,
        subjectTitle: tp.subjectTitle,
        correctCount: a.correctCount,
        totalCount: a.totalCount,
        date: a.date,
        ...(a.questionResults && a.questionResults.length > 0 ? { questionResults: a.questionResults } : {}),
      });
    }
  }

  for (const e of data.examResults ?? []) {
    if (!e.attemptId) continue;
    events.push({
      type: 'examResult',
      profileId,
      attemptId: e.attemptId,
      examId: e.examId,
      correctCount: e.correctCount,
      totalCount: e.totalCount,
      secondsUsed: e.secondsUsed,
      date: e.date,
    });
  }

  for (const [courseId, levels] of Object.entries(data.ladderProgress ?? {})) {
    for (const [levelStr, lr] of Object.entries(levels)) {
      events.push({
        type: 'ladderResult',
        profileId,
        courseId,
        level: Number(levelStr),
        score: lr.bestScore,
        date: lr.completedAt,
      });
    }
  }

  for (const [cardId, fp] of Object.entries(data.flashcardProgress ?? {})) {
    events.push({
      type: 'flashcardResult',
      profileId,
      cardId,
      status: fp.status,
      knownStreak: fp.knownStreak,
      date: fp.lastReviewed,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
