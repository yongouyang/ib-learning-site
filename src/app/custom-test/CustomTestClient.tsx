'use client';

import { useMemo, useRef, useState } from 'react';
import { ClipboardList, RotateCcw } from 'lucide-react';
import QuizGame from '@/components/QuizGame';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getSubject, getSubjects } from '@/content/registry';
import type { QuestionResult, SubjectId, TopicMeta } from '@/content/types';
import { useProgress } from '@/context/ProgressContext';
import { CUSTOM_TEST_COUNTS, customTestSeconds, type CustomTestCount, type CustomTestMode, type CustomTestPayload, type CustomTestSettings } from '@/lib/custom-test';
import type { MixedReviewQuestion } from '@/lib/mixed-review';
import { randomSeed, type DifficultyFilter } from '@/lib/quiz-utils';
import { trackEvent } from '@/lib/analytics';

type Scope = 'all' | '7' | '8' | '9' | 'igcse' | 'dp';

export default function CustomTestClient() {
  const subjects = getSubjects();
  const [subjectId, setSubjectId] = useState<SubjectId>('math');
  const [scope, setScope] = useState<Scope>('all');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [count, setCount] = useState<CustomTestCount>(10);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [mode, setMode] = useState<CustomTestMode>('practice');
  const [questions, setQuestions] = useState<MixedReviewQuestion[]>([]);
  const [settings, setSettings] = useState<CustomTestSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resultsRef = useRef<QuestionResult[]>([]);
  const startedAtRef = useRef(0);
  const { recordAttempt } = useProgress();

  const topics = useMemo(() => getSubject(subjectId)?.topics.filter((topic) => {
    if (scope === 'all') return true;
    if (scope === 'igcse' || scope === 'dp') return topic.stage === scope;
    return topic.year === Number(scope);
  }) ?? [], [subjectId, scope]);

  const loadTest = async (next: CustomTestSettings) => {
    setLoading(true);
    setError('');
    resultsRef.current = [];
    try {
      const path = `/api/content/public/custom-test/${next.seed}/${next.count}/${next.difficulty}/${next.topicIds.join(',')}`;
      const response = await fetch(path);
      if (response.status === 404) {
        setQuestions([]);
        setError('No questions match this selection. Try more topics or a different difficulty.');
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as CustomTestPayload;
      setQuestions(body.questions);
      setSettings(next);
      startedAtRef.current = Date.now();
      trackEvent('quiz_started', { subjectId, topicId: 'custom-test', source: 'custom_test' });
    } catch {
      setQuestions([]);
      setError('Could not load your test. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const startTest = () => {
    void loadTest({ topicIds: selectedTopics, count, difficulty, mode, seed: `custom:${randomSeed()}` });
  };

  const anotherTest = () => {
    if (settings) void loadTest({ ...settings, seed: `custom:${randomSeed()}` });
  };

  const completeTest = (correctCount: number, totalCount: number) => {
    if (!settings) return;
    const byId = new Map(questions.map((entry) => [entry.question.id, entry]));
    const perTopic = new Map<string, { topic: TopicMeta; results: QuestionResult[] }>();
    for (const result of resultsRef.current) {
      const source = byId.get(result.questionId);
      if (!source) continue;
      const topic = getSubject(source.subjectId)?.topics.find((item) => item.id === source.topicId);
      if (!topic) continue;
      const current = perTopic.get(topic.id) ?? { topic, results: [] };
      current.results.push(result);
      perTopic.set(topic.id, current);
    }
    for (const { topic, results } of perTopic.values()) {
      recordAttempt(topic.id, subjectId, topic.title, getSubject(subjectId)?.name ?? subjectId,
        results.filter((result) => result.correct).length, results.length, results);
    }
    trackEvent('quiz_completed', {
      subjectId,
      topicId: 'custom-test',
      correctCount,
      totalCount,
      durationSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
    });
  };

  if (settings && questions.length > 0) {
    return (
      <QuizGame
        key={settings.seed}
        subtitle={`${getSubject(subjectId)?.name ?? subjectId} · ${settings.topicIds.length} topic${settings.topicIds.length === 1 ? '' : 's'}`}
        backHref="/custom-test"
        backLabel="Back to Test Builder"
        questions={questions.map((entry) => entry.question)}
        enableTimer={settings.mode === 'timed'}
        timerMode="overall"
        timerSeconds={customTestSeconds(settings.count)}
        onQuestionResult={(_id, _correct, _number, _total, result) => { resultsRef.current.push(result); }}
        onComplete={completeTest}
        onNewSet={anotherTest}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Build a Test' }]} currentAsHeading />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Choose exactly what you need to practise. Every question comes from our reviewed question bank.
      </p>

      <div className="card p-5 space-y-5">
        <div>
          <label htmlFor="test-subject" className="block text-sm font-semibold mb-2">Subject</label>
          <select id="test-subject" value={subjectId} onChange={(event) => {
            setSubjectId(event.target.value as SubjectId);
            setSelectedTopics([]);
          }} className="w-full min-h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="test-scope" className="block text-sm font-semibold mb-2">Year group or course</label>
          <select id="test-scope" value={scope} onChange={(event) => {
            setScope(event.target.value as Scope);
            setSelectedTopics([]);
          }} className="w-full min-h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value="all">All levels</option>
            <option value="7">Year 7</option>
            <option value="8">Year 8</option>
            <option value="9">Year 9</option>
            <option value="igcse">IGCSE</option>
            <option value="dp">IB DP</option>
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold mb-2">Topics</legend>
          {topics.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No topics are available for this selection.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {topics.map((topic) => (
                <label key={topic.id} className="flex items-center gap-3 min-h-11 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedTopics.includes(topic.id)}
                    disabled={selectedTopics.length >= 12 && !selectedTopics.includes(topic.id)}
                    onChange={() => setSelectedTopics((current) => current.includes(topic.id)
                      ? current.filter((id) => id !== topic.id)
                      : [...current, topic.id])}
                    className="w-5 h-5 accent-blue-600"
                  />
                  <span>{topic.title}</span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{topic.questionCount} questions</span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{selectedTopics.length} selected · up to 12 topics</p>
        </fieldset>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="test-count" className="block text-sm font-semibold mb-2">Questions</label>
            <select id="test-count" value={count} onChange={(event) => setCount(Number(event.target.value) as CustomTestCount)} className="w-full min-h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {CUSTOM_TEST_COUNTS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="test-difficulty" className="block text-sm font-semibold mb-2">Difficulty</label>
            <select id="test-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)} className="w-full min-h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <option value="all">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label htmlFor="test-mode" className="block text-sm font-semibold mb-2">Mode</label>
            <select id="test-mode" value={mode} onChange={(event) => setMode(event.target.value as CustomTestMode)} className="w-full min-h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <option value="practice">Untimed practice</option>
              <option value="timed">Timed test · {customTestSeconds(count) / 60} minutes</option>
            </select>
          </div>
        </div>
        {selectedTopics.length >= 12 && (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Topic limit reached. Remove a topic to choose another.</p>
        )}

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="button" disabled={selectedTopics.length === 0 || loading} onClick={startTest}
          className="w-full min-h-11 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <RotateCcw className="w-5 h-5 motion-safe:animate-spin" /> : <ClipboardList className="w-5 h-5" />}
          {loading ? 'Building your test…' : 'Start my test'}
        </button>
      </div>
    </div>
  );
}
