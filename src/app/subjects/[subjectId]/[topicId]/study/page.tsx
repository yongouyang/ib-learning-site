'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import StudyNoteBody from '@/components/StudyNoteBody';

export default function StudyPage() {
  const params = useParams();
  const subjectId = params.subjectId as SubjectId;
  const topicId = params.topicId as string;
  const topic = getTopic(subjectId, topicId);

  if (!topic) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Topic not found.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href={`/subjects/${subjectId}`} className="text-sm text-blue-600 dark:text-blue-400 mb-4 inline-block">← Back to topics</Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-1">{topic.title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{topic.description}</p>

      <div className="space-y-4">
        {topic.notes.map((note) => (
          <div key={note.id} className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">{note.heading}</h2>
            <StudyNoteBody body={note.body} />
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Link href={`/subjects/${subjectId}/${topicId}/flashcards`}
          className="flex-1 text-center py-3 rounded-xl bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold text-sm hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
          🃏 Study Flashcards
        </Link>
        <Link href={`/subjects/${subjectId}/${topicId}/quiz`}
          className="flex-1 text-center py-3 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-semibold text-sm hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors">
          ✏️ Take Quiz
        </Link>
      </div>
    </div>
  );
}
