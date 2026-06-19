import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListPageSearchField } from '@/src/components/ListPageSearchField';

describe('ListPageSearchField', () => {
  it('renders search input and clears value', async () => {
    const onChange = vi.fn();
    render(
      <ListPageSearchField value="team" onChange={onChange} testIdPrefix="workspaces" />,
    );

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByTestId('search-workspaces-text')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not show clear button when empty', () => {
    render(<ListPageSearchField value="" onChange={vi.fn()} testIdPrefix="forms" />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });
});
