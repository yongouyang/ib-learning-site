import type { Flashcard, Question } from '@/content/types';

export interface VocabularyAnswerGrade {
  correct: boolean;
  needsSpellingCheck: boolean;
}

function englishPrompt(definition: string): string {
  return definition.split(' — ')[0].split('; ')[0].replace(/\s+\([^()]*\)$/, '').trim();
}

function normaliseAnswer(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[.!?…]+$/g, '');
}

function foldedAnswer(text: string): string {
  return normaliseAnswer(text).toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

function articleForms(text: string): string[] {
  return normaliseAnswer(text).toLocaleLowerCase('de-DE')
    .match(/\b(?:der|die|das|dem|den|des|ein|eine|einem|einen|eines|einer|kein|keine|keinem|keinen|keines|keiner)\b/g) ?? [];
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function acceptedAnswers(term: string): string[] {
  const answers = new Set<string>([term]);
  const trailingParenthetical = term.match(/\s+\(([^()]*)\)$/);
  if (trailingParenthetical) {
    answers.add(term.slice(0, trailingParenthetical.index).trim());
    answers.add(trailingParenthetical[1]);
    answers.add(`${term.slice(0, trailingParenthetical.index)} ${trailingParenthetical[1]}`.trim());
  }

  for (const answer of [...answers]) {
    if (answer.includes(' / ')) {
      const alternatives = answer.split(' / ');
      if (alternatives.every((alternative) => alternative.includes(' '))) {
        for (const alternative of alternatives) answers.add(alternative);
      }
    }
    const optional = answer.match(/\(([^()]*)\)/);
    if (optional && optional.index! + optional[0].length < answer.length) {
      answers.add(answer.replace(optional[0], optional[1]));
      answers.add(answer.replace(optional[0], ''));
    }
  }
  return [...answers];
}

export function gradeVocabularyAnswer(answer: string, expectedTerm: string): VocabularyAnswerGrade {
  const normalised = normaliseAnswer(answer);
  if (!normalised) return { correct: false, needsSpellingCheck: false };
  const folded = foldedAnswer(normalised);
  const articles = articleForms(normalised);

  for (const accepted of acceptedAnswers(expectedTerm)) {
    const expectedArticles = articleForms(accepted);
    if (expectedArticles.length !== articles.length || expectedArticles.some((article, index) => article !== articles[index])) continue;
    if (normaliseAnswer(accepted) === normalised) return { correct: true, needsSpellingCheck: false };

    const foldedExpected = foldedAnswer(accepted);
    const distance = editDistance(folded, foldedExpected);
    if (distance === 0) return { correct: true, needsSpellingCheck: true };
    const allowance = foldedExpected.length >= 16 ? 2 : foldedExpected.length >= 4 ? 1 : 0;
    if (distance <= allowance) return { correct: true, needsSpellingCheck: true };
  }

  return { correct: false, needsSpellingCheck: false };
}

export function buildVocabularyQuestions(flashcards: Flashcard[]): Question[] {
  return flashcards.map((card) => ({
    id: `${card.id}-vocab`,
    stem: `What is “${englishPrompt(card.definition)}” in German?`,
    choices: [card.term],
    correctIndex: 0,
    explanation: `**${card.term}** — ${card.definition}${card.example ? ` · Example: ${card.example}` : ''}`,
  }));
}
