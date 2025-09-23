import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Slider from '../Slider.svelte';

describe('Slider', () => {
  it('renders with label and value', () => {
    const { getByLabelText } = render(Slider, { label: 'Master volume', value: 50, unit: '%', max: 200 });
    const slider = getByLabelText(/Master volume/);
    expect(slider).toHaveAttribute('aria-valuemax', '200');
  });

  it('emits change events', async () => {
    const { getByRole, getByText } = render(Slider, { value: 10, label: 'Level', unit: '%' });
    const slider = getByRole('slider');
    await fireEvent.input(slider, { target: { value: '25' } });
    expect(getByText('25%')).toBeInTheDocument();
  });
});
