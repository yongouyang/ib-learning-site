import type { Stage } from '@/content/types';

export type StageFilter = 'all' | Stage;

export interface TopicFilterState {
  query: string;
  stage: StageFilter;
}

/** Generic so metadata topics (SubjectPageClient) and content topics both keep their type. */
export function filterTopics<T extends { title: string; description: string; stage: Stage }>(
  topics: T[],
  { query, stage }: TopicFilterState,
): T[] {
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
