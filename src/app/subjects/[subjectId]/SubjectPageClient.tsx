'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Layers, Pencil, SearchX } from 'lucide-react';
import { getSubject } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import { getRecentAverageScore } from '@/lib/progress-store';
import { filterTopics, TopicFilterState } from '@/lib/topic-filter';
import { groupTopicsByStage } from '@/lib/topic-groups';
import { subjectEmoji } from '@/lib/subject-emoji';
import { TopicFilter } from '@/components/TopicFilter';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import InlineMath from '@/components/InlineMath';
import type { SubjectId } from '@/content/types';

interface SubjectPageClientProps {
  subjectId: string;
}

export default function SubjectPageClient({ subjectId }: SubjectPageClientProps) {
  const subject = getSubject(subjectId as SubjectId);
  const { topicProgress } = useProgress();
  const [filter, setFilter] = useState<TopicFilterState>({ query: '', stage: 'all' });

  if (!subject) return <p className="p-6">Subject not found.</p>;

  const emoji = subjectEmoji(subjectId);
  const filteredTopics = filterTopics(subject.topics, filter);
  const groups = groupTopicsByStage(filteredTopics);
  let cardIndex = 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: subject.name }]} />

      <div
        className="rounded-2xl p-5 mb-6 text-white shadow-sm"
        style={{ backgroundColor: subject.accentColor }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{emoji}</span>
          <div>
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <p className="text-sm text-white/90">{subject.topics.length} topics · {filteredTopics.length} shown</p>
          </div>
        </div>
      </div>

      <TopicFilter value={filter} onChange={setFilter} resultCount={filteredTopics.length} />

      <div className="space-y-6">
        {filteredTopics.length === 0 && (
          <div className="card p-8 text-center">
            <SearchX className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">
              No topics match your search.
            </p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {group.label}
              <span className="ml-1.5 font-normal normal-case">({group.topics.length})</span>
            </h2>
            <div className="space-y-3">
              {group.topics.map((topic) => {
                const idx = cardIndex++;
                const tp = topicProgress.find(t => t.topicId === topic.id && t.subjectId === subjectId);
                const score = tp ? getRecentAverageScore(tp.attempts) : -1;
                const stars = score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.4 ? 1 : 0;

          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              className="card p-4 border-l-4"
              style={{ borderLeftColor: subject.accentColor }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">{topic.title}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${topic.stage === 'dp' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : topic.stage === 'igcse' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'}`}>
                      {topic.stage === 'dp' ? `DP${topic.level ? ` ${topic.level.toUpperCase()}` : ''}` : topic.stage === 'igcse' ? 'IGCSE' : 'KS3'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400"><InlineMath text={topic.description} /></p>
                </div>
                {score >= 0 && (
                  <div className="flex gap-0.5 ml-2">
                    {[0, 1, 2].map(i => (
                      <span key={i} className={`text-xs ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>{i < stars ? '★' : '☆'}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mastery bar (quiz history) — Phase 6 */}
              {score >= 0 && (
                <div className="flex items-center gap-2 mb-1" aria-label={`Mastery ${Math.round(score * 100)}%`}>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(score * 100)}%`, backgroundColor: subject.accentColor }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{Math.round(score * 100)}%</span>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Link href={`/subjects/${subjectId}/${topic.id}/study`}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-sm py-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" /> Study
                </Link>
                <Link href={`/subjects/${subjectId}/${topic.id}/flashcards`}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-sm py-2 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
                  <Layers className="w-3.5 h-3.5" /> Flashcards
                </Link>
                <Link href={`/subjects/${subjectId}/${topic.id}/quiz`}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-sm py-2 rounded-lg bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Quiz
                </Link>
              </div>
            </motion.div>
              );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
