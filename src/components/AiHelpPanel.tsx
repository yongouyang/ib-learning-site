'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { Question, SubjectId } from '@/content/types';
import { trackEvent } from '@/lib/analytics';
import InlineMath from './InlineMath';

interface Context {
  subjectId: SubjectId;
  topicId: string;
}

type Action = 'simpler' | 'hint' | 'worked-example' | 'why-wrong';

const ACTIONS: { id: Action; label: string }[] = [
  { id: 'simpler', label: 'Explain differently' },
  { id: 'hint', label: 'Give me a hint' },
  { id: 'worked-example', label: 'Show a worked example' },
  { id: 'why-wrong', label: 'Why was my answer wrong?' },
];

export default function AiHelpPanel({ question, selectedIndex, context }: {
  question: Question;
  selectedIndex: number | null;
  context: Context;
}) {
  const pathname = usePathname();
  const [loading, setLoading] = useState<Action | null>(null);
  const [help, setHelp] = useState('');
  const [error, setError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const outcomeVisible = loginRequired || Boolean(error) || Boolean(help);

  useEffect(() => {
    if (!outcomeVisible || !outcomeRef.current) return;
    outcomeRef.current.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    outcomeRef.current.focus({ preventScroll: true });
  }, [outcomeVisible]);

  const requestHelp = async (action: Action) => {
    setLoading(action);
    setHelp('');
    setError('');
    setLoginRequired(false);
    try {
      const response = await fetch('/api/ai-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...context, selectedIndex, question }),
      });
      if (response.status === 401) {
        setLoginRequired(true);
        return;
      }
      if (response.status === 429) {
        setError('You have used your monthly AI help allowance. It resets next month.');
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as { help: string };
      setHelp(body.help);
      trackEvent('ai_help_requested', { action });
    } catch {
      setError('AI help is unavailable right now. The reviewed explanation above is still available.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> Need another explanation?
      </h3>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((action) => action.id !== 'why-wrong' || selectedIndex !== question.correctIndex).map((action) => (
          <button key={action.id} type="button" onClick={() => void requestHelp(action.id)} disabled={loading !== null}
            className="min-h-11 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50">
            {loading === action.id ? 'Thinking…' : action.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">AI-generated help can make mistakes. Check the reviewed explanation too.</p>
      <div ref={outcomeRef} tabIndex={-1} aria-live="polite" className="rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950">
        {loginRequired && (
          <Link href={`/login?next=${encodeURIComponent(pathname ?? '/custom-test')}`} className="mt-3 inline-flex min-h-11 items-center px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Sign in to use AI help
          </Link>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {help && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">AI help</p>
            <p className="text-sm text-gray-700 dark:text-gray-300"><InlineMath text={help} /></p>
          </div>
        )}
      </div>
    </div>
  );
}
