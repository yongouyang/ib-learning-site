import type { AnalyticsEventName } from './types';

export const LEARNING_JOURNEY_TTL_DAYS = 90;
export const LEARNING_JOURNEY_SCHEMA_VERSION = 1;

const ANONYMOUS_ONLY_EVENTS = new Set<AnalyticsEventName>([
  'page_performance',
  'search_performed',
  'auth_otp_requested',
  'pwa_installed',
  'pwa_offline_banner_shown',
]);

export type LearningJourneyEventName = Exclude<
  AnalyticsEventName,
  'page_performance' | 'search_performed' | 'auth_otp_requested' | 'pwa_installed' | 'pwa_offline_banner_shown'
>;

export function isLearningJourneyEvent(name: AnalyticsEventName): name is LearningJourneyEventName {
  return !ANONYMOUS_ONLY_EVENTS.has(name);
}

export interface LearningJourneyEventInput {
  userId: string;
  profileId?: string;
  eventId: string;
  name: LearningJourneyEventName;
  props: Record<string, unknown>;
  urlPath: string;
  host: string;
  sessionId: string;
  occurredAt: string;
  test: boolean;
}

export interface LearningJourneyEventItem extends LearningJourneyEventInput {
  eventKey: string;
  receivedAt: string;
  schemaVersion: typeof LEARNING_JOURNEY_SCHEMA_VERSION;
  expiresAt: number;
}

export interface LearningJourneyRange {
  from: string;
  to: string;
}

export interface LearningJourneyStorage {
  recordJourneyEvent(event: LearningJourneyEventInput): Promise<boolean>;
  listJourneyEventsByUser(userId: string, range?: LearningJourneyRange): Promise<LearningJourneyEventItem[]>;
  deleteJourneyEventsByUser(userId: string): Promise<void>;
  probeJourneyStorage(): Promise<void>;
}

export function makeLearningJourneyEventItem(
  event: LearningJourneyEventInput,
  nowMs: number
): LearningJourneyEventItem {
  return {
    ...event,
    props: { ...event.props },
    eventKey: `${event.occurredAt}#${event.eventId}`,
    receivedAt: new Date(nowMs).toISOString(),
    schemaVersion: LEARNING_JOURNEY_SCHEMA_VERSION,
    expiresAt: Math.floor(nowMs / 1000) + LEARNING_JOURNEY_TTL_DAYS * 86_400,
    ...(event.test ? { test: true } : { test: false }),
  };
}

export interface LearningJourneyReport {
  eventCount: number;
  activeDays: number;
  sessionCount: number;
  eventCounts: Record<string, number>;
  daily: Array<{ date: string; eventCount: number; eventCounts: Record<string, number> }>;
  attempts: Array<{
    attemptId: string;
    subjectId?: string;
    topicId?: string;
    firstEventAt: string;
    lastEventAt: string;
    eventCount: number;
    started: boolean;
    completed: boolean;
    correctCount?: number;
    totalCount?: number;
  }>;
  timeline: Array<{
    occurredAt: string;
    name: LearningJourneyEventName;
    eventId: string;
    profileId?: string;
    sessionId: string;
    attemptId?: string;
    urlPath: string;
    props: Record<string, unknown>;
  }>;
}

export function buildLearningJourneyReport(
  events: LearningJourneyEventItem[],
  includeTest = false
): LearningJourneyReport {
  const visible = events
    .filter((event) => includeTest || event.test !== true)
    .sort((a, b) => a.eventKey.localeCompare(b.eventKey));
  const eventCounts: Record<string, number> = {};
  const daily = new Map<string, { eventCount: number; eventCounts: Record<string, number> }>();
  const sessions = new Set<string>();
  const attempts = new Map<string, LearningJourneyReport['attempts'][number]>();

  for (const event of visible) {
    eventCounts[event.name] = (eventCounts[event.name] ?? 0) + 1;
    const date = event.occurredAt.slice(0, 10);
    const day = daily.get(date) ?? { eventCount: 0, eventCounts: {} };
    day.eventCount += 1;
    day.eventCounts[event.name] = (day.eventCounts[event.name] ?? 0) + 1;
    daily.set(date, day);
    sessions.add(event.sessionId);

    const attemptId = typeof event.props.attemptId === 'string' ? event.props.attemptId : undefined;
    if (attemptId) {
      const attempt = attempts.get(attemptId) ?? {
        attemptId,
        firstEventAt: event.occurredAt,
        lastEventAt: event.occurredAt,
        eventCount: 0,
        started: false,
        completed: false,
      };
      attempt.eventCount += 1;
      attempt.firstEventAt = attempt.firstEventAt < event.occurredAt ? attempt.firstEventAt : event.occurredAt;
      attempt.lastEventAt = attempt.lastEventAt > event.occurredAt ? attempt.lastEventAt : event.occurredAt;
      attempt.started ||= event.name === 'quiz_started';
      attempt.completed ||= event.name === 'quiz_completed';
      if (typeof event.props.subjectId === 'string') attempt.subjectId = event.props.subjectId;
      if (typeof event.props.topicId === 'string') attempt.topicId = event.props.topicId;
      if (event.name === 'quiz_completed') {
        if (typeof event.props.correctCount === 'number') attempt.correctCount = event.props.correctCount;
        if (typeof event.props.totalCount === 'number') attempt.totalCount = event.props.totalCount;
      }
      attempts.set(attemptId, attempt);
    }
  }

  return {
    eventCount: visible.length,
    activeDays: daily.size,
    sessionCount: sessions.size,
    eventCounts,
    daily: [...daily.entries()].map(([date, value]) => ({ date, ...value })),
    attempts: [...attempts.values()].sort((a, b) => a.firstEventAt.localeCompare(b.firstEventAt)),
    timeline: visible.map((event) => ({
      occurredAt: event.occurredAt,
      name: event.name,
      eventId: event.eventId,
      ...(event.profileId ? { profileId: event.profileId } : {}),
      sessionId: event.sessionId,
      ...(typeof event.props.attemptId === 'string' ? { attemptId: event.props.attemptId } : {}),
      urlPath: event.urlPath,
      props: { ...event.props },
    })),
  };
}
