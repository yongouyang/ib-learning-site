'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { navItems } from './nav-items';

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-medium transition-colors ${
                active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
          <ThemeToggle />
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Theme</span>
        </div>
      </div>
    </nav>
  );
}
