import { describe, expect, it } from 'vitest';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import {
  buildLearningJourneyReport,
  isLearningJourneyEvent,
  makeLearningJourneyEventItem,
  type LearningJourneyEventInput,
  type LearningJourneyEventItem,
} from '@/lib/analytics/journey';

const NOW = Date.parse('2026-11-27T12:00:00.000Z');

function input(overrides: Partial<LearningJourneyEventInput> = {}): LearningJourneyEventInput {
  return {
    userId: 'user-1',
    profileId: 'profile-1',
    eventId: '11111111-1111-4111-8111-111111111111',
    name: 'quiz_started',
    props: { subjectId: 'math', topicId: 'algebra', source: 'topic_page', attemptId: 'attempt-1' },
    urlPath: '/subjects/math/algebra/quiz',
    host: 'octavlearning.com',
    sessionId: 'session-1',
    occurredAt: '2026-11-26T10:00:00.000Z',
    test: false,
    ...overrides,
  };
}

function item(overrides: Partial<LearningJourneyEventInput> = {}): LearningJourneyEventItem {
  return makeLearningJourneyEventItem(input(overrides), NOW);
}

describe('learning journey event policy and storage', () => {
  it('keeps free-form, performance, OTP and PWA events anonymous', () => {
    expect(isLearningJourneyEvent('quiz_started')).toBe(true);
    expect(isLearningJourneyEvent('ai_help_rated')).toBe(true);
    expect(isLearningJourneyEvent('page_view')).toBe(true);
    expect(isLearningJourneyEvent('search_performed')).toBe(false);
    expect(isLearningJourneyEvent('page_performance')).toBe(false);
    expect(isLearningJourneyEvent('auth_otp_requested')).toBe(false);
    expect(isLearningJourneyEvent('pwa_installed')).toBe(false);
    expect(isLearningJourneyEvent('pwa_offline_banner_shown')).toBe(false);
  });

  it('builds a time-ordered key with server receipt and a 90-day TTL', () => {
    const stored = item();
    expect(stored).toMatchObject({
      userId: 'user-1',
      eventKey: '2026-11-26T10:00:00.000Z#11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-11-26T10:00:00.000Z',
      receivedAt: '2026-11-27T12:00:00.000Z',
      schemaVersion: 1,
      expiresAt: Math.floor(NOW / 1000) + 90 * 86_400,
    });
    expect(stored).not.toHaveProperty('email');
    expect(stored).not.toHaveProperty('ua');
    expect(stored).not.toHaveProperty('referrer');
  });

  it('deduplicates retries, filters time ranges and isolates account deletion', async () => {
    const storage = new InMemoryAnalyticsStorage(() => NOW);
    expect(await storage.recordJourneyEvent(input())).toBe(true);
    expect(await storage.recordJourneyEvent(input())).toBe(false);
    await storage.recordJourneyEvent(input({
      eventId: '22222222-2222-4222-8222-222222222222',
      occurredAt: '2026-11-27T09:00:00.000Z',
    }));
    await storage.recordJourneyEvent(input({ userId: 'user-2' }));

    const ranged = await storage.listJourneyEventsByUser('user-1', {
      from: '2026-11-27T00:00:00.000Z',
      to: '2026-11-27T23:59:59.999Z',
    });
    expect(ranged).toHaveLength(1);
    expect(ranged[0].eventId).toBe('22222222-2222-4222-8222-222222222222');

    await storage.deleteJourneyEventsByUser('user-1');
    expect(await storage.listJourneyEventsByUser('user-1')).toEqual([]);
    expect(await storage.listJourneyEventsByUser('user-2')).toHaveLength(1);
  });
});

describe('learning journey report', () => {
  it('groups multiple days and attempts, excludes QA by default and keeps incomplete attempts visible', () => {
    const events = [
      item(),
      item({
        eventId: '22222222-2222-4222-8222-222222222222',
        name: 'quiz_completed',
        occurredAt: '2026-11-26T10:04:00.000Z',
        props: { subjectId: 'math', topicId: 'algebra', attemptId: 'attempt-1', correctCount: 3, totalCount: 4 },
      }),
      item({
        eventId: '33333333-3333-4333-8333-333333333333',
        name: 'quiz_started',
        occurredAt: '2026-11-27T08:00:00.000Z',
        sessionId: 'session-2',
        props: { subjectId: 'math', topicId: 'geometry', source: 'topic_page', attemptId: 'attempt-2' },
      }),
      item({
        eventId: '44444444-4444-4444-8444-444444444444',
        name: 'page_view',
        occurredAt: '2026-11-27T08:01:00.000Z',
        props: {},
        test: true,
      }),
    ];

    const report = buildLearningJourneyReport(events);
    expect(report.eventCount).toBe(3);
    expect(report.activeDays).toBe(2);
    expect(report.sessionCount).toBe(2);
    expect(report.eventCounts).toEqual({ quiz_started: 2, quiz_completed: 1 });
    expect(report.daily.map((day) => [day.date, day.eventCount])).toEqual([
      ['2026-11-26', 2],
      ['2026-11-27', 1],
    ]);
    expect(report.attempts).toEqual([
      expect.objectContaining({ attemptId: 'attempt-1', started: true, completed: true, correctCount: 3, totalCount: 4 }),
      expect.objectContaining({ attemptId: 'attempt-2', started: true, completed: false }),
    ]);
    expect(buildLearningJourneyReport(events, true).eventCount).toBe(4);
  });
});
