import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_DAILY_XP_CAP,
  LEADERBOARD_TOP_N,
  NEIGHBOURHOOD_RADIUS,
  OPEN_COHORT,
  isLeaderboardScope,
  isWeekKey,
  prevWeekKey,
  rankBoard,
  scopeWeekPartitionKey,
  stageScope,
  weekEndMs,
  weekKeyFor,
  weekStartMs,
  weekTtlEpochSeconds,
  xpDayBucketKey,
  xpTopicBucketKey,
  type LeaderboardEntryItem,
} from '@/lib/leaderboard/types';

// Week-math anchors (all verified against the ISO-8601 rule "week 1 contains
// the year's first Thursday, weeks start Monday 00:00 UTC"):
//   2026-01-01 is a Thursday → 2026 is a 53-week year starting Mon 2025-12-29
//   2025 starts on a Wednesday (non-leap) → 52 weeks

describe('weekKeyFor', () => {
  it.each([
    ['2025-12-28T12:00:00.000Z', '2025-W52'], // Sunday before the 2026 week-1 Monday
    ['2025-12-29T00:00:00.000Z', '2026-W01'], // week-1 Monday
    ['2026-01-01T00:00:00.000Z', '2026-W01'], // the Thursday that anchors 2026
    ['2026-01-04T23:59:59.999Z', '2026-W01'], // Sunday end of week 1
    ['2026-01-05T00:00:00.000Z', '2026-W02'], // next Monday
    ['2026-12-28T00:00:00.000Z', '2026-W53'], // 53-week year
    ['2027-01-03T23:59:59.999Z', '2026-W53'], // Jan 1–3 2027 still in 2026-W53
    ['2027-01-04T00:00:00.000Z', '2027-W01'],
    ['2020-12-31T12:00:00.000Z', '2020-W53'], // another 53-week year
    ['2021-01-01T12:00:00.000Z', '2020-W53'],
  ])('maps %s to %s', (iso, weekKey) => {
    expect(weekKeyFor(Date.parse(iso))).toBe(weekKey);
  });
});

describe('weekStartMs / weekEndMs', () => {
  it('round-trips every instant to the Monday 00:00 UTC of its week', () => {
    for (const iso of ['2026-08-23T02:58:19.202Z', '2025-12-31T23:00:00.000Z', '2027-06-15T08:30:00.000Z']) {
      const ms = Date.parse(iso);
      const key = weekKeyFor(ms);
      const start = weekStartMs(key);
      expect(start).toBeLessThanOrEqual(ms);
      expect(ms).toBeLessThan(start + 7 * 86_400_000);
      expect(new Date(start).toISOString().slice(0, 10)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(start).getUTCDay()).toBe(1); // Monday
      expect(weekEndMs(key)).toBe(start + 7 * 86_400_000);
    }
  });

  it('computes known week starts', () => {
    expect(weekStartMs('2026-W01')).toBe(Date.UTC(2025, 11, 29));
    expect(weekStartMs('2026-W53')).toBe(Date.UTC(2026, 11, 28));
    expect(weekEndMs('2026-W01')).toBe(Date.UTC(2026, 0, 5));
  });

  it('returns NaN for impossible weeks (2025 has only 52)', () => {
    expect(Number.isNaN(weekStartMs('2025-W53'))).toBe(true);
    expect(Number.isNaN(weekStartMs('garbage'))).toBe(true);
  });
});

describe('prevWeekKey', () => {
  it('walks back across year boundaries', () => {
    expect(prevWeekKey('2026-W01')).toBe('2025-W52');
    expect(prevWeekKey('2027-W01')).toBe('2026-W53');
    expect(prevWeekKey('2026-W02')).toBe('2026-W01');
  });
});

describe('isWeekKey', () => {
  it('accepts real weeks only', () => {
    expect(isWeekKey('2026-W35')).toBe(true);
    expect(isWeekKey('2026-W53')).toBe(true);
    expect(isWeekKey('2025-W53')).toBe(false); // 2025 has 52 weeks
    expect(isWeekKey('2026-W00')).toBe(false);
    expect(isWeekKey('2026-W54')).toBe(false);
    expect(isWeekKey('2026-W5')).toBe(false);
    expect(isWeekKey('26-W35')).toBe(false);
    expect(isWeekKey('')).toBe(false);
  });
});

describe('weekTtlEpochSeconds', () => {
  it('is week end + 14 days', () => {
    // 2026-W01 ends Mon 2026-01-05; TTL = Mon 2026-01-19 00:00 UTC.
    expect(weekTtlEpochSeconds('2026-W01')).toBe(Date.UTC(2026, 0, 19) / 1000);
  });
});

