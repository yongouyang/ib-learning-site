'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Target } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import InlineMath from '@/components/InlineMath';
import { useProgress } from '@/context/ProgressContext';
import { deriveMistakes, deriveTopicImprovement, type MistakeEntry } from '@/lib/mistake-notebook';
import { subjectEmoji } from '@/lib/subject-emoji';

function MistakeCard({ mistake }: { mistake: MistakeEntry }) {
  const question = mistake.latestResult.question;
  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      {question ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-50"><InlineMath text={question.stem} /></h3>
          <p className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">Your answer: </span>
            {mistake.latestResult.selectedIndex !== undefined && mistake.latestResult.selectedIndex >= 0
              ? <><span>{String.fromCharCode(65 + mistake.latestResult.selectedIndex)}. </span><InlineMath text={question.choices[mistake.latestResult.selectedIndex]} /></>
              : 'No answer — time expired'}
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">
            <span className="font-semibold">Correct answer: </span>
            <span>{String.fromCharCode(65 + question.correctIndex)}. </span>
            <InlineMath text={question.choices[question.correctIndex]} />
          </p>
          <p className="text-sm pt-3 border-t border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300"><InlineMath text={question.explanation} /></p>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This earlier attempt recorded the incorrect question, but not its full text or your selected answer.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={`/subjects/${mistake.subjectId}/${mistake.topicId}/quiz`}
          className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Practise this topic <ArrowRight className="w-4 h-4" />
        </Link>
        {mistake.consecutiveCorrect > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">One related correction — one more resolves this mistake</span>
        )}
      </div>
    </article>
  );
}

export default function MistakesPage() {
  const { topicProgress, loaded } = useProgress();
  const mistakes = deriveMistakes(topicProgress);
  const byTopic = new Map<string, MistakeEntry[]>();
  for (const mistake of mistakes) {
    const key = `${mistake.subjectId}:${mistake.topicId}`;
    byTopic.set(key, [...(byTopic.get(key) ?? []), mistake]);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/progress', label: 'My Progress' }, { label: 'Mistake Notebook' }]} currentAsHeading />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Mistakes stay here until you answer two related questions correctly in a row.
      </p>

      {loaded && topicProgress.some((topic) => topic.attempts.length > 0) && (
        <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">Turn weak areas into your next test</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">A fresh mix from the topics where your recent scores are below 70%.</p>
          </div>
          <Link href="/custom-test?mode=weak" className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-3 rounded-xl bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800 shrink-0">
            <Target className="w-4 h-4" /> Practise my weak areas
          </Link>
        </div>
      )}

      {!loaded ? (
        <p role="status" className="card p-6 text-center text-gray-500 dark:text-gray-400">Loading your mistakes…</p>
      ) : mistakes.length === 0 ? (
        <div className="card p-6 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-600 dark:text-green-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">No unresolved mistakes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Complete a quiz and anything you get wrong will appear here.</p>
          <Link href="/custom-test" className="inline-flex items-center gap-2 min-h-11 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold">
            <BookOpen className="w-4 h-4" /> Build a practice test
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {[...byTopic.values()].map((entries) => {
            const first = entries[0];
            const topic = topicProgress.find((item) => item.topicId === first.topicId && item.subjectId === first.subjectId);
            const improvement = topic ? deriveTopicImprovement(topic) : null;
            return (
              <section key={`${first.subjectId}:${first.topicId}`} aria-labelledby={`${first.topicId}-heading`} className="card p-4">
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1"><span aria-hidden="true">{subjectEmoji(first.subjectId)} </span>{first.subjectTitle}</p>
                  <h2 id={`${first.topicId}-heading`} className="text-lg font-bold text-gray-900 dark:text-gray-50">{first.topicTitle}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{entries.length} unresolved mistake{entries.length === 1 ? '' : 's'}</p>
                  {improvement && (
                    <p className={`mt-2 text-sm font-medium ${improvement.change > 0 ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      First attempt {improvement.firstScore}% → latest {improvement.latestScore}%
                      {improvement.change !== 0 && ` (${improvement.change > 0 ? '+' : ''}${improvement.change} points)`}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {entries.map((mistake) => <MistakeCard key={mistake.key} mistake={mistake} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
