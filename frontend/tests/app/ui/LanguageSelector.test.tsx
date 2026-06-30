import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from '@/app/ui/LanguageSelector';

const LABEL = 'Select Language';
const options = [
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
];

describe('LanguageSelector', () => {
  it('renders the provided options and reflects the current locale', () => {
    render(<LanguageSelector locale="fr" label={LABEL} options={options} onChange={() => {}} />);
    const select = screen.getByTestId('lang-selector') as HTMLSelectElement;
    expect(select).toHaveAttribute('aria-label', LABEL);
    expect(select.value).toBe('fr');
    expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'FR' })).toBeInTheDocument();
  });

  it('calls onChange with the selected value', () => {
    const onChange = vi.fn();
    render(<LanguageSelector locale="en" label={LABEL} options={options} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('lang-selector'), { target: { value: 'fr' } });
    expect(onChange).toHaveBeenCalledWith('fr');
  });
});
