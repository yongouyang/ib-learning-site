import type { Question } from '@/content/types';
import InlineMath from './InlineMath';

// Static stand-in for a gated quiz/exam behind LockedFeature: a couple of
// sample questions as plain text, so the preview shows the SHAPE of the
// content without mounting the live runner (a ticking countdown behind the
// lock reads as "the exam started without you"). LockedFeature greys and
// inerts this itself — no interactive elements here.
export function LockedQuizPreview({ questions, count = 2 }: { questions: Question[]; count?: number }) {
  return (
    <div className="space-y-2">
      {questions.slice(0, count).map((q) => (
        <div key={q.id} className="card p-4">
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
            <InlineMath text={q.stem} />
          </p>
          <div className="space-y-1.5">
            {q.choices.map((choice, i) => (
              <p key={i} className="text-sm text-gray-500 dark:text-gray-400">
                <span className="mr-2 font-medium">{String.fromCharCode(65 + i)}.</span>
                <InlineMath text={choice} />
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
