import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MistakesPage from '@/app/mistakes/page';
import type { TopicProgress } from '@/content/types';

let mockProgress: TopicProgress[] = [];

vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({ loaded: true, topicProgress: mockProgress }),
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/mistakes' }));

describe('typed answers in the mistake notebook and revision sheet', () => {
  it('shows the typed response without choice labels or accepted-answer option lists', () => {
    mockProgress = [{
      topicId: 'chin-yr7-greetings-names', subjectId: 'chinese',
      topicTitle: 'Greetings & Names', subjectTitle: 'Chinese',
      attempts: [{
        date: '2026-11-21T00:00:00.000Z', correctCount: 0, totalCount: 1,
        questionResults: [{
          questionId: 'chin-yr7-greetings-names-q3', correct: false, selectedIndex: -1,
          textAnswer: 'laoshi', answerMode: 'text',
          question: {
            id: 'chin-yr7-greetings-names-q3', stem: 'What is “teacher” in Chinese?',
            choices: ['老师', '老師'], correctIndex: 0,
            explanation: '老师 lǎoshī means teacher.', difficulty: 'easy',
          },
        }],
      }],
    }];

    render(<MistakesPage />);

    expect(screen.getAllByText('laoshi')).toHaveLength(2);
    expect(screen.queryByText('No answer — time expired')).not.toBeInTheDocument();
    expect(screen.queryByText('老師')).not.toBeInTheDocument();
    for (const label of screen.getAllByText('Correct answer:')) {
      expect(label.parentElement).not.toHaveTextContent(/Correct answer: A\./);
    }
  });

  it('recognises older typed responses without an answerMode marker', () => {
    mockProgress[0].attempts[0].questionResults![0].answerMode = undefined;
    render(<MistakesPage />);

    expect(screen.getAllByText('laoshi')).toHaveLength(2);
    expect(screen.queryByText('No answer — time expired')).not.toBeInTheDocument();
    expect(screen.queryByText('老師')).not.toBeInTheDocument();
  });
});
