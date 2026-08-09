'use client';

import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

// Quiet install entry point (progress page, per plan §7.1). Renders nothing
// when the app is already installed or the browser can't install (desktop
// browsers without install support); on iOS it shows Share → Add to Home
// Screen instructions instead, since Safari never fires beforeinstallprompt.
export function InstallAppButton() {
  const { canInstall, isIOS, isInstalled, promptInstall } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (isInstalled) return null;

  if (isIOS) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowIOSHelp((show) => !show)}
          aria-expanded={showIOSHelp}
          className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
        >
          <Download className="w-4 h-4" /> Install app
        </button>
        {showIOSHelp && (
          <ol className="mt-2 max-w-xs list-decimal list-inside space-y-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300 shadow-sm">
            <li>
              In Safari, tap <Share className="inline w-4 h-4 -mt-0.5" aria-label="Share" />{' '}
              <strong>Share</strong> (on newer iOS it&rsquo;s under the <strong>&hellip;</strong> menu)
            </li>
            <li>Scroll down and tap &ldquo;<strong>Add to Home Screen</strong>&rdquo;</li>
            <li>Tap &ldquo;<strong>Add</strong>&rdquo;</li>
          </ol>
        )}
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void promptInstall();
      }}
      className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
    >
      <Download className="w-4 h-4" /> Install app
    </button>
  );
}
