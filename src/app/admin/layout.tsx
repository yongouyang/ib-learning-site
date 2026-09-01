import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';

/**
 * Covers /admin/analytics and /admin/dynamodb (both `'use client'`, so neither can export
 * metadata). Internal tooling reached by a direct URL — never indexable, and also
 * robots.txt-disallowed (docs/seo-technical-plan.md §4.1); belt and braces, because the
 * header links disappear for an anonymous crawler but the routes do not.
 */
// Child segments override title + canonical (see admin/analytics/layout.tsx) so the two
// consoles are not byte-identical documents; `robots` is inherited from here.
export const metadata: Metadata = pageMeta({
  path: '/admin',
  title: 'Admin console',
  description: 'Internal analytics and data console. Not part of the product.',
  indexable: false,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
