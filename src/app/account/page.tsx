'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, Trash2, Pencil, Plus, BarChart3, Database } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  AuthUser,
  ChildProfile,
  Stage,
  SessionInfo,
  listSessions as listSessionsRequest,
  revokeSession as revokeSessionRequest,
  exportData as exportDataRequest,
  deleteAccount as deleteAccountRequest,
} from '@/lib/auth-client';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const STAGE_LABELS: Record<Stage, string> = {
  ks3: 'KS3',
  igcse: 'IGCSE',
  dp: 'IB DP',
};

const inputClass =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

export default function AccountPage() {
  const { user, loaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !user) router.replace('/login');
  }, [loaded, user, router]);

  if (!loaded || !user) return null; // no flash of the protected page

  return <AccountContent user={user} />;
}

function AccountContent({ user }: { user: AuthUser }) {
  const { updateAccount, refresh } = useAuth();

  // Profile
  const [displayName, setDisplayName] = useState(user.displayName);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Child profiles
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStage, setEditStage] = useState<Stage>('ks3');
  const [addName, setAddName] = useState('');
  const [addStage, setAddStage] = useState<Stage>('ks3');
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [savingProfiles, setSavingProfiles] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Your data
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Admin console (Feature 2) — gated to allowlisted admins so the installed
  // PWA has an in-app path to the direct-URL-only admin pages.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/access', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { admin?: boolean } | null) => {
        if (active) setIsAdmin(body ? body.admin === true : false);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      setSessions(await listSessionsRequest());
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Could not load your sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // --- Profile ---------------------------------------------------------------

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileStatus({ type: 'error', text: 'Please enter a name.' });
      return;
    }
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await updateAccount({ displayName: trimmed });
      setProfileStatus({ type: 'success', text: 'Changes saved.' });
    } catch (err) {
      setProfileStatus({ type: 'error', text: err instanceof Error ? err.message : 'Could not save changes.' });
    } finally {
      setSavingProfile(false);
    }
  }

  // --- Child profiles --------------------------------------------------------

  function startEdit(profile: ChildProfile) {
    setEditingId(profile.profileId);
    setEditName(profile.displayName);
    setEditStage(profile.stage);
    setProfilesError(null);
  }

  async function saveEdit(profileId: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setProfilesError('Please enter a name.');
      return;
    }
    setSavingProfiles(true);
    setProfilesError(null);
    try {
      const next = user.childProfiles.map((p) =>
        p.profileId === profileId ? { ...p, displayName: trimmed, stage: editStage } : p
      );
      await updateAccount({ childProfiles: next });
      setEditingId(null);
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : 'Could not update this profile.');
    } finally {
      setSavingProfiles(false);
    }
  }

  async function removeProfile(profileId: string) {
    if (user.childProfiles.length <= 1) return; // min 1 profile enforced
    setSavingProfiles(true);
    setProfilesError(null);
    try {
      const next = user.childProfiles.filter((p) => p.profileId !== profileId);
      await updateAccount({ childProfiles: next });
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : 'Could not remove this profile.');
    } finally {
      setSavingProfiles(false);
    }
  }

  async function addProfile(e: FormEvent) {
    e.preventDefault();
    const trimmed = addName.trim();
    if (!trimmed) {
      setProfilesError('Please enter a name.');
      return;
    }
    if (user.childProfiles.length >= 6) {
      setProfilesError('You can have up to 6 profiles.');
      return;
    }
    setSavingProfiles(true);
    setProfilesError(null);
    try {
      const next = [...user.childProfiles, { profileId: crypto.randomUUID(), displayName: trimmed, stage: addStage }];
      await updateAccount({ childProfiles: next });
      setAddName('');
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : 'Could not add this profile.');
    } finally {
      setSavingProfiles(false);
    }
  }

  // --- Sessions --------------------------------------------------------------

  async function handleRevoke(sessionId: string) {
    setSessionsError(null);
    try {
      await revokeSessionRequest(sessionId);
      await loadSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Could not revoke that session.');
    }
  }

  // --- Your data -------------------------------------------------------------

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportDataRequest();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'octav-learning-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Deferred revoke: revoking synchronously can cancel the download in
      // Firefox before it starts (review low).
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export your data.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    // Delete and refresh are split (review low): a refresh failure after a
    // successful delete must not report "Could not delete your account."
    try {
      await deleteAccountRequest();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.');
      setDeleting(false);
      return;
    }
    try {
      await refresh(); // clear the now-invalid session from the header; the
      // unauthenticated guard above then redirects to /login.
    } catch {
      // refresh() never throws (it treats errors as logged-out), but even a
      // hypothetical failure here must not undo the successful delete.
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Account' }]} currentAsHeading />

      {/* Profile */}
      <section className="card p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">Profile</h2>

        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (profileStatus) setProfileStatus(null);
              }}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingProfile} className={primaryButtonClass}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
            {profileStatus && (
              <p
                aria-live="polite"
                className={`text-sm ${profileStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {profileStatus.text}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Admin console (admins only — in-app path to the direct-URL admin pages) */}
      {isAdmin === true && (
        <section className="card p-6 mb-4" aria-label="Admin console">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">Admin console</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Internal tools for site administrators.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin/analytics"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" /> Analytics
            </Link>
            <Link
              href="/admin/dynamodb"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Database className="w-4 h-4" aria-hidden="true" /> DynamoDB
            </Link>
          </div>
        </section>
      )}

      {/* Child profiles */}
      <section className="card p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">Child profiles</h2>

        <ul className="space-y-1 mb-4">
          {user.childProfiles.map((profile) => (
            <li key={profile.profileId} className="flex items-center gap-2 py-1">
              {editingId === profile.profileId ? (
                <>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      maxLength={40}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={`Edit ${profile.displayName}`}
                      className={`${inputClass} w-full`}
                    />
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value as Stage)}
                      aria-label={`Stage for ${profile.displayName}`}
                      className={`${inputClass} w-full`}
                    >
                      <option value="ks3">KS3</option>
                      <option value="igcse">IGCSE</option>
                      <option value="dp">IB DP</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveEdit(profile.profileId)}
                    disabled={savingProfiles}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{profile.displayName}</span>
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {STAGE_LABELS[profile.stage]}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(profile)}
                    disabled={savingProfiles}
                    aria-label={`Edit ${profile.displayName}`}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-2 min-w-[44px] min-h-[44px] rounded-xl text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProfile(profile.profileId)}
                    disabled={savingProfiles || user.childProfiles.length <= 1}
                    aria-label={`Remove ${profile.displayName}`}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-2 min-w-[44px] min-h-[44px] rounded-xl text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={addProfile} className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Add a profile</h3>
          <div>
            <label htmlFor="addName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Name
            </label>
            <input
              id="addName"
              type="text"
              maxLength={40}
              value={addName}
              onChange={(e) => {
                setAddName(e.target.value);
                if (profilesError) setProfilesError(null);
              }}
              placeholder="e.g. Alex"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="addStage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Stage
            </label>
            <select
              id="addStage"
              value={addStage}
              onChange={(e) => setAddStage(e.target.value as Stage)}
              className={inputClass}
            >
              <option value="ks3">KS3</option>
              <option value="igcse">IGCSE</option>
              <option value="dp">IB DP</option>
            </select>
          </div>
          <button type="submit" disabled={savingProfiles || user.childProfiles.length >= 6} className={primaryButtonClass}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Add profile
          </button>
        </form>

        {profilesError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">
            {profilesError}
          </p>
        )}
      </section>

      {/* Sessions */}
      <section className="card p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">Sessions</h2>

        {sessionsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : sessionsError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {sessionsError}
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No sessions found.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.sessionId} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                    {session.userAgent || 'Unknown device'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last active {new Date(session.lastAccessedAt).toLocaleString()}
                  </p>
                </div>
                {session.current ? (
                  <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                    This device
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRevoke(session.sessionId)}
                    className="shrink-0 inline-flex items-center justify-center px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Your data */}
      <section className="card p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">Your data</h2>

        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export my data'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Download everything stored in your account as a JSON file.
            </p>
            {exportError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-1.5">
                {exportError}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Delete account</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Permanently erases your account, progress and sessions. This cannot be undone.
            </p>

            {confirmingDelete ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  This will permanently delete your account and all progress. Are you sure?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="inline-flex items-center justify-center py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 py-3 px-4 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete account
              </button>
            )}

            {deleteError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">
                {deleteError}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
