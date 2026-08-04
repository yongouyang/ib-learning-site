import type { EnglishStrand, Topic } from '@/content/types';

export interface TopicGroup {
  key: string;
  label: string;
  topics: Topic[];
}

// KS3 English strand grouping (statutory strands); only applied when topics carry
// `strand` — subjects without it (math, science) fall through to the plain KS3 group.
const STRAND_ORDER: { strand: EnglishStrand; label: string }[] = [
  { strand: 'reading', label: 'Reading' },
  { strand: 'writing', label: 'Writing' },
  { strand: 'grammar-vocabulary', label: 'Grammar & Vocabulary' },
  { strand: 'spoken-english', label: 'Spoken English' },
];

/**
 * Groups topics for the subject page: KS3 (by year; then by strand for topics
 * that carry one, e.g. English; then unassigned), then IGCSE, then IB DP.
 * Empty groups are omitted.
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
  const unassigned = ks3.filter((t) => t.year === undefined);
  for (const { strand, label } of STRAND_ORDER) {
    push(`ks3-${strand}`, `KS3 · ${label}`, unassigned.filter((t) => t.strand === strand));
  }
  push('ks3', 'KS3', unassigned.filter((t) => t.strand === undefined));
  push('igcse', 'IGCSE', topics.filter((t) => t.stage === 'igcse'));
  push('dp', 'IB DP', topics.filter((t) => t.stage === 'dp'));

  return groups;
}
