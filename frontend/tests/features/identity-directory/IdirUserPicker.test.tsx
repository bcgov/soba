import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
import type { UserSearchResponse, UserSearchUser } from '@soba/lib';
import { IdirUserPicker } from '@/src/features/identity-directory/ui/IdirUserPicker';
import { searchUsers } from '@/src/features/identity-directory/data/api';
vi.mock('@/src/features/identity-directory/data/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/features/identity-directory/data/api')>()),
  searchUsers: vi.fn(),
}));
vi.mock('@/src/shared/api/callToken', () => {
  const signedInToken = () => 'token';
  return { useCallToken: () => ({ signedInToken }) };
});
const user: UserSearchUser = {
  identityProvider: 'azureidir',
  subject: 'alice-guid@azureidir',
  guid: 'alice-guid',
  username: 'ASMITH',
  displayName: 'Alice Smith',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  sobaUserId: null,
  sources: ['css-v1'],
};
const found = (users: UserSearchUser[]): UserSearchResponse => ({
  users,
  truncated: false,
  plugins: [{ code: 'css-v1', status: 'ok', truncated: false }],
});
beforeEach(() => vi.resetAllMocks());
it('searches the form context and selects a directory user', async () => {
  vi.mocked(searchUsers).mockResolvedValue(found([user]));
  const onSelect = vi.fn();
  render(<IdirUserPicker formId="form-1" onSelect={onSelect} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: ' alice@example.com ' },
  });
  await screen.findByRole('option', { name: /Alice Smith/ });
  expect(searchUsers).toHaveBeenCalledWith('token', 'form-1', 'azureidir', {
    email: 'alice@example.com',
  });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'IDIR user' }), { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'IDIR user' }), { key: 'Enter' });
  expect(onSelect).toHaveBeenLastCalledWith(user);
});
it('ignores results after the search input changes', async () => {
  let resolve!: (value: UserSearchResponse) => void;
  vi.mocked(searchUsers).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<IdirUserPicker formId="form-1" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: 'alice' },
  });
  await waitFor(() => expect(searchUsers).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), { target: { value: 'b' } });
  resolve(found([user]));
  await waitFor(() =>
    expect(screen.queryByRole('option', { name: /Alice Smith/ })).not.toBeInTheDocument(),
  );
});
it('shows a recoverable search error', async () => {
  vi.mocked(searchUsers).mockRejectedValue(new Error('unavailable'));
  render(<IdirUserPicker formId="form-1" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: 'alice' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('IDIR user search is unavailable');
});
it('debounces typing and skips short searches', async () => {
  vi.mocked(searchUsers).mockResolvedValue(found([]));
  render(<IdirUserPicker formId="form-1" />);
  const input = screen.getByRole('combobox', { name: 'IDIR user' });
  fireEvent.change(input, { target: { value: 'a' } });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(searchUsers).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'al' } });
  fireEvent.change(input, { target: { value: 'alice' } });
  expect(searchUsers).not.toHaveBeenCalled();
  await screen.findByText('No IDIR users found. Try another search.');
  expect(searchUsers).toHaveBeenCalledTimes(1);
  expect(searchUsers).toHaveBeenCalledWith('token', 'form-1', 'azureidir', { email: 'alice' });
});
