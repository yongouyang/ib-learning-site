'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const labels = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  // Avoid hydration mismatch: don't render until mounted.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 opacity-0"
        disabled
      >
        <Sun className="w-5 h-5" />
      </button>
    );
  }

  const next = {
    light: 'dark' as const,
    dark: 'system' as const,
    system: 'light' as const,
  };

  const Icon = icons[theme];

  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      aria-label={`Current theme: ${labels[theme]}. Click to switch.`}
      title={`Theme: ${labels[theme]} (click to switch)`}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
