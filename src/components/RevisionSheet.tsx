import InlineMath from './InlineMath';
import type { MistakeEntry } from '@/lib/mistake-notebook';

export default function RevisionSheet({ mistakes }: { mistakes: MistakeEntry[] }) {
  const byTopic = new Map<string, MistakeEntry[]>();
  for (const mistake of mistakes) {
    const key = `${mistake.subjectId}:${mistake.topicId}`;
    byTopic.set(key, [...(byTopic.get(key) ?? []), mistake]);
  }

  return (
    <section className="revision-sheet hidden print:block" aria-label="Printable revision sheet">
      <header className="border-b-2 border-gray-900 pb-4 mb-6">
        <p className="text-sm font-semibold mb-1">Octav Learning</p>
        <h1 className="text-3xl font-bold mb-2">My revision sheet</h1>
        <p className="text-sm">{mistakes.length} unresolved mistake{mistakes.length === 1 ? '' : 's'} across {byTopic.size} topic{byTopic.size === 1 ? '' : 's'}</p>
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 text-sm">
          <p>Name: <span className="inline-block w-40 max-w-full border-b border-gray-500">&nbsp;</span></p>
          <p>Date: <span className="inline-block w-32 max-w-full border-b border-gray-500">&nbsp;</span></p>
        </div>
      </header>

      <div className="space-y-6">
        {[...byTopic.values()].map((entries) => {
          const first = entries[0];
          return (
            <section key={`${first.subjectId}:${first.topicId}`}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1">{first.subjectTitle}</p>
              <h2 className="text-xl font-bold mb-3">{first.topicTitle}</h2>
              <div className="space-y-4">
                {entries.map((mistake, index) => {
                  const question = mistake.latestResult.question;
                  return (
                    <article key={mistake.key} className="revision-item border border-gray-300 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Question {index + 1}</h3>
                      {question ? (
                        <div className="space-y-3 text-sm">
                          <p className="font-medium"><InlineMath text={question.stem} /></p>
                          <ol className="grid grid-cols-2 gap-x-6 gap-y-2 list-none pl-0">
                            {question.choices.map((choice, choiceIndex) => (
                              <li key={choiceIndex}>{String.fromCharCode(65 + choiceIndex)}. <InlineMath text={choice} /></li>
                            ))}
                          </ol>
                          <p><span className="font-semibold">My answer: </span>{mistake.latestResult.selectedIndex !== undefined && mistake.latestResult.selectedIndex >= 0
                            ? <>{String.fromCharCode(65 + mistake.latestResult.selectedIndex)}. <InlineMath text={question.choices[mistake.latestResult.selectedIndex]} /></>
                            : 'No answer — time expired'}</p>
                          <p><span className="font-semibold">Correct answer: </span>{String.fromCharCode(65 + question.correctIndex)}. <InlineMath text={question.choices[question.correctIndex]} /></p>
                          <p className="border-t border-gray-300 pt-3"><span className="font-semibold">Remember: </span><InlineMath text={question.explanation} /></p>
                        </div>
                      ) : (
                        <p className="text-sm">This earlier attempt has no saved question text. Practise this topic again to review the skill.</p>
                      )}
                      <p className="mt-4 text-xs">Try this again: octavlearning.com/subjects/{mistake.subjectId}/{mistake.topicId}/quiz</p>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
