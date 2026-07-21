import { describe, it, expect } from 'vitest';
import { groupTopicsByStage } from '@/lib/topic-groups';
import type { Stage, Topic } from '@/content/types';

function makeTopic(id: string, stage: Stage, year?: 7 | 8 | 9): Topic {
  return {
    id,
    subjectId: 'math',
    title: id,
    description: `Description of ${id}`,
    stage,
    ...(year !== undefined ? { year } : {}),
    notes: [],
    flashcards: [],
    questions: [],
  };
}

describe('groupTopicsByStage', () => {
  it('orders groups: KS3 years ascending, unassigned KS3, IGCSE, DP', () => {
    const topics = [
      makeTopic('dp-1', 'dp'),
      makeTopic('y9-1', 'ks3', 9),
      makeTopic('ks3-free', 'ks3'),
      makeTopic('y7-1', 'ks3', 7),
      makeTopic('ig-1', 'igcse'),
      makeTopic('y8-1', 'ks3', 8),
    ];
    const groups = groupTopicsByStage(topics);
    expect(groups.map((g) => g.key)).toEqual(['ks3-y7', 'ks3-y8', 'ks3-y9', 'ks3', 'igcse', 'dp']);
    expect(groups.map((g) => g.label)).toEqual([
      'KS3 · Year 7',
      'KS3 · Year 8',
      'KS3 · Year 9',
      'KS3',
      'IGCSE',
      'IB DP',
    ]);
    expect(groups[0].topics.map((t) => t.id)).toEqual(['y7-1']);
    expect(groups[3].topics.map((t) => t.id)).toEqual(['ks3-free']);
  });

  it('omits empty groups', () => {
    const groups = groupTopicsByStage([makeTopic('bio-1', 'ks3')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('ks3');
  });

  it('returns an empty array for no topics', () => {
    expect(groupTopicsByStage([])).toEqual([]);
  });
});
