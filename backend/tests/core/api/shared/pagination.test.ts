import {
  resolveCursorMode,
  encodeCursor,
  decodeCursor,
  decodeCursorAndMode,
  buildNextCursor,
  type CursorToken,
  type CursorListItem,
} from '../../../../src/core/api/shared/pagination';

describe('pagination', () => {
  it('resolveCursorMode returns id when sort is id:desc', () => {
    expect(resolveCursorMode({ sort: 'id:desc' })).toBe('id');
  });

  it('resolveCursorMode returns ts_id when sort is updatedAt:desc', () => {
    expect(resolveCursorMode({ sort: 'updatedAt:desc' })).toBe('ts_id');
  });

  it('resolveCursorMode returns cursor.m when cursor is provided', () => {
    expect(
      resolveCursorMode({ cursor: { m: 'ts_id', ts: '2020-01-01T00:00:00.000Z', id: 'x' } }),
    ).toBe('ts_id');
    expect(resolveCursorMode({ cursor: { m: 'id', id: 'y' } })).toBe('id');
  });

  it('encodeCursor then decodeCursor round-trips id mode', () => {
    const token: CursorToken = { m: 'id', id: 'abc' };
    const encoded = encodeCursor(token);
    expect(decodeCursor(encoded)).toEqual(token);
  });

  it('encodeCursor then decodeCursor round-trips ts_id mode', () => {
    const token: CursorToken = {
      m: 'ts_id',
      ts: '2020-01-01T00:00:00.000Z',
      id: 'abc',
    };
    const encoded = encodeCursor(token);
    expect(decodeCursor(encoded)).toEqual(token);
  });

  it('decodeCursor throws on invalid base64', () => {
    expect(() => decodeCursor('!!!')).toThrow('Invalid cursor');
  });

  it('decodeCursor throws on invalid JSON', () => {
    const bad = Buffer.from('not json', 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow();
  });

  it('decodeCursorAndMode returns cursorMode and sort and afterId from cursor', () => {
    const token: CursorToken = { m: 'id', id: 'x' };
    const encoded = encodeCursor(token);
    const result = decodeCursorAndMode({ cursor: encoded, sort: 'id:desc' });
    expect(result.cursorMode).toBe('id');
    expect(result.sort).toBe('id:desc');
    expect(result.afterId).toBe('x');
    expect(result.afterUpdatedAt).toBeUndefined();
  });

  it('decodeCursorAndMode returns afterUpdatedAt when cursor is ts_id', () => {
    const token: CursorToken = {
      m: 'ts_id',
      ts: '2020-06-15T12:00:00.000Z',
      id: 'y',
    };
    const encoded = encodeCursor(token);
    const result = decodeCursorAndMode({ cursor: encoded, sort: 'updatedAt:desc' });
    expect(result.cursorMode).toBe('ts_id');
    expect(result.afterId).toBe('y');
    expect(result.afterUpdatedAt).toEqual(new Date('2020-06-15T12:00:00.000Z'));
  });

  it('decodeCursorAndMode defaults sort to id:desc when not provided', () => {
    const result = decodeCursorAndMode({});
    expect(result.sort).toBe('id:desc');
    expect(result.cursorMode).toBe('id');
  });

  it('buildNextCursor returns null when hasMore is false', () => {
    const item: CursorListItem = { id: 'a', updatedAt: new Date() };
    expect(buildNextCursor(item, false, 'id')).toBeNull();
  });

  it('buildNextCursor returns null when lastItem is undefined', () => {
    expect(buildNextCursor(undefined, true, 'id')).toBeNull();
  });

  it('buildNextCursor returns encoded id cursor when hasMore and cursorMode id', () => {
    const item: CursorListItem = { id: 'last-id', updatedAt: new Date() };
    const next = buildNextCursor(item, true, 'id');
    expect(next).not.toBeNull();
    expect(decodeCursor(next!).m).toBe('id');
    expect(decodeCursor(next!).id).toBe('last-id');
  });

  it('buildNextCursor returns encoded ts_id cursor when hasMore and cursorMode ts_id', () => {
    const item: CursorListItem = {
      id: 'last-id',
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    };
    const next = buildNextCursor(item, true, 'ts_id');
    expect(next).not.toBeNull();
    const decoded = decodeCursor(next!);
    expect(decoded.m).toBe('ts_id');
    expect(decoded.id).toBe('last-id');
    if (decoded.m === 'ts_id') expect(decoded.ts).toBe('2020-01-01T00:00:00.000Z');
  });
});
