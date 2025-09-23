import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StatusPill from '../StatusPill.svelte';

describe('StatusPill', () => {
  it('shows provided label', () => {
    const { getByText } = render(StatusPill, { props: { status: 'warn', label: 'Degraded' } });
    expect(getByText('Degraded')).toBeInTheDocument();
  });

  it('applies status class', () => {
    const { container } = render(StatusPill, { props: { status: 'error' } });
    const pill = container.querySelector('.status');
    expect(pill).toHaveClass('error');
  });
});
