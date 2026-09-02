'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { NextAction } from '@/lib/home-next-action';
import { CtaLink } from '@/components/CtaLink';
import { trackEvent } from '@/lib/analytics';

interface HeroProps {
  isReturning: boolean;
  nextAction: NextAction;
}

// Home hero. Approach A hydration strategy: first paint is always the full
// first-time hero (SSR default), then — once ProgressContext loads — returning
// users crossfade to the compact greeting via AnimatePresence.
// `initial={false}` keeps the SSR paint static (no entrance animation).
// Compact variant is a one-line greeting + a smart deep-link to the next action
// (no eyebrow, no giant CTA — returning users want their next step, not a pitch).
export function Hero({ isReturning, nextAction }: HeroProps) {
  return (
    <section aria-label="Welcome" className="mb-10 min-h-[72px]">
      <AnimatePresence mode="wait" initial={false}>
        {isReturning ? (
          <motion.div
            key="compact"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mb-3">
              Welcome back{nextAction.summary ? ` — ${nextAction.summary}` : ''}.
            </h1>
            <CtaLink
              ctaId="hero_next_action"
              href={nextAction.href}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-base hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {nextAction.label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </CtaLink>
          </motion.div>
        ) : (
          <motion.div
            key="full"
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Discovery links into the tier hubs (plan §4.4 item 3): the hubs give
                study pages a ≤3-click path from home. IGCSE stays unlinked — the tier
                has no content yet, so it has no route. */}
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3">
              <Link href="/ks3" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                KS3
              </Link>
              {' · IGCSE · '}
              <Link href="/ibdp" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                IB DP
              </Link>
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-3">
              Master secondary school — from KS3 to IB.
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mb-6">
              Everything you need from first lesson to final exam — free, on any device.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <CtaLink
                ctaId="hero_diagnostic"
                href="/diagnostics"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold text-base shadow-sm hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors"
              >
                Start with a free diagnostic
                <span className="text-blue-50 dark:text-blue-50 font-normal text-sm">5 min · no sign-up</span>
              </CtaLink>
              <button
                type="button"
                onClick={() => {
                  trackEvent('cta_clicked', { ctaId: 'hero_browse_subjects' });
                  document.getElementById('subjects')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-base bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Browse subjects <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
