'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Phase A A5 — in-app analytics dashboard (docs/phase-a-analytics-plan.md).
// Direct URL only (not in Nav): /admin/analytics. Client page, no chart lib —
// every visual is a Tailwind div. Fetches the session-gated, admin-allowlisted
// /api/analytics/summary endpoint (401 = not signed in, 403 = not an admin).

interface AnalyticsSummary {
  days: number;
  /** Per event name → per date (YYYY-MM-DD) → count. Sparse. */
  dailySeries: Record<string, Record<string, number>>;
  topPages: Array<{ path: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  totals: Record<string, number>;
  hosts: Record<string, number>;
}

const DAYS = [7, 30, 90] as const;

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page views',
  quiz_started: 'Quizzes started',
  quiz_completed: 'Quizzes completed',
  flashcard_session_started: 'Flashcard sessions started',
  flashcard_session_completed: 'Flashcard sessions completed',
  diagnostic_started: 'Diagnostics started',
  diagnostic_completed: 'Diagnostics completed',
  exam_started: 'Exams started',
  exam_completed: 'Exams completed',
  paper_marked_with_ai: 'Papers marked with AI',
  cta_clicked: 'CTA clicks',
  search_performed: 'Searches',
  auth_otp_requested: 'Sign-in codes requested',
  auth_login_completed: 'Sign-ins',
  auth_logout: 'Sign-outs',
  pwa_installed: 'PWA installs',
  pwa_offline_banner_shown: 'Offline banners shown',
};

type Status = 'loading' | 'ok' | 'forbidden' | 'unauthenticated' | 'error';

const cardTitle = 'text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2';
const statLabel = 'text-xs text-gray-500 dark:text-gray-400';
const statValue = 'text-2xl font-black text-gray-900 dark:text-gray-50';

export default function AdminAnalyticsPage() {
  const { user, loaded } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async (d: number) => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/analytics/summary?days=${d}`, { credentials: 'same-origin' });
      if (res.status === 401) {
        setStatus('unauthenticated');
        return;
      }
      if (res.status === 403) {
        setStatus('forbidden');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setData((await res.json()) as AnalyticsSummary);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (loaded && user) void load(days);
  }, [loaded, user, days, load]);

  if (!loaded) return null; // no flash while the session round-trips

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Analytics' }]} currentAsHeading />
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Sign in to view analytics.</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const pageViews = data?.dailySeries.page_view ?? {};
  const dates = Object.keys(pageViews).sort();
  const maxCount = Math.max(1, ...dates.map((d) => pageViews[d]));
  const signUps = data?.totals.auth_login_completed ?? 0;
  const events = Object.entries(data?.totals ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Analytics' }]} currentAsHeading />
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {status === 'forbidden' && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don&rsquo;t have access to analytics.
          </p>
        </div>
      )}
      {status === 'unauthenticated' && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your session has expired — sign in again to view analytics.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Couldn&rsquo;t load analytics.</p>
          <button
            type="button"
            onClick={() => void load(days)}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {status === 'loading' && !data && (
        <div className="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      )}
      {(status === 'ok' || (status === 'loading' && data)) && data && (
        <div className="space-y-4">
          {status === 'loading' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Refreshing…</p>
          )}

          <section className="card p-4" aria-label="Daily traffic">
            <h2 className={cardTitle}>Traffic by day</h2>
            {dates.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No page views in this window.</p>
            ) : (
              <>
                <div className="flex items-end gap-1 h-32">
                  {dates.map((d) => (
                    <div
                      key={d}
                      className="flex-1 rounded-t bg-blue-500 dark:bg-blue-400"
                      style={{ height: `${Math.max(4, Math.round((pageViews[d] / maxCount) * 100))}%` }}
                      title={`${d}: ${pageViews[d]}`}
                    />
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  {dates.map((d) => (
                    <span key={d} className="flex-1 text-center text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {d.slice(5)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="card p-4 text-center">
              <div className={statValue}>{signUps}</div>
              <div className={statLabel}>Sign-ins ({days} days)</div>
            </section>
            <section className="card p-4 text-center">
              <div className={statValue}>{data.totals.page_view ?? 0}</div>
              <div className={statLabel}>Page views ({days} days)</div>
            </section>
          </div>

          <section className="card p-4" aria-label="Events">
            <h2 className={cardTitle}>Events</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No events in this window.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="py-1.5 font-semibold">Event</th>
                    <th className="py-1.5 font-semibold text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(([name, count]) => (
                    <tr key={name} className="border-b border-gray-50 dark:border-gray-900">
                      <td className="py-1.5 text-gray-700 dark:text-gray-300">{EVENT_LABELS[name] ?? name}</td>
                      <td className="py-1.5 text-right text-gray-900 dark:text-gray-50 font-medium">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="card p-4" aria-label="Top pages">
              <h2 className={cardTitle}>Top pages</h2>
              {data.topPages.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No page views.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.topPages.map((p) => (
                    <li key={p.path} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{p.path}</span>
                      <span className="shrink-0 text-gray-900 dark:text-gray-50 font-medium">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-4" aria-label="Top referrers">
              <h2 className={cardTitle}>Top referrers</h2>
              {data.topReferrers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No referrer data.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.topReferrers.map((r) => (
                    <li key={r.referrer} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{r.referrer}</span>
                      <span className="shrink-0 text-gray-900 dark:text-gray-50 font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card p-4" aria-label="Traffic split">
            <h2 className={cardTitle}>Traffic split</h2>
            {Object.keys(data.hosts).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No traffic recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {Object.entries(data.hosts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([host, count]) => (
                    <li key={host} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{host}</span>
                      <span className="shrink-0 text-gray-900 dark:text-gray-50 font-medium">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
