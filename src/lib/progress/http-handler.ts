import { resolveSession } from '../auth/session';
import {
  TOPIC_ATTEMPTS_READ_CAP,
  syncRequestSchema,
  type ExamAttemptItem,
  type FlashcardItem,
  type LadderItem,
  type ProgressEvent,
  type ProgressItem,
  type ProgressMetaItem,
  type ProgressStorage,
  type ProfileProgressSnapshot,
  type TopicAttemptItem,
} from './types';
import { getProgressDeps } from './deps';

// Phase C — framework-agnostic progress handler. Single source of truth for
// the /api/progress/* contract (docs/architecture-evolution-plan.md §3.3):
// the Next routes (dev/e2e) and the production Lambda (lambda/progress,
// behind the CloudFront /api/progress/* behavior) both delegate here.
//
// Security model (rule 5): identity comes ONLY from the session cookie
// (shared resolution — src/lib/auth/session.ts); a profileId in the payload
// is DATA, validated against the session user's childProfiles (IDOR-guarded),
// and userId is never accepted from the client.
//
// Write semantics (rule 6): every event is a single conditional DynamoDB
// command — atomic and idempotent (replayed events are treated as applied,
// never duplicated). Conflict rule: topic/exam attempts append by attemptId;
// ladder levels max-wins; flashcards last-write-wins by lastReviewed; META
// per-field max (stars/streak/lastStudyDate).

/** Every response is built here so Cache-Control: no-store is uniform. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

const NOT_AUTHENTICATED = () => json({ error: 'Not authenticated.' }, 401);

async function parseJson(req: Request): Promise<{ body: unknown; error: Response | null }> {
  try {
    return { body: await req.json(), error: null };
  } catch {
    return { body: null, error: json({ error: 'Invalid JSON body' }, 400) };
  }
}

/** Profile snapshot from the account's raw items (read-side 50-attempt cap). */
function buildSnapshots(items: ProgressItem[]): Record<string, ProfileProgressSnapshot> {
  const byProfile = new Map<string, ProgressItem[]>();
  for (const item of items) {
    const profileId = item.dataType.startsWith('META#')
      ? (item as ProgressMetaItem).profileId
      : item.dataType.split('#')[1] ?? 'unknown';
    const list = byProfile.get(profileId) ?? [];
    list.push(item);
    byProfile.set(profileId, list);
  }

  const snapshots: Record<string, ProfileProgressSnapshot> = {};
  for (const [profileId, profileItems] of byProfile) {
    const empty: ProfileProgressSnapshot = {
      userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    };

    for (const item of profileItems) {
      if (item.dataType.startsWith('META#')) {
        const meta = item as ProgressMetaItem;
        // lastStudyDate may be '' (stored "none") or absent (bare marker
        // items) — both read as null, the client's UserProgress shape.
        const lastStudyDate = meta.lastStudyDate ?? '';
        empty.userProgress = {
          totalStars: meta.totalStars ?? 0,
          currentStreakDays: meta.currentStreakDays ?? 0,
          lastStudyDate: lastStudyDate === '' ? null : lastStudyDate,
        };
      } else if (item.dataType.startsWith('TOPIC#')) {
        const attempt = item as TopicAttemptItem;
        const key = `${attempt.subjectId}:${attempt.topicId}`;
        const entry = empty.topicProgress[key] ?? {
          topicId: attempt.topicId,
          subjectId: attempt.subjectId,
          topicTitle: attempt.topicTitle,
          subjectTitle: attempt.subjectTitle,
          attempts: [],
        };
        entry.attempts.push({
          attemptId: attempt.attemptId,
          date: attempt.date,
          correctCount: attempt.correctCount,
          totalCount: attempt.totalCount,
          questionResults: attempt.questionResults,
        });
        empty.topicProgress[key] = entry;
      } else if (item.dataType.startsWith('EXAM#')) {
        const exam = item as ExamAttemptItem;
        empty.examResults.push({
          attemptId: exam.attemptId,
          examId: exam.examId,
          date: exam.date,
          correctCount: exam.correctCount,
          totalCount: exam.totalCount,
          secondsUsed: exam.secondsUsed,
        });
      } else if (item.dataType.startsWith('LADDER#')) {
        const ladder = item as LadderItem;
        empty.ladderProgress[ladder.courseId] = ladder.levels;
      } else if (item.dataType.startsWith('FLASHCARD#')) {
        const card = item as FlashcardItem;
        empty.flashcardProgress[card.cardId] = {
          status: card.status,
          lastReviewed: card.lastReviewed,
          knownStreak: card.knownStreak,
        };
      }
    }

    // Per-topic read cap: latest 50 attempts, chronological order.
    for (const key of Object.keys(empty.topicProgress)) {
      const attempts = empty.topicProgress[key].attempts;
      attempts.sort((a, b) => a.date.localeCompare(b.date));
      empty.topicProgress[key].attempts = attempts.slice(-TOPIC_ATTEMPTS_READ_CAP);
    }
    empty.examResults.sort((a, b) => a.date.localeCompare(b.date));

    snapshots[profileId] = empty;
  }
  return snapshots;
}

