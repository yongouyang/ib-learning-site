'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';

export default function FlashcardsPage() {
  const params = useParams();
  const subjectId = params.subjectId as SubjectId;
  const topicId = params.topicId as string;
  const topic = getTopic(subjectId, topicId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  if (!topic || topic.flashcards.length === 0) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">No flashcards available.</div>;

  if (isComplete) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Deck Complete!</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You reviewed all {topic.flashcards.length} flashcards.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setCurrentIndex(0); setIsFlipped(false); setIsComplete(false); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            Review Again
          </button>
          <Link href={`/subjects/${subjectId}/${topicId}/quiz`}
            className="px-4 py-2 rounded-lg bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium text-sm hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors">
            Take Quiz
          </Link>
        </div>
      </div>
    );
  }

  const card = topic.flashcards[currentIndex];
  const progress = ((currentIndex + 1) / topic.flashcards.length) * 100;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/subjects/${subjectId}`} className="text-sm text-blue-600 dark:text-blue-400 shrink-0">← Back</Link>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{topic.flashcards.length}</span>
      </div>

      {/* Flashcard */}
      <div onClick={() => setIsFlipped(!isFlipped)}
        className="card p-6 min-h-[200px] flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all duration-300 hover:shadow-md active:scale-[0.98]">
        {!isFlipped ? (
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">{card.term}</h2>
        ) : (
          <div>
            <p className="text-gray-700 dark:text-gray-300 mb-3">{card.definition}</p>
            {card.example && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Example: {card.example}</p>
            )}
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Tap to flip</p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-4">
        <button onClick={() => { setIsFlipped(false); setCurrentIndex((i) => Math.max(0, i - 1)); }}
          disabled={currentIndex === 0}
          className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          ← Previous
        </button>
        <button onClick={() => {
          setIsFlipped(false);
          if (currentIndex < topic.flashcards.length - 1) setCurrentIndex((i) => i + 1);
          else setIsComplete(true);
        }}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
          {currentIndex < topic.flashcards.length - 1 ? 'Next →' : 'Finish'}
        </button>
      </div>
    </div>
  );
}
