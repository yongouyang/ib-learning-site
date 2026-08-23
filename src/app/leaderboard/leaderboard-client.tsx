'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { loginHref } from '@/lib/safe-redirect';
import { handleForProfile } from '@/lib/leaderboard/handles';
import { formatResetLocal } from '@/lib/leaderboard/format';
import type {
  LeaderboardBoardResponse,
  LeaderboardRow,
  LeaderboardTeaserResponse,
} from '@/lib/leaderboard/types';
import type { Stage } from '@/lib/auth-client';

// Phase D6 — the weekly leaderboard page (docs/leaderboard-plan.md §7).
// Static client page: the board read endpoints (D3) do the session/profile
// validation; this component only renders. States: logged-out teaser (public
// /api/leaderboard/teaser), logged-in not-opted-in (value-prop card + inline
// join + read-only board), opted-in (podium + neighbourhood + self footer).
// Refresh: fetch on view + a 60s interval while the tab is visible (plan §11).

const STAGE_LABELS: Record<Stage, string> = {
  ks3: 'KS3',
  igcse: 'IGCSE',
  dp: 'IB DP',
};

const SCOPE_LABELS: Record<string, string> = {
  'stage:ks3': 'KS3',
  'stage:igcse': 'IGCSE',
  'stage:dp': 'IB DP',
  global: 'Global',
};

const REFRESH_MS = 60_000;

type FetchStatus = 'loading' | 'ok' | 'error';

const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

function BoardRow({ row, podium = false }: { row: LeaderboardRow; podium?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 min-h-[44px] border ${
        row.isSelf
          ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
          : 'border-transparent'
      }`}
    >
      <span
        className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
          row.rank === 1
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
        }`}
      >
        {row.rank}
      </span>
      <span
        className={`flex-1 min-w-0 truncate text-gray-900 dark:text-gray-50 ${
          podium ? 'font-semibold' : 'text-sm'
        }`}
      >
        {row.rank === 1 && <Trophy className="inline w-4 h-4 mr-1 -mt-0.5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />}
        {row.handle}
        {row.isSelf && <span className="sr-only"> (you)</span>}
      </span>
      <span className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
        {row.xp} XP
      </span>
    </li>
  );
}

