'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, RotateCcw, BookOpen } from 'lucide-react';
import { getSubject, getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import InlineMath from '@/components/InlineMath';

interface FlashcardsPageClientProps {
  subjectId: string;
  topicId: string;
}

export default function FlashcardsPageClient({ subjectId, topicId }: FlashcardsPageClientProps) {
  const topic = getTopic(subjectId as SubjectId, topicId);
  const subject = getSubject(subjectId as SubjectId);

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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            <RotateCcw className="w-4 h-4" /> Review Again
          </button>
          <Link href={`/subjects/${subjectId}/${topicId}/quiz`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium text-sm hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors">
            <BookOpen className="w-4 h-4" /> Take Quiz
          </Link>
        </div>
      </div>
    );
  }

  const card = topic.flashcards[currentIndex];
  const progress = ((currentIndex + 1) / topic.flashcards.length) * 100;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <Breadcrumbs items={[
        { href: '/', label: 'Home' },
        { href: `/subjects/${subjectId}`, label: subject?.name ?? subjectId },
        { href: `/subjects/${subjectId}/${topicId}/study`, label: topic.title },
        { label: 'Flashcards' },
      ]} />
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{topic.flashcards.length}</span>
      </div>

      {/* Flashcard */}
      <div className="relative h-[240px]" style={{ perspective: 1000 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${isFlipped ? 'back' : 'front'}`}
            onClick={() => setIsFlipped(!isFlipped)}
            initial={{ opacity: 0, rotateY: isFlipped ? 90 : -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: isFlipped ? -90 : 90 }}
            transition={{ duration: 0.25 }}
            className="card p-6 absolute inset-0 flex flex-col items-center justify-center text-center cursor-pointer select-none hover:shadow-md"
          >
            {!isFlipped ? (
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50"><InlineMath text={card.term} /></h2>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-3"><InlineMath text={card.definition} /></p>
                {card.example && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Example: <InlineMath text={card.example} /></p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Tap to flip</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-4">
        <button onClick={() => { setIsFlipped(false); setCurrentIndex((i) => Math.max(0, i - 1)); }}
          disabled={currentIndex === 0}
          className="flex-1 inline-flex items-center justify-center gap-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
        <button onClick={() => {
          setIsFlipped(false);
          if (currentIndex < topic.flashcards.length - 1) setCurrentIndex((i) => i + 1);
          else setIsComplete(true);
        }}
          className="flex-1 inline-flex items-center justify-center gap-1 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
          {currentIndex < topic.flashcards.length - 1 ? (
            <><span>Next</span> <ArrowRight className="w-4 h-4" /></>
          ) : 'Finish'}
        </button>
      </div>
    </div>
  );
}
