'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, RotateCcw, BookOpen, Check, X } from 'lucide-react';
import { getSubject, getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import { useProgress } from '@/context/ProgressContext';
import { filterDeck, getCardStats, parseDeckFilter, type DeckFilter } from '@/lib/flashcard-scheduler';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import InlineMath from '@/components/InlineMath';
import DualRingDonut from '@/components/DualRingDonut';

interface FlashcardsPageClientProps {
  subjectId: string;
  topicId: string;
}

const FILTER_LABELS: Record<DeckFilter, string> = {
  all: 'All cards',
  learning: 'Still learning',
  due: 'Due for review',
};

export default function FlashcardsPageClient({ subjectId, topicId }: FlashcardsPageClientProps) {
  const searchParams = useSearchParams();
  const filter = parseDeckFilter(searchParams.get('filter'));
  const topic = getTopic(subjectId as SubjectId, topicId);
  const subject = getSubject(subjectId as SubjectId);
  const { flashcardProgress, recordFlashcard, loaded } = useProgress();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionLearning, setSessionLearning] = useState(0);

  // Deck is computed per filter; when the filter changes (e.g. the
  // "Review still learning" link), reset the session and rebuild.
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsComplete(false);
    setSessionKnown(0);
    setSessionLearning(0);
  }, [filter]);

  // Filtered decks need the stored progress, which only exists after the
  // first client-side load — wait for `loaded` before building them.
  const deck = useMemo(
    () => (topic && (filter === 'all' || loaded) ? filterDeck(topic.flashcards, flashcardProgress, filter) : []),
    // Deck membership is fixed for the session even as cards are marked
    // (marking a card known must not pull it out from under the user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, filter, loaded, isComplete]
  );

  const stats = useMemo(
    () => (topic ? getCardStats(topic, flashcardProgress) : null),
    [topic, flashcardProgress]
  );

  if (!topic || topic.flashcards.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">No flashcards available.</div>;
  }

  if (filter !== 'all' && !loaded) {
    return <div className="max-w-md mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading deck…</div>;
  }

  if (deck.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Nothing here</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {filter === 'learning'
            ? 'No cards marked as still learning — nice work.'
            : 'No cards are due for review right now.'}
        </p>
        <Link href={`/subjects/${subjectId}/${topicId}/flashcards`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
          Review the full deck
        </Link>
      </div>
    );
  }

  const handleMark = (status: 'known' | 'learning') => {
    const card = deck[currentIndex];
    recordFlashcard(card.id, status);
    if (status === 'known') setSessionKnown((n) => n + 1);
    else setSessionLearning((n) => n + 1);
    setIsFlipped(false);
    if (currentIndex < deck.length - 1) setCurrentIndex((i) => i + 1);
    else setIsComplete(true);
  };

  if (isComplete) {
    const reviewed = sessionKnown + sessionLearning;
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Deck Complete!</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {FILTER_LABELS[filter]} · {reviewed > 0 ? reviewed : deck.length} cards reviewed
          {reviewed > 0 && (
            <> — <span className="text-green-600 dark:text-green-400 font-medium">{sessionKnown} known</span>, <span className="text-amber-600 dark:text-amber-400 font-medium">{sessionLearning} still learning</span></>
          )}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {sessionLearning > 0 && filter !== 'learning' && (
            <Link href={`/subjects/${subjectId}/${topicId}/flashcards?filter=learning`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors">
              Review still learning
            </Link>
          )}
          <button onClick={() => { setCurrentIndex(0); setIsFlipped(false); setIsComplete(false); setSessionKnown(0); setSessionLearning(0); }}
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

  const card = deck[currentIndex];
  const progress = ((currentIndex + 1) / deck.length) * 100;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <Breadcrumbs items={[
        { href: '/', label: 'Home' },
        { href: `/subjects/${subjectId}`, label: subject?.name ?? subjectId },
        { href: `/subjects/${subjectId}/${topicId}/study`, label: topic.title },
        { label: 'Flashcards' },
      ]} />
      <div className="flex items-center gap-3 mb-6">
        {stats && <DualRingDonut seen={stats.seen} known={stats.known} total={stats.total} size={48} />}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{deck.length}</span>
          </div>
          {filter !== 'all' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{FILTER_LABELS[filter]} · <Link href={`/subjects/${subjectId}/${topicId}/flashcards`} className="text-blue-600 dark:text-blue-400">full deck</Link></p>
          )}
        </div>
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

      {/* Self-sorting (after flip) / navigation (before flip) */}
      {isFlipped ? (
        <div className="flex gap-3 mt-4">
          <button onClick={() => handleMark('learning')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors">
            <X className="w-4 h-4" /> Still learning
          </button>
          <button onClick={() => handleMark('known')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors">
            <Check className="w-4 h-4" /> I know this
          </button>
        </div>
      ) : (
        <div className="flex gap-3 mt-4">
          <button onClick={() => { setIsFlipped(false); setCurrentIndex((i) => Math.max(0, i - 1)); }}
            disabled={currentIndex === 0}
            className="flex-1 inline-flex items-center justify-center gap-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <button onClick={() => setIsFlipped(true)}
            className="flex-1 inline-flex items-center justify-center gap-1 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
            Flip card <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
