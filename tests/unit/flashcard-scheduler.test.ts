import { describe, it, expect } from 'vitest';
import {
  KNOWN_INTERVALS_DAYS,
  intervalDaysForStreak,
  isCardDue,
  getCardStats,
  filterDeck,
  parseDeckFilter,
  getDueTopics,
} from '@/lib/flashcard-scheduler';
import type { Flashcard, FlashcardProgress, Topic } from '@/content/types';

const NOW = new Date('2026-07-25T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function card(id: string): Flashcard {
  return { id, term: `Term ${id}`, definition: `Definition ${id}` };
}

function makeTopic(flashcards: Flashcard[]): Topic {
  return {
    id: 'topic-1',
    subjectId: 'math',
    title: 'Test Topic',
    description: 'A topic.',
    stage: 'ks3',
    notes: [],
    flashcards,
    questions: [],
  };
}

describe('intervalDaysForStreak', () => {
  it('follows the ladder and caps at the top rung', () => {
    expect(intervalDaysForStreak(1)).toBe(KNOWN_INTERVALS_DAYS[0]);
    expect(intervalDaysForStreak(2)).toBe(3);
    expect(intervalDaysForStreak(5)).toBe(35);
    expect(intervalDaysForStreak(99)).toBe(35);
    expect(intervalDaysForStreak(0)).toBe(KNOWN_INTERVALS_DAYS[0]); // defensive
  });
});

describe('isCardDue', () => {
  it('never-seen cards are not due', () => {
    expect(isCardDue(undefined, NOW)).toBe(false);
  });

  it('learning cards are always due', () => {
    const p: FlashcardProgress = { status: 'learning', lastReviewed: NOW.toISOString(), knownStreak: 0 };
    expect(isCardDue(p, NOW)).toBe(true);
  });

  it('known cards come due after their interval', () => {
    const streak2: FlashcardProgress = { status: 'known', lastReviewed: daysAgo(2), knownStreak: 2 }; // interval 3d
    expect(isCardDue(streak2, NOW)).toBe(false);
    const overdue: FlashcardProgress = { status: 'known', lastReviewed: daysAgo(4), knownStreak: 2 };
    expect(isCardDue(overdue, NOW)).toBe(true);
  });
});

describe('getCardStats / filterDeck / getDueTopics', () => {
  const cards = ['c1', 'c2', 'c3', 'c4', 'c5'].map(card);
  const progress: Record<string, FlashcardProgress> = {
    c1: { status: 'known', lastReviewed: daysAgo(0), knownStreak: 1 }, // not due
    c2: { status: 'known', lastReviewed: daysAgo(10), knownStreak: 1 }, // due (interval 1d)
    c3: { status: 'learning', lastReviewed: daysAgo(0), knownStreak: 0 }, // due
    // c4, c5: never seen
  };

  it('computes seen/known/learning/due counts', () => {
    const stats = getCardStats(makeTopic(cards), progress, NOW);
    expect(stats).toEqual({ total: 5, seen: 3, known: 2, learning: 1, due: 2 });
  });

  it('filters decks correctly', () => {
    expect(filterDeck(cards, progress, 'all', NOW)).toHaveLength(5);
    expect(filterDeck(cards, progress, 'learning', NOW).map((c) => c.id)).toEqual(['c3']);
    expect(filterDeck(cards, progress, 'due', NOW).map((c) => c.id)).toEqual(['c2', 'c3']);
  });

  it('parses deck filters with fallback to all', () => {
    expect(parseDeckFilter('due')).toBe('due');
    expect(parseDeckFilter('learning')).toBe('learning');
    expect(parseDeckFilter('bogus')).toBe('all');
    expect(parseDeckFilter(null)).toBe('all');
  });

  it('lists due topics descending, excluding zero-due topics', () => {
    const topicA = { ...makeTopic(cards), id: 'topic-a', title: 'A' };
    const topicB = { ...makeTopic(cards.slice(0, 1)), id: 'topic-b', title: 'B' }; // c1 known, not due
    const due = getDueTopics([topicA, topicB], progress, NOW);
    expect(due).toHaveLength(1);
    expect(due[0].topicId).toBe('topic-a');
    expect(due[0].dueCount).toBe(2);
  });
});
