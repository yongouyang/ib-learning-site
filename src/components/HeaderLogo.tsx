'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isDevEnvironment } from '@/lib/env';

/**
 * Dev-aware header logo.  On dev environments the logo SVGs include a "DEV"
 * badge after the wordmark.  Detection is deferred to a useEffect so the
 * initial SSR render always uses the prod logos.
 */
export function HeaderLogo() {
  const [dev, setDev] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-side env detection
    setDev(isDevEnvironment());
  }, []);

  const lightSrc = dev
    ? '/icons/icon-primary-light-background-dev.svg'
    : '/icons/icon-primary-light-background.svg';
  const darkSrc = dev
    ? '/icons/icon-inverse-dark-background-dev.svg'
    : '/icons/icon-inverse-dark-background.svg';

  return (
    <Link href="/" className="flex items-center">
      {/* Plain <img>: local SVGs get no next/image optimisation (see StudyNoteIllustration). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightSrc}
        alt="Octav Learning"
        className="h-6 w-auto dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkSrc}
        alt="Octav Learning"
        className="h-6 w-auto hidden dark:block"
      />
    </Link>
  );
}