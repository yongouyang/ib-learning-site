import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';

export const metadata: Metadata = pageMeta({
  path: '/mistakes',
  title: 'Your mistake notebook',
  description: 'Review unresolved mistakes and track improvement across your Octav Learning practice.',
  indexable: false,
});

export default function MistakesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
