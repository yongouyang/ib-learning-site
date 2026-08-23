import { Suspense } from 'react';
import LoginClient, { LoginSkeleton } from './login-client';

// The client reads `?next=` via useSearchParams, which requires a Suspense
// boundary on a prerendered (static-export) route — the fallback skeleton is
// the same card shape the client shows, so there is no jarring swap.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginClient />
    </Suspense>
  );
}
