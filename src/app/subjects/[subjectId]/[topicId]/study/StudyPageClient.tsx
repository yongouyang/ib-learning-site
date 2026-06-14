'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Layers, Pencil } from 'lucide-react';
import { getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import StudyNoteBody from '@/components/StudyNoteBody';

interface StudyPageClientProps {
  subjectId: string;
  topicId: string;
}

export default function StudyPageClient({ subjectId, topicId }: StudyPageClientProps) {
  const topic = getTopic(subjectId as SubjectId, topicId);

  if (!topic) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Topic not found.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href={`/subjects/${subjectId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to topics
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-1">{topic.title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{topic.description}</p>

      <div className="space-y-4">
        {topic.notes.map((note, idx) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.05 }}
            className="card p-5"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">{note.heading}</h2>
            <StudyNoteBody body={note.body} />
          </motion.div>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Link href={`/subjects/${subjectId}/${topicId}/flashcards`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold text-sm hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
          <Layers className="w-4 h-4" /> Study Flashcards
        </Link>
        <Link href={`/subjects/${subjectId}/${topicId}/quiz`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-semibold text-sm hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors">
          <Pencil className="w-4 h-4" /> Take Quiz
        </Link>
      </div>
    </div>
  );
}
