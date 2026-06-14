import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '@/components/Nav';
import { ThemeProvider } from '@/context/ThemeContext';

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
  it('renders navigation items with Lucide icons', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    );

    expect(screen.getByRole('link', { name: /Learn/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Current theme:/i })).toBeInTheDocument();

    // Lucide icons render as inline SVGs inside the nav items.
    const learnLink = screen.getByRole('link', { name: /Learn/i });
    const progressLink = screen.getByRole('link', { name: /Progress/i });
    expect(learnLink.querySelector('svg')).toBeInTheDocument();
    expect(progressLink.querySelector('svg')).toBeInTheDocument();
  });

  it('marks the current page as active', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    );
    const learnLink = screen.getByRole('link', { name: /Learn/i });
    expect(learnLink).toHaveClass('text-blue-600');
  });
});
