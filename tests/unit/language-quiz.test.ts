import { describe, expect, it } from 'vitest';
import { getSubject } from '@/content/registry';
import { getContentTopic } from '@/content/registry.content';
import { gradeChineseAnswer, gradeTargetLanguageAnswer, year7LanguageFor } from '@/lib/language-quiz';

describe('Year 7 target-language quiz configuration', () => {
  it('applies only to Year 7 German and Chinese', () => {
    expect(year7LanguageFor('german', 7)).toBe('de-DE');
    expect(year7LanguageFor('chinese', 7)).toBe('zh-CN');
    expect(year7LanguageFor('german', 8)).toBeUndefined();
    expect(year7LanguageFor('chinese', 9)).toBeUndefined();
    expect(year7LanguageFor('math', 7)).toBeUndefined();
  });

  it('converts every Year 7 language topic without changing later year groups', () => {
    for (const subjectId of ['german', 'chinese'] as const) {
      const subject = getSubject(subjectId)!;
      const year7 = subject.topics.filter((topic) => topic.year === 7);
      expect(year7).toHaveLength(subjectId === 'german' ? 5 : 6);

      for (const meta of subject.topics) {
        const topic = getContentTopic(subjectId, meta.id)!;
        if (meta.year === 7) {
          expect(topic.templates, topic.id).toBeUndefined();
          expect(topic.questions, topic.id).toHaveLength(15);
          for (const question of topic.questions) {
            expect(question.correctIndex, question.id).toBe(0);
            expect(question.choices.length, question.id).toBeGreaterThanOrEqual(1);
            expect(question.choices.length, question.id).toBeLessThanOrEqual(4);
            for (const answer of question.choices) {
              expect(
                gradeTargetLanguageAnswer(answer, question.choices, year7LanguageFor(subjectId, 7)!),
                `${question.id}: ${answer}`,
              ).toEqual({ correct: true, needsSpellingCheck: false });
            }
          }
        } else {
          expect(topic.questions.every((question) => question.choices.length === 4), topic.id).toBe(true);
        }
      }
    }
  });
});

describe('German target-language answers', () => {
  it('accepts every complete alternative without a spelling reminder', () => {
    expect(gradeTargetLanguageAnswer(
      'Ich habe Chemie nicht gern, aber ich habe Bio gern.',
      ['Ich habe nicht gern Chemie, aber ich habe Bio gern.', 'Ich habe Chemie nicht gern, aber ich habe Bio gern.'],
      'de-DE',
    )).toEqual({ correct: true, needsSpellingCheck: false });
  });

  it('retains spelling tolerance and strict articles', () => {
    expect(gradeTargetLanguageAnswer('Der Hun', ['der Hund'], 'de-DE')).toEqual({
      correct: true,
      needsSpellingCheck: true,
    });
    expect(gradeTargetLanguageAnswer('die Hund', ['der Hund'], 'de-DE').correct).toBe(false);
    expect(gradeTargetLanguageAnswer(
      'Ich habe einen schwarze Katze.',
      ['Ich habe eine schwarze Katze.'],
      'de-DE',
    ).correct).toBe(false);
    expect(gradeTargetLanguageAnswer(
      'Mein Lieblingstier ist die Elefant, weil er so groß ist.',
      ['Mein Lieblingstier ist der Elefant, weil er so groß ist.'],
      'de-DE',
    ).correct).toBe(false);
  });
});

describe('Chinese target-language answers', () => {
  it('accepts Simplified and Traditional Chinese with flexible spaces and punctuation', () => {
    expect(gradeChineseAnswer(' 老师！ ', ['老师', '老師'])).toEqual({ correct: true, needsSpellingCheck: false });
    expect(gradeChineseAnswer('老師', ['老师', '老師'])).toEqual({ correct: true, needsSpellingCheck: false });
    expect(gradeChineseAnswer('我 很 好， 謝 謝', ['我很好，谢谢。', '我很好，謝謝。'])).toEqual({
      correct: true,
      needsSpellingCheck: false,
    });
  });

  it('rejects pinyin, English, fragments and incorrect characters', () => {
    for (const answer of ['laoshi', 'teacher', '老', '老帅', '']) {
      expect(gradeChineseAnswer(answer, ['老师', '老師']).correct, answer).toBe(false);
    }
  });
});
