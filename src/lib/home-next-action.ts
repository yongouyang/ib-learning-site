import type { FlashcardProgress, TopicProgress } from '@/content/types';
import type { DueTopic } from './flashcard-scheduler';
import { getWeakTopics } from './weak-point-analyzer';

export interface NextAction {
  href: string;
  label: string;
  summary: string | null;
}

// The single most useful next action for a returning student, in priority order:
// 1. due flashcards (spaced-repetition review is time-sensitive — do it today)
// 2. weak topics (practise what's weakest)
// 3. a mock exam (all caught up — challenge yourself)
export function getNextAction(
  dueTopics: DueTopic[],
  topicProgress: TopicProgress[],
): NextAction {
  const totalDue = dueTopics.reduce((sum, t) => sum + t.dueCount, 0);

  if (totalDue > 0) {
    const first = dueTopics[0];
    return {
      href: `/subjects/${first.subjectId}/${first.topicId}/flashcards?filter=due`,
      label: 'Review flashcards',
      summary: `${totalDue} flashcard${totalDue !== 1 ? 's' : ''} due`,
    };
  }

  const weakTopics = getWeakTopics(topicProgress);
  if (weakTopics.length > 0) {
    return {
      href: '/mixed-review?mode=weak',
      label: 'Practise weak areas',
      summary: `${weakTopics.length} topic${weakTopics.length !== 1 ? 's' : ''} to strengthen`,
    };
  }

  return { href: '/exams', label: 'Try a mock exam', summary: null };
}
