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

// 'md' = desktop header (mouse-driven, 36px is fine); 'lg' = mobile floating
// toggle (touch-driven, must meet the 44px floor).
const sizeClasses = {
  md: { button: 'w-9 h-9', icon: 'w-5 h-5' },
  lg: { button: 'w-11 h-11', icon: 'w-6 h-6' },
};

export function ThemeToggle({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { theme, setTheme, mounted } = useTheme();
  const s = sizeClasses[size];

  // Avoid hydration mismatch: don't render until mounted.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme"
        className={`${s.button} flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 opacity-0`}
        disabled
      >
        <Sun className={s.icon} />
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
      className={`${s.button} flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
    >
      <Icon className={s.icon} />
    </button>
  );
}
