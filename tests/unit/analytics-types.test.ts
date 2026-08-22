import { describe, it, expect } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  aggregateSortKey,
  analyticsDateOf,
  analyticsEventSchema,
  buildSummary,
  parseAggregateKey,
  utcDate,
} from '@/lib/analytics/types';

// Schema-edge tests for the wire envelope + the pure summary math shared by
// both storage implementations (the parity lesson: one fold function).

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

function envelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    name: 'page_view',
    props: {},
    url: 'https://octavlearning.com/subjects/math',
    referrer: 'https://www.google.com/',
    sessionId: 'abc-123_XY',
    clientTs: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

const validProps: Record<(typeof ANALYTICS_EVENT_NAMES)[number], Record<string, unknown>> = {
  page_view: {},
  quiz_started: { subjectId: 'math', topicId: 'math-yr7-algebra-1', source: 'topic_page' },
  quiz_completed: { subjectId: 'math', topicId: 'math-yr7-algebra-1', correctCount: 8, totalCount: 10, durationSeconds: 42 },
  flashcard_session_started: { subjectId: 'biology', topicId: 'bio-cell-1', filter: 'due' },
  flashcard_session_completed: { subjectId: 'biology', topicId: 'bio-cell-1', cardsReviewed: 12, knownCount: 9, learningCount: 3 },
  diagnostic_started: { courseId: 'math-y7' },
  diagnostic_completed: { courseId: 'math-y7', topicCount: 5, weakAreaCount: 2 },
  exam_started: { courseId: 'math-y7', paperId: 'math-y7-set-1' },
  exam_completed: { courseId: 'math-y7', paperId: 'math-y7-set-1', correctCount: 15, totalCount: 20, secondsUsed: 900, timedOut: false },
  paper_marked_with_ai: { courseId: 'math-y7', paperId: 'math-y7-set-1', questionCount: 20, totalMarks: 40 },
  cta_clicked: { ctaId: 'hero_diagnostic' },
  search_performed: { query: 'algebra', resultCount: 3 },
  auth_otp_requested: { emailDomain: 'example.com' },
  auth_login_completed: { role: 'parent' },
  auth_logout: {},
  pwa_installed: {},
  pwa_offline_banner_shown: {},
};

