'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, BarChart3 } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Learn', icon: BookOpen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
