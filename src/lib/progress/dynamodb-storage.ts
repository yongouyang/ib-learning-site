import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '../auth/types';
import {
  XP_DAY_BUCKET_TTL_SECONDS,
  XP_TOPIC_BUCKET_TTL_SECONDS,
  xpDayBucketKey,
  xpTopicBucketKey,
} from '../leaderboard/types';
import type {
  ExamAttemptItem,
  FlashcardItem,
  FlashcardWriteResult,
  LadderItem,
  LadderWriteResult,
  ProgressItem,
  ProgressMetaItem,
  ProgressStorage,
  TopicAttemptItem,
} from './types';

// Production progress adapter: the ProgressStorage contract on the Phase 0
// tables. The session-validation subset is delegated to the SAME
// DynamoAuthStorage the auth Lambda uses (one source of truth for session
// reads/writes), and the progress items live in octav-progress (PK userId,
// SK dataType). Every write is a single conditional command — atomic and
// idempotent (rule 6):
//   putTopicAttempt/putExamAttempt  Put     attribute_not_exists(dataType)
//   putFlashcard                    Put     lastReviewed monotonic (LWW),
//                                           ReturnValues ALL_OLD (D4 prior status)
//   updateLadderLevel               Update  levels.#lvl missing OR worse score,
//                                           ReturnValues ALL_OLD (D4 prior best)
//   mergeMeta                       Update  per-field max condition
//   setMigrationCompleted           Update  attribute_not_exists(marker)
//   incrementXpDayBucket            Update  ADD with cap condition (octav-rate-limits)
//   incrementXpTopicBucket          Update  ADD, unconditional (octav-rate-limits)

interface TableNames {
  users: string;
  sessions: string;
  progress: string;
  rateLimits: string;
}

