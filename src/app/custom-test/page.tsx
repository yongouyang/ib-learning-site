import type { Metadata } from 'next';
import CustomTestClient from './CustomTestClient';
import { pageMeta } from '@/lib/seo/page-meta';

export const metadata: Metadata = pageMeta({
  path: '/custom-test',
  title: 'Build a custom practice test',
  description: 'Choose your subject, year group, topics and difficulty to build a targeted practice test, then review and retry every mistake.',
});

export default function CustomTestPage() {
  return <CustomTestClient />;
}