async function applyEvent(
  event: ProgressEvent,
  userId: string,
  storage: ProgressStorage
): Promise<void> {
  switch (event.type) {
    case 'quizAttempt': {
      const item: TopicAttemptItem = {
        userId,
        dataType: `TOPIC#${event.profileId}#${event.subjectId}:${event.topicId}#${event.attemptId}`,
        profileId: event.profileId,
        attemptId: event.attemptId,
        subjectId: event.subjectId,
        topicId: event.topicId,
        topicTitle: event.topicTitle,
        subjectTitle: event.subjectTitle,
        date: event.date,
        correctCount: event.correctCount,
        totalCount: event.totalCount,
        ...(event.questionResults ? { questionResults: event.questionResults } : {}),
      };
      await storage.putTopicAttempt(item); // false = already applied (replay)
      return;
    }
    case 'examResult': {
      const item: ExamAttemptItem = {
        userId,
        dataType: `EXAM#${event.profileId}#${event.examId}#${event.attemptId}`,
        profileId: event.profileId,
        attemptId: event.attemptId,
        examId: event.examId,
        date: event.date,
        correctCount: event.correctCount,
        totalCount: event.totalCount,
        secondsUsed: event.secondsUsed,
      };
      await storage.putExamAttempt(item);
      return;
    }
    case 'ladderResult': {
      const item: LadderItem = {
        userId,
        dataType: `LADDER#${event.profileId}#${event.courseId}`,
        profileId: event.profileId,
        courseId: event.courseId,
        levels: {},
      };
      await storage.updateLadderLevel(item, event.level, event.score, event.date);
      return;
    }
    case 'flashcardResult': {
      const item: FlashcardItem = {
        userId,
        dataType: `FLASHCARD#${event.profileId}#${event.cardId}`,
        profileId: event.profileId,
        cardId: event.cardId,
        status: event.status,
        lastReviewed: event.date,
        knownStreak: event.knownStreak,
      };
      await storage.putFlashcard(item);
      return;
    }
  }
}

/** GET /api/progress — full per-profile snapshot for merge-on-login. */
export async function handleProgressGet(
  req: Request,
  deps: { storage: ProgressStorage } = getProgressDeps()
): Promise<Response> {
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return NOT_AUTHENTICATED();

  const items = await deps.storage.listProgressByUser(auth.user.userId);
  const res = json({ profiles: buildSnapshots(items) });
  return withCookie(res, auth.refreshCookie);
}

/** POST /api/progress/sync — batch push of local events (single profile per batch). */
export async function handleProgressSync(
  req: Request,
  deps: { storage: ProgressStorage } = getProgressDeps()
): Promise<Response> {
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return NOT_AUTHENTICATED();

  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid request' }, 400);

  // Rule 5: profileId is data — every event must target one of THIS user's
  // child profiles (a foreign profileId, including another account's, is 400).
  const validProfiles = new Set(auth.user.childProfiles.map((p) => p.profileId));
  const profileIds = new Set(parsed.data.events.map((e) => e.profileId));
  if (profileIds.size !== 1 || !validProfiles.has([...profileIds][0])) {
    return json({ error: 'Invalid request' }, 400);
  }

  // The whole batch is validated before anything is written: a malformed
  // batch is rejected atomically (no partial application from bad input).
  const profileId = [...profileIds][0];
  const now = new Date().toISOString();

  for (const event of parsed.data.events) {
    await applyEvent(event, auth.user.userId, deps.storage);
  }

  const metaItem: ProgressMetaItem = {
    userId: auth.user.userId,
    dataType: `META#${profileId}`,
    profileId,
    totalStars: parsed.data.clientMeta.totalStars,
    currentStreakDays: parsed.data.clientMeta.currentStreakDays,
    lastStudyDate: parsed.data.clientMeta.lastStudyDate ?? '',
    lastSyncedAt: now,
  };
  await deps.storage.mergeMeta(metaItem);

  // C5: first-login migration stamp — idempotent by construction (the
  // storage layer's attribute_not_exists marker returns false on replay).
  if (parsed.data.markMigrationComplete) {
    await deps.storage.setMigrationCompleted(auth.user.userId, profileId, now);
  }

  const serverMeta = await deps.storage.getMeta(auth.user.userId, profileId);
  const res = json({
    synced: parsed.data.events.length,
    serverMeta: {
      totalStars: serverMeta?.totalStars ?? metaItem.totalStars,
      currentStreakDays: serverMeta?.currentStreakDays ?? metaItem.currentStreakDays,
      lastStudyDate: serverMeta?.lastStudyDate ? serverMeta.lastStudyDate : null,
    },
  });
  return withCookie(res, auth.refreshCookie);
}

/** GET /api/progress/_health — unauthenticated IAM probe (C6 smoke). */
export async function handleProgressHealth(
  _req: Request,
  deps: { storage: ProgressStorage } = getProgressDeps()
): Promise<Response> {
  // Limit-1 Query on a fixed probe key — exercises the real failure class
  // (missing table / missing Query grant) with zero data exposure. 200 = the
  // table AND the IAM grant work; anything else = 500.
  try {
    await deps.storage.probeProgressTable();
    return json({ ok: true });
  } catch (err) {
    console.error('[progress] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}
