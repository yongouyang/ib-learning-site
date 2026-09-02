import type { Metadata } from 'next';

/** See /admin/analytics/layout.tsx — identity override, robots inherited from /admin. */
export const metadata: Metadata = {
  title: { absolute: 'Data console' },
  alternates: { canonical: '/admin/dynamodb' },
};

export default function AdminDynamodbLayout({ children }: { children: React.ReactNode }) {
  return children;
}
