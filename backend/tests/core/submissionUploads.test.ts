import { isUploadRef, uploadsIn } from '../../src/core/submissionUploads';

const A = '0199f6a0-0000-7000-8000-00000000000a';
const B = '0199f6a0-0000-7000-8000-00000000000b';
const C = '0199f6a0-0000-7000-8000-00000000000c';

const upload = (id: string, extra: Record<string, unknown> = {}) => ({
  storage: 'chefs',
  id,
  url: `/files/${id}`,
  ...extra,
});

describe('isUploadRef', () => {
  it('takes a stored file with a UUID id, and nothing else', () => {
    expect(isUploadRef(upload(A))).toBe(true);
    expect(isUploadRef({ storage: 'chefs', id: 'not-a-uuid' })).toBe(false);
    expect(isUploadRef({ storage: 'url', id: A })).toBe(false);
    expect(isUploadRef([upload(A)])).toBe(false);
    expect(isUploadRef(null)).toBe(false);
  });
});

describe('uploadsIn', () => {
  it('finds uploads in panels, columns and data grids, once each, in order of appearance', () => {
    const answers = {
      name: 'Pat',
      documents: [upload(A, { originalName: 'plan.pdf' })],
      panel: { columns: [{ photo: [upload(B, { name: 'b.jpg' })] }] },
      grid: [{ attachment: [upload(A, { originalName: 'plan copy.pdf' })] }, { attachment: [] }],
      later: [upload(C)],
    };

    expect(uploadsIn(answers)).toEqual([
      { id: A, name: 'plan.pdf' },
      { id: B, name: 'b.jpg' },
      { id: C, name: null },
    ]);
  });

  it('prefers the original name, and takes no blank name', () => {
    expect(uploadsIn([upload(A, { originalName: 'a.pdf', name: 'stored-a.pdf' })])).toEqual([
      { id: A, name: 'a.pdf' },
    ]);
    expect(uploadsIn([upload(A, { originalName: '  ' })])).toEqual([{ id: A, name: null }]);
  });

  it('finds none in answers without uploads', () => {
    expect(uploadsIn({ text: 'storage', nested: { id: A } })).toEqual([]);
    expect(uploadsIn(null)).toEqual([]);
  });
});
