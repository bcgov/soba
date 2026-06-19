'use client';

import { TextField, Button } from '@bcgov/design-system-react-components';
import { FaMagnifyingGlass, FaX } from 'react-icons/fa6';
import styles from './ListPageSearchField.module.css';

type ListPageSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
};

export function ListPageSearchField({ value, onChange, testIdPrefix }: ListPageSearchFieldProps) {
  return (
    <div className={styles.searchField}>
      <TextField
        aria-label="Search"
        data-testid={`search-${testIdPrefix}-text`}
        value={value}
        onChange={onChange}
        iconLeft={<FaMagnifyingGlass />}
        iconRight={
          value ? (
            <Button
              variant="link"
              isIconButton
              type="button"
              data-testid={`search-${testIdPrefix}-button`}
              aria-label="Clear search"
              onPress={() => onChange('')}
            >
              <FaX size={12} />
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
