'use client';

import { Dropdown } from 'react-bootstrap';
import styles from './Header.module.css';

export type LanguageOption = { value: string; label: string };

export function LanguageSelector({
  locale,
  label,
  options,
  onChange,
}: Readonly<{
  locale: string;
  label: string;
  options: LanguageOption[];
  onChange: (locale: string) => void;
}>) {
  const selectedLabel = options.find((option) => option.value === locale)?.label ?? locale;

  return (
    <Dropdown className="mr-2" align="end">
      <Dropdown.Toggle
        id="lang-selector"
        data-testid="lang-selector"
        aria-label={`${label}: ${selectedLabel}`}
        className={`${styles.dropdownToggle} ${styles.languageSelectorToggle}`}
        variant="outline-secondary"
        size="sm"
      >
        {selectedLabel}
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ minWidth: '100%' }}>
        {options.map((option) => (
          <Dropdown.Item
            as="button"
            className="px-2"
            key={option.value}
            active={option.value === locale}
            aria-current={option.value === locale ? 'true' : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
