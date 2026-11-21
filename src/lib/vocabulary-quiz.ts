import type { Flashcard, Question } from '@/content/types';
import { seededShuffle } from '@/lib/quiz-utils';

function englishPrompt(definition: string): string {
  return definition.split(' — ')[0].split('; ')[0].replace(/\s+\([^()]*\)$/, '').trim();
}

function isDetailedTerm(term: string): boolean {
  return term.length > 32 || /[;():]/.test(term);
}

function distractorDistance(candidate: Flashcard, card: Flashcard): number {
  const shapeDifference = Number(isDetailedTerm(candidate.term) !== isDetailedTerm(card.term));
  const articleDifference = Number(/^(der|die|das)\s/.test(candidate.term) !== /^(der|die|das)\s/.test(card.term));
  const candidateWords = candidate.term.split(/\s+/).length;
  const cardWords = card.term.split(/\s+/).length;
  return shapeDifference * 1000
    + articleDifference * 100
    + Math.abs(candidateWords - cardWords) * 8
    + Math.abs(candidate.term.length - card.term.length);
}

export function buildVocabularyQuestions(flashcards: Flashcard[], seed: string): Question[] {
  return flashcards.map((card) => {
    const distractors = seededShuffle(
      flashcards.filter((candidate) => candidate.id !== card.id && candidate.term !== card.term),
      `${seed}:${card.id}:distractors`,
    )
      .sort((a, b) => distractorDistance(a, card) - distractorDistance(b, card))
      .slice(0, 3)
      .map((candidate) => candidate.term);
    const choices = seededShuffle([card.term, ...distractors], `${seed}:${card.id}:choices`);

    return {
      id: `${card.id}-vocab`,
      stem: `What is “${englishPrompt(card.definition)}” in German?`,
      choices,
      correctIndex: choices.indexOf(card.term),
      explanation: `**${card.term}** — ${card.definition}${card.example ? ` · Example: ${card.example}` : ''}`,
    };
  });
}
