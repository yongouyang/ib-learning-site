import type { Metadata } from 'next';

/**
 * Overrides only the identity fields — `robots` (noindex, follow) and the description merge
 * down from /admin/layout.tsx. Without this, both admin pages shared one <title> and both
 * canonicalised to /admin (caught by walking out/*.html for duplicate titles).
 */
export const metadata: Metadata = {
  title: { absolute: 'Product analytics' },
  alternates: { canonical: '/admin/analytics' },
};

export default function AdminAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
