import type { Topic } from '@/content/types';

export interface TopicGroup {
  key: string;
  label: string;
  topics: Topic[];
}

/**
 * Groups topics for the subject page: KS3 (by year, then unassigned),
 * then IGCSE, then IB DP. Empty groups are omitted.
 */
export function groupTopicsByStage(topics: Topic[]): TopicGroup[] {
  const groups: TopicGroup[] = [];
  const push = (key: string, label: string, list: Topic[]) => {
    if (list.length > 0) groups.push({ key, label, topics: list });
  };

  const ks3 = topics.filter((t) => t.stage === 'ks3');
  for (const year of [7, 8, 9] as const) {
    push(`ks3-y${year}`, `KS3 · Year ${year}`, ks3.filter((t) => t.year === year));
  }
  push('ks3', 'KS3', ks3.filter((t) => t.year === undefined));
  push('igcse', 'IGCSE', topics.filter((t) => t.stage === 'igcse'));
  push('dp', 'IB DP', topics.filter((t) => t.stage === 'dp'));

  return groups;
}
