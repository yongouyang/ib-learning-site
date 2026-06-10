import { TopicProgress } from '@/content/types';
import { getRecentAverageScore } from './progress-store';

export function getWeakTopics(allProgress: TopicProgress[]): TopicProgress[] {
  return allProgress
    .filter((tp) => tp.attempts.length > 0 && getRecentAverageScore(tp.attempts) < 0.7)
    .sort((a, b) => getRecentAverageScore(a.attempts) - getRecentAverageScore(b.attempts))
    .slice(0, 5);
}
