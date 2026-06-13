import type { Topic } from '@/content/types';

export type LevelFilter = 'all' | 'MYP' | 'DP';

export interface TopicFilterState {
  query: string;
  level: LevelFilter;
}

export function filterTopics(
  topics: Topic[],
  { query, level }: TopicFilterState,
): Topic[] {
  const normalizedQuery = query.trim().toLowerCase();

  return topics.filter((topic) => {
    const matchesLevel = level === 'all' || topic.ibLevel === level;
    if (!matchesLevel) return false;

    if (normalizedQuery === '') return true;

    const matchesTitle = topic.title.toLowerCase().includes(normalizedQuery);
    const matchesDescription = topic.description
      .toLowerCase()
      .includes(normalizedQuery);

    return matchesTitle || matchesDescription;
  });
}