describe('analyticsEventSchema', () => {
  it('accepts every taxonomy name with valid props', () => {
    for (const name of ANALYTICS_EVENT_NAMES) {
      const result = analyticsEventSchema.safeParse(envelope({ name, props: validProps[name] }));
      expect(result.success, `name ${name} should parse`).toBe(true);
    }
  });

  it('rejects an unknown event name', () => {
    expect(analyticsEventSchema.safeParse(envelope({ name: 'nope' })).success).toBe(false);
  });

  it('rejects props that do not match the event name', () => {
    // quiz_started requires subjectId/topicId/source; page_view takes nothing.
    expect(analyticsEventSchema.safeParse(envelope({ name: 'quiz_started', props: {} })).success).toBe(false);
    expect(analyticsEventSchema.safeParse(envelope({ name: 'quiz_started', props: validProps.quiz_started, sessionId: 'x' })).success).toBe(true);
    expect(
      analyticsEventSchema.safeParse(
        envelope({ name: 'quiz_completed', props: { ...validProps.quiz_completed, correctCount: -1 } })
      ).success
    ).toBe(false);
    // A full email must never pass the domain-only auth_otp_requested field.
    expect(
      analyticsEventSchema.safeParse(envelope({ name: 'auth_otp_requested', props: { emailDomain: 'user@example.com' } })).success
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse(envelope({ name: 'auth_otp_requested', props: { emailDomain: 'example.com' } })).success
    ).toBe(true);
  });

  it('rejects oversized strings and insane counts', () => {
    expect(
      analyticsEventSchema.safeParse(envelope({ name: 'cta_clicked', props: { ctaId: 'x'.repeat(121) } })).success
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse(
        envelope({ name: 'quiz_completed', props: { ...validProps.quiz_completed, correctCount: 501 } })
      ).success
    ).toBe(false);
  });

  it('rejects a bad sessionId charset and an empty url', () => {
    expect(analyticsEventSchema.safeParse(envelope({ sessionId: 'has space' })).success).toBe(false);
    expect(analyticsEventSchema.safeParse(envelope({ sessionId: '' })).success).toBe(false);
    expect(analyticsEventSchema.safeParse(envelope({ url: '' })).success).toBe(false);
    expect(analyticsEventSchema.safeParse(envelope({ url: 'https://x.test/' + 'a'.repeat(2048) })).success).toBe(false);
  });

  it('defaults a missing referrer to the empty string', () => {
    const parsed = analyticsEventSchema.safeParse(envelope({ referrer: undefined }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.referrer).toBe('');
  });

  it('rejects a far-future clientTs (24h skew guard) but accepts near-now and past', () => {
    expect(analyticsEventSchema.safeParse(envelope({ clientTs: '9999-01-01T00:00:00.000Z' })).success).toBe(false);
    expect(analyticsEventSchema.safeParse(envelope({ clientTs: 'not-a-date' })).success).toBe(false);
    expect(
      analyticsEventSchema.safeParse(envelope({ clientTs: new Date(Date.now() + 60 * 60 * 1000).toISOString() })).success
    ).toBe(true);
    expect(analyticsEventSchema.safeParse(envelope({ clientTs: '2026-01-01T00:00:00.000Z' })).success).toBe(true);
  });
});

describe('pure helpers', () => {
  it('analyticsDateOf takes the date part of an ISO clientTs', () => {
    expect(analyticsDateOf('2026-08-15T10:00:00.000Z')).toBe('2026-08-15');
  });

  it('utcDate formats epoch ms as YYYY-MM-DD UTC', () => {
    expect(utcDate(NOW_MS)).toBe('2026-08-16');
    expect(utcDate(Date.parse('2026-01-02T23:59:00.000Z'))).toBe('2026-01-02');
  });

  it('aggregateSortKey/parseAggregateKey round-trip, joining stray # back into the key', () => {
    const s = aggregateSortKey('2026-08-16', 'page', '/subjects/math');
    expect(s).toBe('2026-08-16#page#/subjects/math');
    expect(parseAggregateKey(s)).toEqual({ date: '2026-08-16', kind: 'page', key: '/subjects/math' });
    expect(parseAggregateKey('2026-08-16#page#/a#b')).toEqual({ date: '2026-08-16', kind: 'page', key: '/a#b' });
  });
});

describe('buildSummary', () => {
  const agg = (s: string, count: number) => ({ s, count });

  it('folds aggregates into dailySeries/totals/hosts and ranks pages/referrers', () => {
    const summary = buildSummary(
      [
        agg('2026-08-15#event#quiz_started', 2),
        agg('2026-08-16#event#quiz_started', 1),
        agg('2026-08-15#event#page_view', 5),
        agg('2026-08-16#page#/subjects', 3),
        agg('2026-08-14#page#/subjects', 1),
        agg('2026-08-16#referrer#google.com', 2),
        agg('2026-08-16#referrer#direct', 1),
        agg('2026-08-16#host#octavlearning.com', 6),
      ],
      7,
      NOW_MS
    );

    expect(summary.days).toBe(7);
    expect(summary.dailySeries.quiz_started).toEqual({ '2026-08-15': 2, '2026-08-16': 1 });
    expect(summary.dailySeries.page_view).toEqual({ '2026-08-15': 5 });
    expect(summary.totals).toEqual({ quiz_started: 3, page_view: 5 });
    expect(summary.topPages).toEqual([{ path: '/subjects', count: 4 }]);
    expect(summary.topReferrers).toEqual([
      { referrer: 'google.com', count: 2 },
      { referrer: 'direct', count: 1 },
    ]);
    expect(summary.hosts).toEqual({ 'octavlearning.com': 6 });
  });

  it('excludes dates outside the window (future-dated clientTs and stale days)', () => {
    const summary = buildSummary(
      [
        agg('2026-08-16#event#page_view', 1),
        agg('2026-08-09#event#page_view', 9), // before the 7-day window
        agg('2026-08-17#event#page_view', 9), // future
      ],
      7,
      NOW_MS
    );
    expect(summary.totals.page_view).toBe(1);
  });

  it('caps topPages at 20 and topReferrers at 10, count-desc then key-asc', () => {
    const pages = Array.from({ length: 25 }, (_, i) => agg(`2026-08-16#page#/p${String(i).padStart(2, '0')}`, i + 1));
    const referrers = Array.from({ length: 12 }, (_, i) => agg(`2026-08-16#referrer#r${String(i).padStart(2, '0')}.com`, i + 1));
    const summary = buildSummary([...pages, ...referrers], 7, NOW_MS);

    expect(summary.topPages).toHaveLength(20);
    expect(summary.topPages[0]).toEqual({ path: '/p24', count: 25 });
    expect(summary.topPages[19].count).toBe(6);
    expect(summary.topReferrers).toHaveLength(10);
    expect(summary.topReferrers[0]).toEqual({ referrer: 'r11.com', count: 12 });
    expect(summary.topReferrers[9].count).toBe(3);
  });

  it('returns an empty-but-shaped summary with no aggregates', () => {
    expect(buildSummary([], 30, NOW_MS)).toEqual({
      days: 30,
      dailySeries: {},
      topPages: [],
      topReferrers: [],
      totals: {},
      hosts: {},
    });
  });
});
