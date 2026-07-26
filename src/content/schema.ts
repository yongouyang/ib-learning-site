import { z } from 'zod';

export const subjectIdSchema = z.enum(['english', 'math', 'biology', 'chemistry', 'physics']);

export const stageSchema = z.enum(['ks3', 'igcse', 'dp']);

export const yearSchema = z.union([z.literal(7), z.literal(8), z.literal(9)]);

export const courseLevelSchema = z.enum(['core', 'extended', 'sl', 'hl']);

export const illustrationSchema = z.object({
  src: z.string().regex(/^\/images\//, 'illustration src must start with /images/'),
  alt: z.string().min(1),
  caption: z.string().optional(),
});

export const conceptNoteSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  body: z.string().min(1),
  illustration: illustrationSchema.optional(),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().optional(),
});

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const questionSchema = z.object({
  id: z.string().min(1),
  stem: z.string().min(1),
  choices: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  difficulty: difficultySchema.optional(),
  // Math only: true = calculator expected/allowed (feeds Phase 3 calc/non-calc pools).
  calculator: z.boolean().optional(),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  subjectId: subjectIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  stage: stageSchema,
  year: yearSchema.optional(),
  course: z.string().min(1).optional(),
  level: courseLevelSchema.optional(),
  notes: z.array(conceptNoteSchema).min(1),
  flashcards: z.array(flashcardSchema).min(1),
  questions: z.array(questionSchema).min(1),
});

// Phase 4 — free-response practice sets ("past-paper-style", original questions only).
// Lives in src/content/data/papers/<courseId>/<set-id>.json — kept OUT of the MC
// questions array (QuizGame expects choices/correctIndex).
export const freeResponseQuestionSchema = z
  .object({
    id: z.string().min(1),
    stem: z.string().min(1),
    marks: z.number().int().min(1).max(10),
    // One tickable point per mark (M1/A1/B1 style — see CONTENT_STYLE.md).
    markscheme: z.array(z.string().min(1)).min(1),
    modelAnswer: z.string().min(1),
    difficulty: difficultySchema.optional(),
    // Reserved for future calc-allowed papers; the non-calculator policy
    // currently requires this to be absent (enforced by validate-content).
    calculator: z.boolean().optional(),
  })
  .refine((q) => q.markscheme.length === q.marks, {
    message: 'markscheme must contain exactly one point per mark',
    path: ['markscheme'],
  });

export const paperSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+-set-\d+$/, 'paper id must look like <courseId>-set-<n>'),
  courseId: z.string().min(1),
  title: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(120).optional(),
  questions: z.array(freeResponseQuestionSchema).min(5),
});

export const subjectMetaSchema = z.object({
  id: subjectIdSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  accentColor: z.string().min(1),
});

export const subjectSchema = z.object({
  id: subjectIdSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  accentColor: z.string().min(1),
  topics: z.array(topicSchema),
});

export type ValidatedSubjectId = z.infer<typeof subjectIdSchema>;
export type ValidatedStage = z.infer<typeof stageSchema>;
export type ValidatedCourseLevel = z.infer<typeof courseLevelSchema>;
export type ValidatedDifficulty = z.infer<typeof difficultySchema>;
export type ValidatedConceptNote = z.infer<typeof conceptNoteSchema>;
export type ValidatedFlashcard = z.infer<typeof flashcardSchema>;
export type ValidatedQuestion = z.infer<typeof questionSchema>;
export type ValidatedFreeResponseQuestion = z.infer<typeof freeResponseQuestionSchema>;
export type ValidatedPaper = z.infer<typeof paperSchema>;
export type ValidatedTopic = z.infer<typeof topicSchema>;
export type ValidatedSubject = z.infer<typeof subjectSchema>;
