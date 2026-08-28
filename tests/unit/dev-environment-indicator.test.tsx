import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevEnvironmentIndicator } from '@/components/DevEnvironmentIndicator';
import { isDevEnvironment } from '@/lib/env';

// The component's contract after the 2026-08-28 fix: it renders the red rim +
// DEV label on dev hosts and NEVER touches the document head. The dev-badged
// manifest/icon variants are served at the CDN edge (dev_brand_rewrite in the
// site module's url_rewrite Function) because mutating the metadata-managed
// head links client-side fought Next's head reconciliation and left two
// <link rel="manifest"> tags (the pwa.spec.ts failure).

vi.mock('@/lib/env', () => ({
  isDevEnvironment: vi.fn(),
}));

const mockIsDev = vi.mocked(isDevEnvironment);

describe('DevEnvironmentIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDev.mockReturnValue(true);
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('renders the rim + DEV label on dev hosts', () => {
    render(<DevEnvironmentIndicator />);
    expect(screen.getByText('DEV')).toBeInTheDocument();
  });

  it('renders nothing off dev hosts', () => {
    mockIsDev.mockReturnValue(false);
    const { container } = render(<DevEnvironmentIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never mutates head links (manifest/icons stay as metadata rendered them)', () => {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.webmanifest';
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = '/icons/icon-favicon-app-icon.svg';
    document.head.append(manifest, icon);

    render(<DevEnvironmentIndicator />);

    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(manifest.href).toBe(`${window.location.origin}/manifest.webmanifest`);
    expect(icon.href).toBe(`${window.location.origin}/icons/icon-favicon-app-icon.svg`);
  });
});
