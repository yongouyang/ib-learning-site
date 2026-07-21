import type { Stage, Topic } from '@/content/types';

export type StageFilter = 'all' | Stage;

export interface TopicFilterState {
  query: string;
  stage: StageFilter;
}

export function filterTopics(
  topics: Topic[],
  { query, stage }: TopicFilterState,
): Topic[] {
  const normalizedQuery = query.trim().toLowerCase();

  return topics.filter((topic) => {
    const matchesStage = stage === 'all' || topic.stage === stage;
    if (!matchesStage) return false;

    if (normalizedQuery === '') return true;

    const matchesTitle = topic.title.toLowerCase().includes(normalizedQuery);
    const matchesDescription = topic.description
      .toLowerCase()
      .includes(normalizedQuery);

    return matchesTitle || matchesDescription;
  });
}
