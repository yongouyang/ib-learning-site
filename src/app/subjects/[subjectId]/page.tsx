'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSubject } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import { getRecentAverageScore } from '@/lib/progress-store';
import type { SubjectId } from '@/content/types';

export default function SubjectPage() {
  const params = useParams();
  const subjectId = params.subjectId as SubjectId;
  const subject = getSubject(subjectId);
  const { topicProgress } = useProgress();

  if (!subject) return <p className="p-6">Subject not found.</p>;

  const emoji = subjectId === 'math' ? '📐' : subjectId === 'english' ? '📖' : subjectId === 'biology' ? '🌿' : subjectId === 'chemistry' ? '🧪' : '⚛️';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-blue-600 mb-4 inline-block">← Back</Link>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{emoji}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
          <p className="text-sm text-gray-500">{subject.topics.length} topics</p>
        </div>
      </div>

      <div className="space-y-3">
        {subject.topics.map((topic) => {
          const tp = topicProgress.find(t => t.topicId === topic.id && t.subjectId === subjectId);
          const score = tp ? getRecentAverageScore(tp.attempts) : -1;
          const stars = score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.4 ? 1 : 0;

          return (
            <div key={topic.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{topic.description}</p>
                </div>
                {score >= 0 && (
                  <div className="flex gap-0.5 ml-2">
                    {[0, 1, 2].map(i => (
                      <span key={i} className={`text-xs ${i < stars ? 'text-yellow-500' : 'text-gray-300'}`}>{i < stars ? '★' : '☆'}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <Link href={`/subjects/${subjectId}/${topic.id}/study`}
                  className="flex-1 text-center text-sm py-2 rounded-lg bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors">
                  📝 Study
                </Link>
                <Link href={`/subjects/${subjectId}/${topic.id}/flashcards`}
                  className="flex-1 text-center text-sm py-2 rounded-lg bg-green-50 text-green-700 font-medium hover:bg-green-100 transition-colors">
                  🃏 Flashcards
                </Link>
                <Link href={`/subjects/${subjectId}/${topic.id}/quiz`}
                  className="flex-1 text-center text-sm py-2 rounded-lg bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 transition-colors">
                  ✏️ Quiz
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
