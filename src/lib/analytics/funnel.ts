export interface FunnelEvent {
  name: string;
  props: Record<string, unknown>;
  sessionId: string;
  ua: string;
  s: string;
}

export interface FunnelBucket {
  attempts: number;
  startEvents: number;
  reachedFirstQuestion: number;
  completed: number;
  completionRate: number | null;
  furthestQuestion: Record<string, number>;
}

export interface QuizFunnel {
  attempts: number;
  linkedAttempts: number;
  legacyAttempts: number;
  bySource: Record<string, FunnelBucket>;
  byDevice: Record<string, FunnelBucket>;
  legacyBySource: Record<string, FunnelBucket>;
  legacyByDevice: Record<string, FunnelBucket>;
}

function deviceOf(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop/other';
}

function emptyBucket(): FunnelBucket {
  return { attempts: 0, startEvents: 0, reachedFirstQuestion: 0, completed: 0, completionRate: null, furthestQuestion: {} };
}

function addAttempt(bucket: FunnelBucket, attempt: { startEvents: number; maxQuestion: number; completed: boolean }): void {
  bucket.attempts += 1;
  bucket.startEvents += attempt.startEvents;
  if (attempt.maxQuestion > 0) bucket.reachedFirstQuestion += 1;
  if (attempt.completed) bucket.completed += 1;
  const furthest = String(attempt.maxQuestion);
  bucket.furthestQuestion[furthest] = (bucket.furthestQuestion[furthest] ?? 0) + 1;
  bucket.completionRate = bucket.attempts > 0 ? Math.round((bucket.completed / bucket.attempts) * 1000) / 10 : null;
}

export function buildQuizFunnel(events: FunnelEvent[]): QuizFunnel {
  const attempts = new Map<string, { source: string; device: string; startEvents: number; maxQuestion: number; completed: boolean }>();
  const sorted = [...events].sort((a, b) => a.s.localeCompare(b.s));
  for (const event of sorted) {
    if (!['quiz_started', 'quiz_question_answered', 'quiz_completed'].includes(event.name)) continue;
    const attemptId = typeof event.props.attemptId === 'string' ? event.props.attemptId : null;
    const topicId = typeof event.props.topicId === 'string' ? event.props.topicId : 'unknown';
    const key = attemptId ?? `legacy:${event.sessionId}:${topicId}`;
    const source = typeof event.props.source === 'string' ? event.props.source : topicId === 'mixed-review' ? 'mixed_review' : 'unknown';
    const current = attempts.get(key) ?? {
      source,
      device: deviceOf(event.ua),
      startEvents: 0,
      maxQuestion: 0,
      completed: false,
    };
    if (event.name === 'quiz_started') current.startEvents += 1;
    if (event.name === 'quiz_question_answered' && typeof event.props.questionNumber === 'number') {
      current.maxQuestion = Math.max(current.maxQuestion, event.props.questionNumber);
    }
    if (event.name === 'quiz_completed') current.completed = true;
    attempts.set(key, current);
  }

  const bySource: Record<string, FunnelBucket> = {};
  const byDevice: Record<string, FunnelBucket> = {};
  const legacyBySource: Record<string, FunnelBucket> = {};
  const legacyByDevice: Record<string, FunnelBucket> = {};
  let legacyAttempts = 0;
  for (const [key, attempt] of attempts) {
    const legacy = key.startsWith('legacy:');
    if (legacy) legacyAttempts += 1;
    const sourceBuckets = legacy ? legacyBySource : bySource;
    const deviceBuckets = legacy ? legacyByDevice : byDevice;
    const source = sourceBuckets[attempt.source] ?? (sourceBuckets[attempt.source] = emptyBucket());
    const device = deviceBuckets[attempt.device] ?? (deviceBuckets[attempt.device] = emptyBucket());
    addAttempt(source, attempt);
    addAttempt(device, attempt);
  }
  return {
    attempts: attempts.size,
    linkedAttempts: attempts.size - legacyAttempts,
    legacyAttempts,
    bySource,
    byDevice,
    legacyBySource,
    legacyByDevice,
  };
}
