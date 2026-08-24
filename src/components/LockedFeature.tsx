'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEntitlements } from '@/context/EntitlementsContext';
import type { FeatureId } from '@/lib/entitlements/features';

// Phase E1 — premium tease wrapper (entitlement-policy §Enforcement: content
// gating is UX-only, a conversion surface, NOT a security boundary). When the
// session lacks `feature`, the children stay VISIBLE but inert (greyed out,
// untappable, hidden from assistive tech) behind a benefit card linking to
// /pricing; entitled sessions get the children untouched.
//
// While entitlements are still resolving (loaded === false) children render
// unlocked — a gate is UX-only, so it must never flash a lock over content
// the user may be entitled to (UX guidelines: hydration-swap rule).
export function LockedFeature({
  feature,
  title,
  benefit,
  compact = false,
  children,
}: {
  feature: FeatureId;
  /** What is locked, e.g. "Full exam sets". */
  title: string;
  /** Why it's worth upgrading — names the benefit, not the feature (copy voice).
      Unused in compact mode. */
  benefit: string;
  /**
   * Compact mode: instead of the full benefit card, the inert preview gets a
   * small lock row linking to /pricing. For lists where a page-level tease
   * already made the pitch (copy voice: say it once).
   */
  compact?: boolean;
  children: ReactNode;
}) {
  const { has, loaded } = useEntitlements();

  if (!loaded || has(feature)) return <>{children}</>;

  if (compact) {
    return (
      <div className="relative">
        <div inert aria-hidden="true" className="pointer-events-none select-none opacity-40">
          {children}
        </div>
        <Link
          href="/pricing"
          className="mt-1 -ml-2 inline-flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          Premium · {title}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* inert + aria-hidden: the preview is visual only — keyboard and screen
          readers go straight to the lock message below. */}
      <div inert aria-hidden="true" className="pointer-events-none select-none opacity-40">
        {children}
      </div>
      <div className="card p-5 mt-3 text-center">
        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Premium</p>
        <p className="mt-1 font-bold text-gray-900 dark:text-gray-50">{title}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{benefit}</p>
        <Link
          href="/pricing"
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          See Premium plans
        </Link>
      </div>
    </div>
  );
}