describe('scopes and keys', () => {
  it('maps stages to stage scopes', () => {
    expect(stageScope('ks3')).toBe('stage:ks3');
    expect(stageScope('igcse')).toBe('stage:igcse');
    expect(stageScope('dp')).toBe('stage:dp');
  });

  it('validates scope strings', () => {
    expect(isLeaderboardScope('stage:ks3')).toBe(true);
    expect(isLeaderboardScope('global')).toBe(true);
    expect(isLeaderboardScope('stage:gcse')).toBe(false);
    expect(isLeaderboardScope('stage:ks3#x')).toBe(false);
  });

  it('builds the scopeWeek partition key with the open cohort by default', () => {
    expect(scopeWeekPartitionKey('stage:ks3', '2026-W35')).toBe(`stage:ks3#2026-W35#${OPEN_COHORT}`);
    expect(scopeWeekPartitionKey('global', '2026-W35', 'c42')).toBe('global#2026-W35#c42');
  });

  it('builds the rate-limit bucket keys', () => {
    expect(xpDayBucketKey('prof1', '2026-08-23')).toBe('xpday:prof1:2026-08-23');
    expect(xpTopicBucketKey('prof1', 'math-yr7-algebra-1', '2026-W34')).toBe(
      'xp-topic:prof1:math-yr7-algebra-1:2026-W34',
    );
  });

  it('pins the board geometry constants', () => {
    expect(LEADERBOARD_TOP_N).toBe(100);
    expect(NEIGHBOURHOOD_RADIUS).toBe(2);
    expect(LEADERBOARD_DAILY_XP_CAP).toBe(500);
  });
});

describe('rankBoard', () => {
  const entry = (id: string, xp: number, lastEarnedAt = '2026-08-20T10:00:00.000Z') =>
    ({ entry: id, handle: `Handle ${id}`, xp, lastEarnedAt }) satisfies Pick<
      LeaderboardEntryItem,
      'entry' | 'handle' | 'xp' | 'lastEarnedAt'
    >;

  it('ranks by xp descending with 1-based ranks', () => {
    const board = rankBoard([entry('a', 50), entry('b', 200), entry('c', 100)], null);
    expect(board.top.map((r) => [r.entry, r.rank])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
    expect(board.totalEntries).toBe(3);
  });

  it('breaks xp ties by earlier lastEarnedAt, then handle', () => {
    const board = rankBoard(
      [
        entry('b', 100, '2026-08-21T10:00:00.000Z'),
        { entry: 'a', handle: 'Alpha Ape', xp: 100, lastEarnedAt: '2026-08-21T10:00:00.000Z' },
        entry('c', 100, '2026-08-20T10:00:00.000Z'),
      ],
      null,
    );
    expect(board.top.map((r) => r.entry)).toEqual(['c', 'a', 'b']); // earliest first; same ts → handle asc
  });

  it('caps the top list at LEADERBOARD_TOP_N', () => {
    const entries = Array.from({ length: 120 }, (_, i) => entry(`p${i}`, 120 - i));
    const board = rankBoard(entries, null);
    expect(board.top).toHaveLength(100);
    expect(board.totalEntries).toBe(120);
    expect(board.top[0]).toMatchObject({ entry: 'p0', rank: 1 });
  });

  it('returns null self and an empty neighbourhood when the caller has no entry', () => {
    const board = rankBoard([entry('a', 50)], 'nobody');
    expect(board.self).toBeNull();
    expect(board.neighbourhood).toEqual([]);
  });

  it('windows the neighbourhood 2 above / self / 2 below around the caller', () => {
    const entries = Array.from({ length: 9 }, (_, i) => entry(`p${i + 1}`, 900 - i * 100));
    const board = rankBoard(entries, 'p5');
    expect(board.self).toMatchObject({ entry: 'p5', rank: 5, xp: 500 });
    expect(board.neighbourhood.map((r) => r.entry)).toEqual(['p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('clips the neighbourhood at both ends of the board', () => {
    const entries = [entry('a', 300), entry('b', 200), entry('c', 100)];
    expect(rankBoard(entries, 'a').neighbourhood.map((r) => r.entry)).toEqual(['a', 'b', 'c']);
    expect(rankBoard(entries, 'c').neighbourhood.map((r) => r.entry)).toEqual(['a', 'b', 'c']);
    expect(rankBoard(entries, 'b').neighbourhood.map((r) => r.entry)).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty board', () => {
    const board = rankBoard([], 'anyone');
    expect(board).toEqual({ top: [], self: null, neighbourhood: [], totalEntries: 0 });
  });
});
