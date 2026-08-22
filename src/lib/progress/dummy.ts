import { InMemoryAuthStorage } from '../auth/dummy';
import type {
  ExamAttemptItem,
  FlashcardItem,
  LadderItem,
  ProgressItem,
  ProgressMetaItem,
  ProgressStorage,
  TopicAttemptItem,
} from './types';

// In-memory progress dummy — the controllable-dummy directive (AGENTS.md):
// dev and e2e run against this with zero AWS resources. It EXTENDS the auth
// dummy so auth routes and progress routes share ONE in-memory universe (a
// session written by the auth route is visible to the progress route, and
// export/delete-account see seeded progress). Every conditional write mirrors
// the DynamoDB adapter's semantics EXACTLY (same condition outcomes, same
// error shapes) — the parity test drives both against a simulated DynamoDB
// implementation.

export class InMemoryProgressStorage extends InMemoryAuthStorage implements ProgressStorage {
  private readonly progressItems = new Map<string, ProgressItem[]>();
  // Durable sync-budget mirror: fixed-window counter map. The clock is the
  // BASE class's (protected, shared with the analytics dummy via the
  // constructor chain) so one injectable clock drives every limiter.
  private readonly syncCounters = new Map<string, number>();

  async incrementProgressSyncCount(userId: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window budget with the window epoch IN the key — the counter
    // resets atomically when the window rolls (the previous bucket is simply
    // never read again). Mirrors the DynamoDB bucket design.
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clock() / windowMs);
    const key = `progress-sync:${userId}:${epoch}`;
    const count = this.syncCounters.get(key) ?? 0;
    if (count >= limit) return false;
    this.syncCounters.set(key, count + 1);
    return true;
  }

  async listProgressByUser(userId: string): Promise<ProgressItem[]> {
    return [...(this.progressItems.get(userId) ?? [])];
  }

  async deleteProgressByUser(userId: string): Promise<void> {
    this.progressItems.delete(userId);
  }

  async getMeta(userId: string, profileId: string): Promise<ProgressMetaItem | null> {
    const items = this.progressItems.get(userId);
    if (!items) return null;
    const meta = items.find(
      (i) => i.dataType === `META#${profileId}`
    ) as ProgressMetaItem | undefined;
    return meta ?? null;
  }

  async probeProgressTable(): Promise<void> {
    // The in-memory dummy has no IAM/table to fail — the probe is a no-op
    // (its DynamoDB counterpart performs the Limit-1 Query).
  }

  async putTopicAttempt(item: TopicAttemptItem): Promise<boolean> {
    // Mirrors PutCommand with attribute_not_exists(dataType): an item with the
    // same SK means this attempt was already applied.
    return this.putIfAbsent(item);
  }

  async putExamAttempt(item: ExamAttemptItem): Promise<boolean> {
    return this.putIfAbsent(item);
  }

  async putFlashcard(item: FlashcardItem): Promise<boolean> {
    // LWW per card with a monotonic lastReviewed condition: an OLDER review
    // must not overwrite a newer one; an equal timestamp re-writes the same
    // values (idempotent replay).
    const items = this.itemsFor(item.userId);
    const existing = items.find((i) => i.dataType === item.dataType) as FlashcardItem | undefined;
    if (existing && existing.lastReviewed > item.lastReviewed) return false;
    this.replaceItem(item);
    return true;
  }

  async updateLadderLevel(
    item: LadderItem,
    level: number,
    bestScore: number,
    completedAt: string
  ): Promise<boolean> {
    // Atomic max-wins per level: a stored equal-or-better score makes the
    // update fail (treated as already-applied) — the same semantics as the
    // DynamoDB condition `attribute_not_exists(levels.#lvl) OR
    // levels.#lvl.bestScore < :score`.
    const items = this.itemsFor(item.userId);
    const existing = items.find((i) => i.dataType === item.dataType) as LadderItem | undefined;
    const stored = existing?.levels[String(level)];
    if (stored && stored.bestScore >= bestScore) return false;
    const levels = { ...(existing?.levels ?? {}) };
    levels[String(level)] = { bestScore, completedAt };
    this.replaceItem({ ...(existing ?? item), levels } as LadderItem);
    return true;
  }

  async mergeMeta(item: ProgressMetaItem): Promise<boolean> {
    // Per-field max-merge, mirroring the DynamoDB adapter's ONE conditional
    // update per field: a field that didn't improve must never be overwritten
    // (a lower-stars + newer-streak sync keeps the higher stars). An empty
    // incoming lastStudyDate is skipped — it must not regress a real date.
    let applied = false;

    const applyField = (field: 'totalStars' | 'currentStreakDays' | 'lastStudyDate', value: string | number) => {
      // Re-read per field: each application may have created the item.
      const current = this.metaFor(item.userId, item.profileId);
      if (!current || (current[field] as string | number) < value) {
        this.replaceItem({
          ...(current ?? {
            userId: item.userId,
            dataType: item.dataType,
            profileId: item.profileId,
            totalStars: 0,
            currentStreakDays: 0,
            lastStudyDate: '',
            lastSyncedAt: item.lastSyncedAt,
          }),
          [field]: value,
          profileId: item.profileId,
          lastSyncedAt: item.lastSyncedAt,
        } as ProgressMetaItem);
        applied = true;
      }
    };

    applyField('totalStars', item.totalStars);
    applyField('currentStreakDays', item.currentStreakDays);
    if (item.lastStudyDate !== '') applyField('lastStudyDate', item.lastStudyDate);
    return applied;
  }

  private metaFor(userId: string, profileId: string): ProgressMetaItem | undefined {
    const items = this.progressItems.get(userId);
    return items?.find((i) => i.dataType === `META#${profileId}`) as ProgressMetaItem | undefined;
  }

  async setMigrationCompleted(userId: string, profileId: string, completedAt: string): Promise<boolean> {
    // Exactly-once marker: attribute_not_exists(migrationCompletedAt) on the
    // META item — true only the first time (the item may not exist yet, which
    // the UpdateCommand's condition treats as satisfying attribute_not_exists).
    const dataType = `META#${profileId}`;
    const items = this.itemsFor(userId);
    const existing = items.find((i) => i.dataType === dataType) as ProgressMetaItem | undefined;
    if (existing?.migrationCompletedAt !== undefined) return false;
    this.replaceItem({
      ...(existing ?? {
        userId,
        dataType,
        profileId,
        totalStars: 0,
        currentStreakDays: 0,
        lastStudyDate: '',
        lastSyncedAt: completedAt,
      }),
      migrationCompletedAt: completedAt,
    } as ProgressMetaItem);
    return true;
  }

  // --- Internals ---------------------------------------------------------------

  private itemsFor(userId: string): ProgressItem[] {
    let items = this.progressItems.get(userId);
    if (!items) {
      items = [];
      this.progressItems.set(userId, items);
    }
    return items;
  }

  private replaceItem(item: ProgressItem): void {
    const items = this.itemsFor(item.userId);
    const index = items.findIndex((i) => i.dataType === item.dataType);
    if (index >= 0) items[index] = item;
    else items.push(item);
  }

  private putIfAbsent(item: ProgressItem): boolean {
    const items = this.itemsFor(item.userId);
    if (items.some((i) => i.dataType === item.dataType)) return false;
    items.push(item);
    return true;
  }
}
