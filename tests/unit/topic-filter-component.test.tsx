import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopicFilter } from '@/components/TopicFilter';

describe('TopicFilter component', () => {
  it('renders search input with a Lucide search icon', () => {
    render(<TopicFilter value={{ query: '', stage: 'all' }} onChange={vi.fn()} resultCount={0} />);

    expect(screen.getByRole('textbox', { name: /Search topics/i })).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('clears the query when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TopicFilter value={{ query: 'algebra', stage: 'all' }} onChange={onChange} resultCount={1} />);

    const clearButton = screen.getByRole('button', { name: /Clear search/i });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith({ query: '', stage: 'all' });
  });

  it('switches stage filter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TopicFilter value={{ query: '', stage: 'all' }} onChange={onChange} resultCount={5} />);

    await user.click(screen.getByRole('button', { name: 'IB DP' }));
    expect(onChange).toHaveBeenCalledWith({ query: '', stage: 'dp' });
  });
});
