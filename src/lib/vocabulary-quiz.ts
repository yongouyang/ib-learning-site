import type { Flashcard, Question } from '@/content/types';
import { seededShuffle } from '@/lib/quiz-utils';

function isDetailedDefinition(definition: string): boolean {
  return definition.length > 32 || /[;():]/.test(definition);
}

function distractorDistance(candidate: Flashcard, card: Flashcard): number {
  const shapeDifference = Number(isDetailedDefinition(candidate.definition) !== isDetailedDefinition(card.definition));
  const articleDifference = Number(/^(der|die|das)\s/.test(candidate.term) !== /^(der|die|das)\s/.test(card.term));
  const candidateWords = candidate.definition.split(/\s+/).length;
  const cardWords = card.definition.split(/\s+/).length;
  return shapeDifference * 1000
    + articleDifference * 100
    + Math.abs(candidateWords - cardWords) * 8
    + Math.abs(candidate.definition.length - card.definition.length);
}

export function buildVocabularyQuestions(flashcards: Flashcard[], seed: string): Question[] {
  return flashcards.map((card) => {
    const distractors = seededShuffle(
      flashcards.filter((candidate) => candidate.id !== card.id && candidate.definition !== card.definition),
      `${seed}:${card.id}:distractors`,
    )
      .sort((a, b) => distractorDistance(a, card) - distractorDistance(b, card))
      .slice(0, 3)
      .map((candidate) => candidate.definition);
    const choices = seededShuffle([card.definition, ...distractors], `${seed}:${card.id}:choices`);

    return {
      id: `${card.id}-vocab`,
      stem: `What does “${card.term}” mean?`,
      choices,
      correctIndex: choices.indexOf(card.definition),
      explanation: `**${card.term}** — ${card.definition}${card.example ? ` · Example: ${card.example}` : ''}`,
    };
  });
}
