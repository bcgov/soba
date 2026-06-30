'use client';

import styles from './LanguageSelector.module.css';

export type LanguageOption = { value: string; label: string };

/** Native select avoids React Aria auto-ids that can mismatch between SSR and hydration. */
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
  return (
    <select
      id="lang-selector"
      data-testid="lang-selector"
      aria-label={label}
      className={`form-select form-select-sm mr-2 ${styles.langSelect}`}
      value={locale}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