/** Session subset delegate (same implementation the auth handler uses). */
interface SessionSubset {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoProgressStorage implements ProgressStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: SessionSubset,
    private readonly clock: () => number = Date.now
  ) {}

  // --- Session subset (delegated — src/lib/auth/session.ts) --------------------

  getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessionStorage.getSession(sessionId);
  }

  getUserById(userId: string): Promise<UserRecord | null> {
    return this.sessionStorage.getUserById(userId);
  }

  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void> {
    return this.sessionStorage.updateSession(sessionId, updates);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.sessionStorage.deleteSession(sessionId);
  }

  // --- Progress items ----------------------------------------------------------

  async listProgressByUser(userId: string): Promise<ProgressItem[]> {
    // Paginated (round 2): a single Query page caps at 1MB — the append-only
    // per-attempt items can exceed that (~700 typical attempts; fewer with
    // full questionResults). Looping LastEvaluatedKey collects every page so
    // GET /api/progress, export, and delete-account see the COMPLETE set.
    const items: ProgressItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tables.progress,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      items.push(...((res.Items ?? []) as ProgressItem[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  async probeProgressTable(): Promise<void> {
    // C6 smoke: Limit-1 Query on a key that never exists. 200/void = the
    // table AND the Query grant work; AccessDenied/ResourceNotFound throws
    // (the handler converts that into a 500 for the smoke check).
    await this.client.send(
      new QueryCommand({
        TableName: this.tables.progress,
        KeyConditionExpression: 'userId = :probe',
        ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
        Limit: 1,
      })
    );
  }

  // --- Durable sync budget (octav-rate-limits) --------------------------------

  async incrementProgressSyncCount(userId: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the bucket key (the auth /
    // analytics limiter pattern): each window is a fresh item, so the counter
    // resets ATOMICALLY in a single UpdateCommand when the window rolls — no
    // dependence on TTL deletion (best-effort, up to ~48h lag).
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clock() / windowMs);
    const bucket = `progress-sync:${userId}:${epoch}`;
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: syncs 1..limit succeed
          // and limit+1 fails — but only within THIS window's bucket.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (epoch + 1) * windowSeconds, // TTL: end of this epoch window
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- Phase D4 XP buckets (octav-rate-limits — docs/leaderboard-plan.md §4.1) ---

  async incrementXpDayBucket(profileId: string, dateUtc: string, delta: number, cap: number): Promise<number> {
    // Daily soft cap, ONE conditional command (the aimark: pattern): the date
    // is IN the bucket key, so the counter resets atomically each UTC day; the
    // TTL is cleanup only. The condition evaluates the PRE-update count, so a
    // bucket already at/over the cap rejects the write → 0 awardable.
    // Otherwise the write commits the FULL delta (the bucket may overshoot the
    // cap by one delta — documented, harmless) and ALL_NEW gives the new
    // count, from which the awardable amount is derived:
    //   preCount = newCount - delta;  awarded = min(delta, max(0, cap - preCount)).
    try {
      const res = await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket: xpDayBucketKey(profileId, dateUtc) },
          UpdateExpression: 'ADD #c :delta SET expiresAt = :exp',
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :cap',
          ReturnValues: 'ALL_NEW',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':delta': delta,
            ':cap': cap,
            ':exp': Math.floor(this.clock() / 1000) + XP_DAY_BUCKET_TTL_SECONDS,
          },
        })
      );
      const newCount = (res.Attributes as { count?: number } | undefined)?.count ?? 0;
      return Math.min(delta, Math.max(0, cap - (newCount - delta)));
    } catch (err) {
      if (isConditionalFailure(err)) return 0;
      throw err;
    }
  }

  async incrementXpTopicBucket(profileId: string, topicId: string, weekKey: string): Promise<number> {
    // Diminishing-repeats counter, ONE unconditional ADD: ALL_NEW returns the
    // new count — the 1-based weekly attempt ordinal for repeatMultiplier.
    // The weekKey is IN the bucket key, so the counter resets each week.
    const res = await this.client.send(
      new UpdateCommand({
        TableName: this.tables.rateLimits,
        Key: { bucket: xpTopicBucketKey(profileId, topicId, weekKey) },
        UpdateExpression: 'ADD #c :one SET expiresAt = :exp',
        ReturnValues: 'ALL_NEW',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: {
          ':one': 1,
          ':exp': Math.floor(this.clock() / 1000) + XP_TOPIC_BUCKET_TTL_SECONDS,
        },
      })
    );
    return (res.Attributes as { count?: number } | undefined)?.count ?? 0;
  }

  async deleteProgressByUser(userId: string): Promise<void> {
    const items = await this.listProgressByUser(userId);
    await Promise.all(
      items.map((item) =>
        this.client.send(
          new DeleteCommand({
            TableName: this.tables.progress,
            Key: { userId: item.userId, dataType: item.dataType },
          })
        )
      )
    );
  }

  async getMeta(userId: string, profileId: string): Promise<ProgressMetaItem | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tables.progress,
        Key: { userId, dataType: `META#${profileId}` },
      })
    );
    return (res.Item as ProgressMetaItem | undefined) ?? null;
  }

  async putTopicAttempt(item: TopicAttemptItem): Promise<boolean> {
    return this.putIfAbsent(item);
  }

  async putExamAttempt(item: ExamAttemptItem): Promise<boolean> {
    return this.putIfAbsent(item);
  }

  async putFlashcard(item: FlashcardItem): Promise<FlashcardWriteResult> {
    // LWW per card: an older review must not overwrite a newer one; an equal
    // timestamp re-writes the same values (idempotent replay). The condition
    // evaluates the PRE-put item, so the stored copy is never regressed.
    // ReturnValues ALL_OLD (D4): the prior status comes back with the SAME
    // write — no extra read to detect a not-known → known transition.
    try {
      const res = await this.client.send(
        new PutCommand({
          TableName: this.tables.progress,
          Item: item,
          ConditionExpression: 'attribute_not_exists(lastReviewed) OR lastReviewed <= :ts',
          ReturnValues: 'ALL_OLD',
          ExpressionAttributeValues: { ':ts': item.lastReviewed },
        })
      );
      const old = res.Attributes as FlashcardItem | undefined;
      return { applied: true, previousStatus: old?.status ?? null };
    } catch (err) {
      // A rejected (stale) write has no readable prior state — report null
      // (previousStatus is only meaningful when applied).
      if (isConditionalFailure(err)) return { applied: false, previousStatus: null };
      throw err;
    }
  }

  async updateLadderLevel(
    item: LadderItem,
    level: number,
    bestScore: number,
    completedAt: string
  ): Promise<LadderWriteResult> {
    // Atomic max-wins per level. Missing level → set; stored worse score →
    // overwrite; stored equal-or-better → conditional failure (treated as
    // already applied — replay of a synced event cannot regress or duplicate).
    // profileId/courseId are persisted alongside levels so the read path can
    // key the ladder map without parsing the SK. ReturnValues ALL_OLD (D4):
    // the stored pre-write best comes back with the SAME command — no extra
    // read to detect a first pass.
    const levelKey = String(level);
    try {
      const res = await this.client.send(
        new UpdateCommand({
          TableName: this.tables.progress,
          Key: { userId: item.userId, dataType: item.dataType },
          UpdateExpression: 'SET #lvls.#lvl = :val, profileId = :pid, courseId = :cid',
          ConditionExpression: 'attribute_not_exists(#lvls.#lvl) OR #lvls.#lvl.bestScore < :score',
          ReturnValues: 'ALL_OLD',
          ExpressionAttributeNames: { '#lvls': 'levels', '#lvl': levelKey },
          ExpressionAttributeValues: {
            ':val': { bestScore, completedAt },
            ':score': bestScore,
            ':pid': item.profileId,
            ':cid': item.courseId,
          },
        })
      );
      const old = res.Attributes as LadderItem | undefined;
      return { improved: true, previousBestScore: old?.levels?.[levelKey]?.bestScore ?? null };
    } catch (err) {
      // A rejected (not-improved) write has no readable prior state — report
      // null (previousBestScore is only meaningful when improved).
      if (isConditionalFailure(err)) return { improved: false, previousBestScore: null };
      throw err;
    }
  }

  async mergeMeta(item: ProgressMetaItem): Promise<boolean> {
    // Per-field max-merge via ONE conditional update per field: DynamoDB has
    // no max() in UpdateExpression, and a single SET of all fields would
    // regress a field that didn't improve (e.g. lower stars but newer streak
    // would overwrite the higher stars). Each field's max is atomic and
    // idempotent on its own. lastStudyDate uses '' for "none" (see types);
    // an empty incoming date is skipped — it must not regress a real one.
    const applied: boolean[] = [];
    for (const [field, value] of [
      ['totalStars', item.totalStars],
      ['currentStreakDays', item.currentStreakDays],
      ...(item.lastStudyDate !== '' ? ([['lastStudyDate', item.lastStudyDate]] as [string, string | number][]) : []),
    ] as [string, string | number][]) {
      applied.push(await this.conditionalMaxSet(item.userId, item.dataType, item.profileId, item.lastSyncedAt, field, value));
    }
    return applied.some(Boolean);
  }

  private async conditionalMaxSet(
    userId: string,
    dataType: string,
    profileId: string,
    lastSyncedAt: string,
    field: string,
    value: string | number
  ): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.progress,
          Key: { userId, dataType },
          UpdateExpression: 'SET #f = :v, profileId = :pid, lastSyncedAt = :now',
          ConditionExpression: 'attribute_not_exists(#f) OR #f < :v',
          ExpressionAttributeNames: { '#f': field },
          ExpressionAttributeValues: { ':v': value, ':pid': profileId, ':now': lastSyncedAt },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async setMigrationCompleted(userId: string, profileId: string, completedAt: string): Promise<boolean> {
    // Exactly-once per profile: attribute_not_exists on a MISSING item passes
    // in DynamoDB, so this both creates the META row and stamps the marker.
    // The base fields mirror the dummy so a bare-marker item still reads as a
    // valid (empty) META row.
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.progress,
          Key: { userId, dataType: `META#${profileId}` },
          UpdateExpression:
            'SET migrationCompletedAt = :at, profileId = :pid, totalStars = if_not_exists(totalStars, :zero), currentStreakDays = if_not_exists(currentStreakDays, :zero), lastStudyDate = if_not_exists(lastStudyDate, :empty), lastSyncedAt = if_not_exists(lastSyncedAt, :at)',
          ConditionExpression: 'attribute_not_exists(migrationCompletedAt)',
          ExpressionAttributeValues: { ':at': completedAt, ':pid': profileId, ':zero': 0, ':empty': '' },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- Internals ---------------------------------------------------------------

  private async putIfAbsent(item: TopicAttemptItem | ExamAttemptItem): Promise<boolean> {
    // Idempotent append: the SK encodes the attemptId, so a replayed event
    // hits attribute_not_exists(dataType) and is treated as already applied.
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tables.progress,
          Item: item,
          ConditionExpression: 'attribute_not_exists(dataType)',
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }
}
