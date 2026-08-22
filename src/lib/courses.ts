import { Topic } from '@/content/types';
import { getSubjects } from '@/content/registry';

// Shared course groupings — consumed by diagnostics (/diagnostics), mock exams
// (/exams) and the revision ladder. Add IGCSE entries here when content lands.
export interface Course {
  id: string;
  title: string;
  matches: (topic: Topic) => boolean;
}

export const COURSES: Course[] = [
  {
    id: 'math-y7',
    title: 'Math — Year 7',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 7,
  },
  {
    id: 'math-y8',
    title: 'Math — Year 8',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 8,
  },
  {
    id: 'math-y9',
    title: 'Math — Year 9',
    matches: (t) => t.subjectId === 'math' && t.stage === 'ks3' && t.year === 9,
  },
  {
    id: 'math-dp-ai',
    title: 'Math — DP Applications & Interpretation',
    matches: (t) => t.subjectId === 'math' && t.stage === 'dp' && t.course === 'ai',
  },
  {
    id: 'eng-ks3',
    title: 'English — KS3',
    matches: (t) => t.subjectId === 'english' && t.stage === 'ks3',
  },
  {
    id: 'bio-ks3',
    title: 'Biology — KS3',
    matches: (t) => t.subjectId === 'biology' && t.stage === 'ks3',
  },
  {
    id: 'chem-ks3',
    title: 'Chemistry — KS3',
    matches: (t) => t.subjectId === 'chemistry' && t.stage === 'ks3',
  },
  {
    id: 'phys-ks3',
    title: 'Physics — KS3',
    matches: (t) => t.subjectId === 'physics' && t.stage === 'ks3',
  },
  {
    id: 'geog-ks3',
    title: 'Geography — KS3',
    matches: (t) => t.subjectId === 'geography' && t.stage === 'ks3',
  },
  {
    id: 'hist-ks3',
    title: 'History — KS3',
    matches: (t) => t.subjectId === 'history' && t.stage === 'ks3',
  },
  {
    id: 'ict-ks3',
    title: 'ICT — KS3',
    matches: (t) => t.subjectId === 'ict' && t.stage === 'ks3',
  },
  {
    id: 'chin-ks3',
    title: 'Chinese — KS3',
    matches: (t) => t.subjectId === 'chinese' && t.stage === 'ks3',
  },
  {
    id: 'germ-ks3',
    title: 'German — KS3',
    matches: (t) => t.subjectId === 'german' && t.stage === 'ks3',
  },
];

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export function getCourseTopics(course: Course): Topic[] {
  return getSubjects().flatMap((s) => s.topics).filter(course.matches);
}
