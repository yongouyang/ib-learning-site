export type SubjectId = 'english' | 'math' | 'biology' | 'chemistry' | 'physics';

export type IBLevel = 'MYP' | 'DP';

export interface ConceptNote {
  id: string;
  heading: string;
  body: string;
}

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  example?: string;
}

export interface Question {
  id: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  title: string;
  description: string;
  ibLevel: IBLevel;
  notes: ConceptNote[];
  flashcards: Flashcard[];
  questions: Question[];
}

export interface Subject {
  id: SubjectId;
  name: string;
  icon: string; // SF Symbol name equivalent
  accentColor: string; // hex color
  topics: Topic[];
}

export interface QuizAttempt {
  date: string; // ISO string
  correctCount: number;
  totalCount: number;
}

export interface TopicProgress {
  topicId: string;
  subjectId: SubjectId;
  topicTitle: string;
  subjectTitle: string;
  attempts: QuizAttempt[];
}

export interface UserProgress {
  totalStars: number;
  currentStreakDays: number;
  lastStudyDate: string | null; // ISO string
}

export interface SubjectSummary {
  subjectId: SubjectId;
  completedTopics: number;
  totalTopics: number;
  averageScore: number;
}
