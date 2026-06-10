import { describe, it, expect } from 'vitest';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import type { TopicProgress } from '@/content/types';

function makeProgress(topicId: string, scores: number[]): TopicProgress {
  return {
    topicId,
    subjectId: 'math',
    topicTitle: 'Test',
    subjectTitle: 'Math',
    attempts: scores.map((s) => ({
      date: new Date().toISOString(),
      correctCount: Math.round(s * 10),
      totalCount: 10,
    })),
  };
}

describe('weak-point-analyzer', () => {
  it('should return topics with average below 70%', () => {
    const progress: TopicProgress[] = [
      makeProgress('t1', [0.9, 0.85, 0.95]),
      makeProgress('t2', [0.5, 0.6, 0.55]),
      makeProgress('t3', [0.3, 0.4]),
      makeProgress('t4', []), // no attempts
    ];
    const weak = getWeakTopics(progress);
    expect(weak).toHaveLength(2);
    expect(weak[0].topicId).toBe('t3'); // lowest score first
    expect(weak[1].topicId).toBe('t2');
  });

  it('should return empty array when all scores are good', () => {
    const progress = [makeProgress('t1', [0.8, 0.9, 0.95])];
    expect(getWeakTopics(progress)).toHaveLength(0);
  });

  it('should cap at 5 weak topics', () => {
    const progress = Array.from({ length: 7 }, (_, i) => makeProgress(`t${i}`, [0.5]));
    const weak = getWeakTopics(progress);
    expect(weak).toHaveLength(5);
  });
});
