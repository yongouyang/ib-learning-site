import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DualRingDonut from '@/components/DualRingDonut';

describe('DualRingDonut', () => {
  it('shows the known percentage in the center', () => {
    render(<DualRingDonut seen={10} known={5} total={20} />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /5 known of 10 seen, 20 total/ })).toBeInTheDocument();
  });

  it('renders two progress rings plus two track rings', () => {
    const { container } = render(<DualRingDonut seen={10} known={5} total={20} />);
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  it('renders no progress rings when total is zero', () => {
    const { container } = render(<DualRingDonut seen={0} known={0} total={0} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2); // tracks only
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('clamps fractions above 100%', () => {
    const { container } = render(<DualRingDonut seen={30} known={30} total={20} />);
    // Outer ring: full circle dash (fraction clamped to 1).
    const circles = container.querySelectorAll('circle');
    const dash = circles[1].getAttribute('stroke-dasharray')!;
    const [filled, total] = dash.split(' ').map(Number);
    expect(filled).toBeCloseTo(total, 1);
  });
});