export default function LeaderboardClient() {
  const { user, loaded, activeProfile, updateAccount } = useAuth();
  const userId = user?.userId ?? null;

  // Board profile: an explicit chip selection, else the account's active profile.
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const profile =
    user && user.childProfiles.length > 0
      ? user.childProfiles.find((p) => p.profileId === selectedProfileId) ??
        activeProfile ??
        user.childProfiles[0]
      : null;
  const profileId = profile?.profileId ?? null;

  const [week, setWeek] = useState<'current' | 'prev'>('current');
  const [board, setBoard] = useState<LeaderboardBoardResponse | null>(null);
  const [boardStatus, setBoardStatus] = useState<FetchStatus>('loading');
  const [prevSelfXp, setPrevSelfXp] = useState<number | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Logged-out teaser (public endpoint).
  const [teaser, setTeaser] = useState<LeaderboardTeaserResponse | null>(null);
  const [teaserStatus, setTeaserStatus] = useState<FetchStatus>('loading');

  const loadBoard = useCallback(async (pid: string, w: 'current' | 'prev', background = false) => {
    if (!background) setBoardStatus('loading');
    try {
      const res = await fetch(`/api/leaderboard?profileId=${encodeURIComponent(pid)}&week=${w}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        setBoardStatus('error');
        return;
      }
      setBoard((await res.json()) as LeaderboardBoardResponse);
      setBoardStatus('ok');
    } catch {
      setBoardStatus('error');
    }
  }, []);

  // Fetch on view / on profile or week change.
  useEffect(() => {
    if (!loaded || !userId || !profileId) return;
    void loadBoard(profileId, week);
  }, [loaded, userId, profileId, week, loadBoard]);

  // 60s refresh while the tab is visible (plan §11 — no real-time).
  useEffect(() => {
    if (!loaded || !userId || !profileId) return;
    const id = setInterval(() => {
      if (!document.hidden) void loadBoard(profileId, week, true);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [loaded, userId, profileId, week, loadBoard]);

  // Lazy prev-week fetch: only to power the footer's "last week: N XP"
  // fragment (rendered only when the prev board actually has a self row).
  useEffect(() => {
    setPrevSelfXp(null);
    if (!loaded || !userId || !profileId) return;
    let cancelled = false;
    fetch(`/api/leaderboard?profileId=${encodeURIComponent(profileId)}&week=prev`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LeaderboardBoardResponse | null) => {
        if (!cancelled && data?.self) setPrevSelfXp(data.self.xp);
      })
      .catch(() => {
        // The fragment is optional — a failed prev fetch just omits it.
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, userId, profileId]);

  useEffect(() => {
    if (!loaded || userId) return;
    let cancelled = false;
    fetch('/api/leaderboard/teaser')
      .then((res) => {
        if (!res.ok) throw new Error('teaser failed');
        return res.json();
      })
      .then((data: LeaderboardTeaserResponse) => {
        if (!cancelled) {
          setTeaser(data);
          setTeaserStatus('ok');
        }
      })
      .catch(() => {
        if (!cancelled) setTeaserStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, userId]);

  async function join() {
    if (!user || !profile) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      // Same full-replace path as the account page (D5): the server merges
      // leaderboard fields, and the other profiles are carried over verbatim.
      await updateAccount({
        childProfiles: user.childProfiles.map((p) =>
          p.profileId === profile.profileId ? { ...p, leaderboardOptIn: true } : p
        ),
      });
      await loadBoard(profile.profileId, week, true);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join the leaderboard.');
    } finally {
      setJoinBusy(false);
    }
  }

  const resetLabel = board && week === 'current' ? formatResetLocal(board.resetAt) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Leaderboard' }]} currentAsHeading />

      {!loaded ? (
        <div className="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : !user ? (
        // --- Logged out: public teaser (plan §7 — the conversion card) ------
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">
            This week&apos;s {SCOPE_LABELS[teaser?.scope ?? 'stage:ks3']} leaderboard
          </h2>
          {teaserStatus === 'loading' ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading…</p>
          ) : teaserStatus === 'ok' && teaser && teaser.top.length > 0 ? (
            <ol className="space-y-2 my-4" aria-label="Top three this week">
              {teaser.top.map((row) => (
                <BoardRow key={row.rank} row={{ ...row, isSelf: false }} podium />
              ))}
            </ol>
          ) : teaserStatus === 'ok' ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 my-4">
              No one on the board yet this week — be the first.
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 my-4">
              See how you compare this week.
            </p>
          )}
          <Link href={loginHref('/leaderboard')} className={primaryButtonClass}>
            Create a free account to join
          </Link>
        </section>
      ) : (
        <>
          {/* --- Profile switcher (multi-child accounts) --- */}
          {user.childProfiles.length > 1 && profile && (
            <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Profile">
              {user.childProfiles.map((p) => {
                const selected = p.profileId === profile.profileId;
                return (
                  <button
                    key={p.profileId}
                    type="button"
                    onClick={() => setSelectedProfileId(p.profileId)}
                    aria-pressed={selected}
                    className={`inline-flex items-center px-4 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p.displayName}
                  </button>
                );
              })}
            </div>
          )}

          {/* --- Not opted in: value-prop card + inline join (plan §7) --- */}
          {profile && profile.leaderboardOptIn !== true && (
            <section className="card p-6 mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">
                Join the leaderboard
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                See how you compare this week. Anonymous handle, opt out any time.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                You&apos;ll appear as{' '}
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  {profile.leaderboardHandle ?? handleForProfile(profile.profileId)}
                </span>
              </p>
              <button type="button" onClick={join} disabled={joinBusy} aria-busy={joinBusy} className={primaryButtonClass}>
                <Trophy className="w-4 h-4" aria-hidden="true" />
                {joinBusy ? 'Joining…' : 'Join leaderboard'}
              </button>
              {joinError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {joinError}
                </p>
              )}
            </section>
          )}

          {/* --- Board --- */}
          <section className="card p-6 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {SCOPE_LABELS[board?.scope ?? 'stage:ks3']} leaderboard
              </h2>
              <div
                className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                role="group"
                aria-label="Week"
              >
                {(['current', 'prev'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeek(w)}
                    aria-pressed={week === w}
                    className={`px-3 min-h-[44px] text-sm font-medium transition-colors ${
                      week === w
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {w === 'current' ? 'This week' : 'Last week'}
                  </button>
                ))}
              </div>
            </div>
            {resetLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Resets {resetLabel} your time
              </p>
            )}

            {boardStatus === 'error' ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Couldn&apos;t load the leaderboard.
                </p>
                <button
                  type="button"
                  onClick={() => profileId && void loadBoard(profileId, week)}
                  className="inline-flex items-center justify-center py-2 px-4 min-h-[44px] rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : boardStatus === 'loading' && !board ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Loading…</p>
            ) : board && board.top.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                {week === 'current'
                  ? `No one on the ${SCOPE_LABELS[board.scope]} board yet this week — be the first.`
                  : 'No board recorded for last week.'}
              </p>
            ) : board ? (
              <>
                {boardStatus === 'loading' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Refreshing…</p>
                )}
                <ol className="space-y-2" aria-label="Top three">
                  {board.top.slice(0, 3).map((row) => (
                    <BoardRow key={row.rank} row={row} podium />
                  ))}
                </ol>
                {board.self && board.neighbourhood.length > 0 && (
                  <section aria-label="Around you" className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">
                      Around you
                    </h3>
                    <ol className="space-y-2">
                      {board.neighbourhood.map((row) => (
                        <BoardRow key={row.rank} row={row} />
                      ))}
                    </ol>
                  </section>
                )}
              </>
            ) : null}
          </section>

          {/* --- Caller footer (current week only) --- */}
          {week === 'current' && profile && profile.leaderboardOptIn === true && board && (
            <section className="card p-4" aria-label="Your week">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {board.self ? (
                  <>
                    You: <span className="font-semibold text-gray-900 dark:text-gray-50">#{board.self.rank}</span>
                    {' · '}
                    {board.self.xp} XP this week
                    {prevSelfXp !== null && ` · last week: ${prevSelfXp} XP`}
                  </>
                ) : (
                  "You haven't earned XP this week — do a quiz to join the board."
                )}
              </p>
              <p className="text-sm mt-1">
                <Link href="/account" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Manage leaderboard settings
                </Link>
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
