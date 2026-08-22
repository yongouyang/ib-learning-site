import type { SubjectId } from '@/content/types';

// Single source for the per-subject emoji shown on the homepage, progress page
// and subject pages (previously three duplicated ternary chains).
export const SUBJECT_EMOJI: Record<SubjectId, string> = {
  math: '📐',
  english: '📖',
  biology: '🌿',
  chemistry: '🧪',
  physics: '⚛️',
  geography: '🌍',
  history: '🏛️',
  ict: '💻',
  chinese: '🀄',
  german: '🥨',
};

export function subjectEmoji(id: string): string {
  return SUBJECT_EMOJI[id as SubjectId] ?? '📚';
}
