'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  href?: string;
  label: string;
  /** Drop this intermediate crumb below `sm` so the current-page h1 keeps clear of the fixed top-right pill at phone widths. */
  hideOnMobile?: boolean;
}

// Trail like: Home › Biology › Cell Structure › Quiz
// The last item is the current page (not linked). Every crumb's label is capped
// and ellipsised at phone widths so the trail stays INSIDE the viewport — it can
// still wrap onto a second line (the caps are deliberately narrow enough to keep
// the identifying part of a long crumb on the first line, which is where the
// fixed top-right pill is not).
// `currentAsHeading` renders the current-page item as the page's <h1>, for
// pages where a separate title would just duplicate the breadcrumb text.
export function Breadcrumbs({ items, currentAsHeading = false }: { items: BreadcrumbItem[]; currentAsHeading?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm mb-4 min-w-0">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span
            key={idx}
            className={`flex items-center gap-1 min-w-0 ${item.hideOnMobile ? 'hidden sm:flex' : ''} ${
              // On phones the heading takes its own full-width line BELOW the
              // fixed top-right pill (mt clears it) — an inline 45vw box that
              // starts after the crumbs still runs under the pill.
              isLast && currentAsHeading ? 'max-sm:basis-full max-sm:mt-9' : ''
            }`}
          >
            {idx > 0 && (
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-600 shrink-0 ${isLast && currentAsHeading ? 'max-sm:hidden' : ''}`}
                aria-hidden="true"
              />
            )}
            {isLast || !item.href ? (
              isLast && currentAsHeading ? (
                <h1
                  aria-current="page"
                  // No `truncate`, no mobile width cap: on phones the heading
                  // sits on its own full-width line (see span classes), so a
                  // wrapped title beats an elided or narrow-boxed one.
                  className="text-2xl font-bold text-gray-900 dark:text-gray-50 md:max-w-xs"
                >
                  {item.label}
                </h1>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="text-gray-500 dark:text-gray-400 truncate max-w-[45vw] md:max-w-xs"
                >
                  {item.label}
                </span>
              )
            ) : (
              <Link
                href={item.href}
                // NOT `shrink-0` + a bare label: a linked crumb can carry a whole
                // topic title (the quiz/flashcards `study` crumb does), and an
                // unshrinkable unbounded flex item overflows the viewport instead
                // of wrapping — measured 878 px document inside a 320 px viewport
                // (iPhone SE) on `math-yr8-statistics-averages`, whose title is
                // the corpus maximum at 124 chars. Cap + ellipsis like the label
                // branch above keeps every crumb to the same width.
                className="inline-flex items-center gap-1 min-w-0 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {idx === 0 && <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate max-w-[45vw] md:max-w-xs">{item.label}</span>
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
