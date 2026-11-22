import type { SpeechLanguage } from '@/lib/speech';
import { gradeVocabularyAnswer, type VocabularyAnswerGrade } from '@/lib/vocabulary-quiz';

export function year7LanguageFor(subjectId: string, year?: number): SpeechLanguage | undefined {
  if (year !== 7) return undefined;
  if (subjectId === 'german') return 'de-DE';
  if (subjectId === 'chinese') return 'zh-CN';
  return undefined;
}

function normaliseChineseAnswer(text: string): string {
  return text.normalize('NFC').replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()…·]/g, '');
}

export function gradeChineseAnswer(answer: string, expectedAnswers: string[]): VocabularyAnswerGrade {
  const normalised = normaliseChineseAnswer(answer);
  const correct = /[\u3400-\u9fff]/.test(normalised)
    && expectedAnswers.some((expected) => normaliseChineseAnswer(expected) === normalised);
  return { correct, needsSpellingCheck: false };
}

export function gradeTargetLanguageAnswer(
  answer: string,
  expectedAnswers: string[],
  language: SpeechLanguage,
): VocabularyAnswerGrade {
  if (language === 'zh-CN') return gradeChineseAnswer(answer, expectedAnswers);

  let spellingCheck: VocabularyAnswerGrade | undefined;
  for (const expected of expectedAnswers) {
    const grade = gradeVocabularyAnswer(answer, expected);
    if (grade.correct && !grade.needsSpellingCheck) return grade;
    if (grade.correct) spellingCheck = grade;
  }
  return spellingCheck ?? { correct: false, needsSpellingCheck: false };
}
