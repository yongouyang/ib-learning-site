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

export const questionSchema = z.object({
  id: z.string().min(1),
  stem: z.string().min(1),
  choices: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
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
export type ValidatedConceptNote = z.infer<typeof conceptNoteSchema>;
export type ValidatedFlashcard = z.infer<typeof flashcardSchema>;
export type ValidatedQuestion = z.infer<typeof questionSchema>;
export type ValidatedTopic = z.infer<typeof topicSchema>;
export type ValidatedSubject = z.infer<typeof subjectSchema>;
