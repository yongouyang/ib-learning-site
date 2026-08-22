'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

// A tracked <Link> for cross-navigation CTAs (analytics A4). Usable from
// server components too — the tracking happens client-side on click. `ctaId`
// is a stable per-site identifier surfaced in the analytics summary.
export function CtaLink({
  ctaId,
  href,
  className,
  children,
}: {
  ctaId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent('cta_clicked', { ctaId })}>
      {children}
    </Link>
  );
}
