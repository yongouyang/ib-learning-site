import { Subject, SubjectId } from './types';
import { mathSubject } from './math';
import { englishSubject } from './english';
import { chemistrySubject } from './chemistry';
import { physicsSubject } from './physics';

import type { Topic } from './types';

// Biology topics loaded from JSON files (pilot for content migration)
import biologySubjectsMeta from './data/subjects.json';
import bioCellJson from './data/topics/biology/bio-cell-1.json';
import bioPhotosynthesisJson from './data/topics/biology/bio-photosynthesis-1.json';
import bioBodyJson from './data/topics/biology/bio-body-1.json';
import bioGeneticsJson from './data/topics/biology/bio-genetics-1.json';
import bioEcologyJson from './data/topics/biology/bio-ecology-1.json';

const bioCell = bioCellJson as Topic;
const bioPhotosynthesis = bioPhotosynthesisJson as Topic;
const bioBody = bioBodyJson as Topic;
const bioGenetics = bioGeneticsJson as Topic;
const bioEcology = bioEcologyJson as Topic;

const biologyMeta = biologySubjectsMeta.find((s) => s.id === 'biology')!;

const biologySubject: Subject = {
  id: biologyMeta.id as SubjectId,
  name: biologyMeta.name,
  icon: biologyMeta.icon,
  accentColor: biologyMeta.accentColor,
  topics: [bioCell, bioPhotosynthesis, bioBody, bioGenetics, bioEcology],
};

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
  biology: { name: biologyMeta.name, icon: biologyMeta.icon, color: biologyMeta.accentColor },
  chemistry: { name: 'Chemistry', icon: 'flask', color: '#F97316' },
  physics: { name: 'Physics', icon: 'atom', color: '#EF4444' },
};
