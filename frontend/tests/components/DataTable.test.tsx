import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '@/src/components/DataTable';

type Item = { id: string; name: string; value?: number };

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value', render: (it: Item) => <strong>{it.value ?? '-'}</strong> },
];

describe('DataTable', () => {
  it('renders empty message when no data', () => {
    render(<DataTable<Item> data={[]} columns={columns} keyExtractor={(i) => i.id} />);

    expect(screen.getByText('No items found.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <DataTable<Item>
        data={[]}
        columns={columns}
        loading
        loadingMessage="Please wait..."
        keyExtractor={(i) => i.id}
      />,
    );

    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders rows and calls paging callbacks', async () => {
    const data: Item[] = [
      { id: 'a1', name: 'Alice', value: 1 },
      { id: 'b2', name: 'Bob', value: 2 },
    ];
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <DataTable<Item>
        data={data}
        columns={columns}
        totalItems={2}
        pageSize={1}
        currentPage={1}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        keyExtractor={(i) => i.id}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();

    const nextBtn = screen.getByTestId('datatable-next-page-button');
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalled();

    const pageSizeSelect = screen.getByTestId('datatable-page-size-select');
    fireEvent.change(pageSizeSelect, { target: { value: '10' } });
    expect(onPageSizeChange).toHaveBeenCalled();
  });
});
