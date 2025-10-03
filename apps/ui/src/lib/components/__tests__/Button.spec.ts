import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
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

  it('dispatches click event when clicked', async () => {
    const handleClick = vi.fn();
    const { getByRole, component } = render(Button, { props: {} });
    component.$on('click', handleClick);

    const button = getByRole('button');
    await fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch click when disabled', async () => {
    const handleClick = vi.fn();
    const { getByRole, component } = render(Button, { props: { disabled: true } });
    component.$on('click', handleClick);

    const button = getByRole('button');
    await fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not dispatch click when loading', async () => {
    const handleClick = vi.fn();
    const { getByRole, component } = render(Button, { props: { loading: true } });
    component.$on('click', handleClick);

    const button = getByRole('button');
    await fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with all variants', () => {
    const variants = ['primary', 'secondary', 'ghost'] as const;
    variants.forEach(variant => {
      const { getByRole } = render(Button, { variant });
      const button = getByRole('button');
      expect(button).toHaveClass(variant);
      expect(button).toHaveAttribute('data-variant', variant);
    });
  });

  it('applies fullWidth class when specified', () => {
    const { getByRole } = render(Button, { fullWidth: true });
    expect(getByRole('button')).toHaveClass('full');
  });

  it('shows spinner when loading', () => {
    const { container } = render(Button, { loading: true });
    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('toggles loading state correctly', async () => {
    const { getByRole, rerender } = render(Button, { loading: false });
    const button = getByRole('button');

    expect(button).not.toHaveClass('is-loading');
    expect(button).toBeEnabled();

    await rerender({ loading: true });
    expect(button).toHaveClass('is-loading');
    expect(button).toBeDisabled();

    await rerender({ loading: false });
    expect(button).not.toHaveClass('is-loading');
    expect(button).toBeEnabled();
  });

  it('passes through custom classes', () => {
    const { getByRole } = render(Button, { class: 'custom-class' });
    expect(getByRole('button')).toHaveClass('custom-class');
  });

  it('supports different button types', () => {
    const types = ['button', 'submit', 'reset'] as const;
    types.forEach(type => {
      const { getByRole } = render(Button, { type });
      expect(getByRole('button')).toHaveAttribute('type', type);
    });
  });
});
