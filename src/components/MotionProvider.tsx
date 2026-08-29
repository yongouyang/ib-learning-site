'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

// Global framer-motion preferences. reducedMotion="user" honours the OS
// reduced-motion setting for every motion component in the app: transform and
// layout animations become instant while opacity fades remain — the Apple
// reduced-motion pattern (cross-fade, not slide/spring). This is the single
// gate for what used to be ungated entrance animations (UX-guidelines debt).
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
