'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// Subtle, dismissible strip shown while offline. Sits above the mobile bottom
// nav (h-16) on small screens; the nav is hidden from md up, so the banner
// drops to the bottom edge there.
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset the dismissal once connectivity comes back, so the next offline
  // episode shows the banner again.
  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-16 md:bottom-0 z-40 flex justify-center px-4 pb-3"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-gray-50 shadow-lg dark:bg-gray-100 dark:text-gray-900">
        <span>You&rsquo;re offline — studying works, AI marking doesn&rsquo;t.</span>
        <button
          type="button"
          aria-label="Dismiss offline notice"
          onClick={() => setDismissed(true)}
          className="rounded-full px-1 text-base leading-none text-gray-400 hover:text-gray-50 dark:text-gray-500 dark:hover:text-gray-900 transition-colors"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
