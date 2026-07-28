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
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tap <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Share" /> Share in Safari,
            then choose &ldquo;Add to Home Screen&rdquo;.
          </p>
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
