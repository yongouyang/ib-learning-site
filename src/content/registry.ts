import { Subject, SubjectId } from './types';
import { mathSubject } from './math';
import { englishSubject } from './english';
import { biologySubject } from './biology';
import { chemistrySubject } from './chemistry';
import { physicsSubject } from './physics';

const subjects: Record<SubjectId, Subject> = {
  math: mathSubject,
  english: englishSubject,
  biology: biologySubject,
  chemistry: chemistrySubject,
  physics: physicsSubject,
};

export function getSubjects(): Subject[] {
  return Object.values(subjects);
}

export function getSubject(id: SubjectId): Subject | undefined {
  return subjects[id];
}

export function getTopic(subjectId: SubjectId, topicId: string) {
  return subjects[subjectId]?.topics.find((t) => t.id === topicId);
}

export const subjectMeta: Record<SubjectId, { name: string; icon: string; color: string }> = {
  math: { name: 'Math', icon: 'function', color: '#3B82F6' },
  english: { name: 'English', icon: 'book', color: '#7B5EA7' },
  biology: { name: 'Biology', icon: 'leaf', color: '#22C55E' },
  chemistry: { name: 'Chemistry', icon: 'flask', color: '#F97316' },
  physics: { name: 'Physics', icon: 'atom', color: '#EF4444' },
};
