import type { Flashcard, FlashcardProgress, Topic } from '@/content/types';

// Phase 6 — spaced repetition for flashcards (fixed interval ladder,
// SM-2 simplified). Learning cards are always due; known cards come due
// after an interval that grows with the consecutive-known streak.
export const KNOWN_INTERVALS_DAYS = [1, 3, 7, 16, 35] as const;

const DAY_MS = 86_400_000;

export function intervalDaysForStreak(knownStreak: number): number {
  const index = Math.min(Math.max(knownStreak - 1, 0), KNOWN_INTERVALS_DAYS.length - 1);
  return KNOWN_INTERVALS_DAYS[index];
}

export function isCardDue(progress: FlashcardProgress | undefined, now: Date = new Date()): boolean {
  if (!progress) return false; // never-seen cards aren't "due", they're new
  if (progress.status === 'learning') return true;
  const dueAt = new Date(progress.lastReviewed).getTime() + intervalDaysForStreak(progress.knownStreak) * DAY_MS;
  return now.getTime() >= dueAt;
}

export interface CardStats {
  total: number;
  seen: number; // reviewed at least once
  known: number;
  learning: number;
  due: number;
}

export function getCardStats(
  topic: Topic,
  progress: Record<string, FlashcardProgress>,
  now: Date = new Date()
): CardStats {
  let seen = 0;
  let known = 0;
  let due = 0;
  for (const card of topic.flashcards) {
    const p = progress[card.id];
    if (!p) continue;
    seen += 1;
    if (p.status === 'known') known += 1;
    if (isCardDue(p, now)) due += 1;
  }
  return { total: topic.flashcards.length, seen, known, learning: seen - known, due };
}

export type DeckFilter = 'all' | 'learning' | 'due';

export function parseDeckFilter(value: string | null): DeckFilter {
  if (value === 'learning' || value === 'due') return value;
  return 'all';
}

// Build the deck for a filter. 'learning' = explicitly marked learning;
// 'due' = learning ∪ overdue known. Never-seen cards are only in 'all'.
export function filterDeck(
  flashcards: Flashcard[],
  progress: Record<string, FlashcardProgress>,
  filter: DeckFilter,
  now: Date = new Date()
): Flashcard[] {
  if (filter === 'all') return flashcards;
  if (filter === 'learning') return flashcards.filter((c) => progress[c.id]?.status === 'learning');
  return flashcards.filter((c) => isCardDue(progress[c.id], now));
}

export interface DueTopic {
  topicId: string;
  subjectId: Topic['subjectId'];
  topicTitle: string;
  dueCount: number;
}

// Due counts across all topics, descending — feeds the homepage "Flashcards due" card.
export function getDueTopics(
  topics: Topic[],
  progress: Record<string, FlashcardProgress>,
  now: Date = new Date()
): DueTopic[] {
  return topics
    .map((topic) => ({
      topicId: topic.id,
      subjectId: topic.subjectId,
      topicTitle: topic.title,
      dueCount: getCardStats(topic, progress, now).due,
    }))
    .filter((t) => t.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount);
}
