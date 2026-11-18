'use client';

import { useMemo, useRef, useState } from 'react';
import QuizGame from '@/components/QuizGame';
import { useProgress } from '@/context/ProgressContext';
import type { Flashcard, QuestionResult, SubjectId } from '@/content/types';
import { randomSeed } from '@/lib/quiz-utils';
import { buildVocabularyQuestions } from '@/lib/vocabulary-quiz';

interface VocabularyQuizPageClientProps {
  subjectId: SubjectId;
  topicId: string;
  topicTitle: string;
  subjectName: string;
  flashcards: Flashcard[];
}

export default function VocabularyQuizPageClient({
  subjectId,
  topicId,
  topicTitle,
  subjectName,
  flashcards,
}: VocabularyQuizPageClientProps) {
  const { recordAttempt } = useProgress();
  const resultsRef = useRef<QuestionResult[]>([]);
  const [seed, setSeed] = useState(`${topicId}:vocabulary:initial`);
  const questions = useMemo(() => buildVocabularyQuestions(flashcards, seed), [flashcards, seed]);

  const handleNewSet = () => {
    resultsRef.current = [];
    setSeed(`${topicId}:vocabulary:${randomSeed()}`);
  };

  return (
    <QuizGame
      key={seed}
      questions={questions}
      shuffleSeed={`${seed}:questions`}
      subtitle={`${topicTitle} · ${flashcards.length} vocabulary questions`}
      backHref={`/subjects/${subjectId}`}
      backLabel="Back to German Topics"
      breadcrumbs={[
        { href: '/', label: 'Home' },
        { href: `/subjects/${subjectId}`, label: subjectName },
        { href: `/subjects/${subjectId}/${topicId}/study`, label: topicTitle },
        { label: 'Vocabulary Quiz' },
      ]}
      analytics={{ subjectId, topicId, source: 'vocabulary_quiz' }}
      onQuestionResult={(_questionId, _correct, _questionNumber, _totalCount, result) => {
        resultsRef.current.push(result);
      }}
      onComplete={(correctCount, totalCount) => {
        recordAttempt(topicId, subjectId, topicTitle, subjectName, correctCount, totalCount, resultsRef.current);
        resultsRef.current = [];
      }}
      onNewSet={handleNewSet}
      newSetLabel="Shuffle Questions"
      accessibleTitle={`Vocabulary Quiz: ${topicTitle}`}
    />
  );
}
