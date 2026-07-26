export type SubjectId = 'english' | 'math' | 'biology' | 'chemistry' | 'physics';

export type Stage = 'ks3' | 'igcse' | 'dp';

export type CourseLevel = 'core' | 'extended' | 'sl' | 'hl';

export interface Illustration {
  src: string;
  alt: string;
  caption?: string;
}

export interface ConceptNote {
  id: string;
  heading: string;
  body: string;
  illustration?: Illustration;
}

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  example?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: Difficulty;
  /** Math only: true = calculator expected/allowed (feeds Phase 3 calc/non-calc pools). */
  calculator?: boolean;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  title: string;
  description: string;
  stage: Stage;
  year?: 7 | 8 | 9;
  course?: string;
  level?: CourseLevel;
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

// Phase 4 — free-response practice sets (past-paper-style, original questions).
export interface FreeResponseQuestion {
  id: string;
  stem: string;
  marks: number;
  /** One tickable point per mark (M1/A1/B1 style); length === marks. */
  markscheme: string[];
  modelAnswer: string;
  difficulty?: Difficulty;
  calculator?: boolean;
}

export interface Paper {
  id: string; // <courseId>-set-<n>
  courseId: string;
  title: string;
  durationMinutes?: number;
  questions: FreeResponseQuestion[];
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

export interface ExamResult {
  examId: string; // `${courseId}:${paperId}`
  date: string; // ISO string
  correctCount: number;
  totalCount: number;
  secondsUsed: number;
}

export interface LadderLevelResult {
  bestScore: number; // fraction 0–1
  completedAt: string; // ISO string
}

export interface FlashcardProgress {
  status: 'known' | 'learning';
  lastReviewed: string; // ISO string
  knownStreak: number; // consecutive "I know this" marks (drives spaced-repetition interval)
}

export interface SubjectSummary {
  subjectId: SubjectId;
  completedTopics: number;
  totalTopics: number;
  averageScore: number;
}
