'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

// Trail like: Home › Biology › Cell Structure › Quiz
// The last item is the current page (not linked). Long labels truncate so the
// trail stays on one line on phone-width screens.
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm mb-4 min-w-0">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1 min-w-0">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 shrink-0" aria-hidden="true" />}
            {isLast || !item.href ? (
              <span
                aria-current={isLast ? 'page' : undefined}
                className="text-gray-500 dark:text-gray-400 truncate max-w-[45vw] md:max-w-xs"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {idx === 0 && <Home className="w-3.5 h-3.5" aria-hidden="true" />}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
