import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Button from '../Button.svelte';

describe('Button', () => {
  it('applies variant class', () => {
    const { getByRole } = render(Button, { variant: 'secondary' });
    expect(getByRole('button')).toHaveClass('secondary');
  });

  it('disables when loading', async () => {
    const { getByRole, rerender } = render(Button, { loading: true });
    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    await rerender({ loading: false });
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).not.toBeDisabled();
  });
});
