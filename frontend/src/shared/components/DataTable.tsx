'use client';

import React from 'react';
import { Table, Spinner, Pagination } from 'react-bootstrap';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'start' | 'center' | 'end';
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  loadingMessage?: string;
  itemName?: string;
  pageSize?: number;
  currentPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  keyExtractor: (item: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  error = null,
  emptyMessage = 'No items found.',
  loadingMessage = 'Loading...',
  itemName = 'items',
  pageSize = 10,
  currentPage = 1,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  keyExtractor,
}: DataTableProps<T>) {
  const totalPages = totalItems ? Math.ceil(totalItems / pageSize) : 1;

  return (
    <div className="bg-white rounded overflow-hidden" style={{ border: 'none' }}>
      <Table hover responsive className="mb-0 align-middle" style={{ border: 'none' }}>
        <thead style={{ backgroundColor: '#EBEBEB', borderBottom: 'none' }}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-dark fw-bold border-0 text-${col.align || 'start'}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ borderTop: 'none' }}>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-5">
                <Spinner animation="border" variant="primary" size="sm" className="me-2" />
                {loadingMessage}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-5 text-muted">
                {error ? `Error: ${error}` : emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} style={{ borderBottom: '1px solid #dee2e6' }}>
                {columns.map((col) => (
                  <td key={`${keyExtractor(item)}-${col.key}`} className={`px-4 py-3 text-${col.align || 'start'}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {!loading && data.length > 0 && totalItems !== undefined && (
        <div 
          className="px-4 py-3 d-flex justify-content-between align-items-center" 
          style={{ backgroundColor: '#EBEBEB', color: '#333' }}
        >
          <div className="d-flex align-items-center gap-2">
            <span>Items per page:</span>
            {onPageSizeChange ? (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="form-select form-select-sm"
                style={{ width: '70px', display: 'inline-block', backgroundColor: 'transparent', border: 'none', fontWeight: '500' }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <span className="fw-medium">{pageSize}</span>
            )}
          </div>
          
          <div>
            {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} of {totalItems} {itemName}
          </div>
          
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-1">
              <span>{currentPage}</span>
              {onPageChange && totalPages > 1 && (
                <select 
                  value={currentPage}
                  onChange={(e) => onPageChange(Number(e.target.value))}
                  className="form-select form-select-sm"
                  style={{ width: '50px', backgroundColor: 'transparent', border: 'none', padding: '0 10px 0 0' }}
                >
                  {[...Array(totalPages)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}</option>
                  ))}
                </select>
              )}
              <span>of {totalPages} page(s)</span>
            </div>
            
            <div className="d-flex gap-2">
              <button 
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn btn-link p-0 text-dark"
                style={{ textDecoration: 'none', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                &lt;
              </button>
              <button 
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn btn-link p-0 text-dark"
                style={{ textDecoration: 'none', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
