'use client';

import { useTheme } from '@/context/ThemeContext';

const icons: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '🖥️',
};

const labels: Record<string, string> = {
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
        ☀️
      </button>
    );
  }

  const next: Record<string, 'light' | 'dark' | 'system'> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };

  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      aria-label={`Current theme: ${labels[theme]}. Click to switch.`}
      title={`Theme: ${labels[theme]} (click to switch)`}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <span className="text-lg">{icons[theme]}</span>
    </button>
  );
}
