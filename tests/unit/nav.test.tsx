import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '@/components/Nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

describe('Nav', () => {
  it('renders five navigation items with Lucide icons', () => {
    render(<Nav />);

    expect(screen.getByRole('link', { name: /Learn/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Exams/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Progress/i })).toBeInTheDocument();

    // ThemeToggle moved out of Nav (floating button in layout).
    expect(screen.queryByRole('button', { name: /Current theme:/i })).not.toBeInTheDocument();

    // Lucide icons render as inline SVGs inside the nav items.
    for (const name of ['Learn', 'Review', 'Exams', 'Leaderboard', 'Progress']) {
      const link = screen.getByRole('link', { name: new RegExp(name, 'i') });
      expect(link.querySelector('svg')).toBeInTheDocument();
    }
  });

  it('marks the current page as active', () => {
    render(<Nav />);
    const learnLink = screen.getByRole('link', { name: /Learn/i });
    expect(learnLink).toHaveClass('text-blue-600');
  });
});
