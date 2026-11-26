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
    const toggle = screen.getByRole('button', { name: `${LABEL}: FR` });
    expect(toggle).toHaveTextContent('FR');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'EN', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FR', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('calls onChange with the selected value', () => {
    const onChange = vi.fn();
    render(<LanguageSelector locale="en" label={LABEL} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('lang-selector'));
    fireEvent.click(screen.getByRole('button', { name: 'FR', exact: true }));
    expect(onChange).toHaveBeenCalledWith('fr');
  });
});
