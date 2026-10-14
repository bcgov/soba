import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
import { IdirUserPicker } from '@/src/features/identity-directory/ui/IdirUserPicker';
import { searchIdirUsers } from '@/src/features/identity-directory/data/api';
vi.mock('@/src/features/identity-directory/data/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/features/identity-directory/data/api')>()),
  searchIdirUsers: vi.fn(),
}));
vi.mock('@/src/shared/api/callToken', () => {
  const signedInToken = () => 'token';
  return { useCallToken: () => ({ signedInToken }) };
});
const user = {
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
};
beforeEach(() => vi.resetAllMocks());
it('searches with workspace context and selects a directory user', async () => {
  vi.mocked(searchIdirUsers).mockResolvedValue({ users: [user] });
  const onSelect = vi.fn();
  render(<IdirUserPicker workspaceId="workspace" onSelect={onSelect} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: ' alice@example.com ' },
  });
  await screen.findByRole('option', { name: /Alice Smith/ });
  expect(searchIdirUsers).toHaveBeenCalledWith('token', {
    workspaceId: 'workspace',
    email: 'alice@example.com',
  });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'IDIR user' }), { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'IDIR user' }), { key: 'Enter' });
  expect(onSelect).toHaveBeenLastCalledWith(user);
});
it('ignores results after the search input changes', async () => {
  let resolve!: (value: { users: (typeof user)[] }) => void;
  vi.mocked(searchIdirUsers).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<IdirUserPicker workspaceId="workspace" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: 'alice' },
  });
  await waitFor(() => expect(searchIdirUsers).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), { target: { value: 'b' } });
  resolve({ users: [user] });
  await waitFor(() =>
    expect(screen.queryByRole('option', { name: /Alice Smith/ })).not.toBeInTheDocument(),
  );
});
it('shows a recoverable search error', async () => {
  vi.mocked(searchIdirUsers).mockRejectedValue(new Error('unavailable'));
  render(<IdirUserPicker workspaceId="workspace" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'IDIR user' }), {
    target: { value: 'alice' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('IDIR user search is unavailable');
});
it('debounces typing and skips short searches', async () => {
  vi.mocked(searchIdirUsers).mockResolvedValue({ users: [] });
  render(<IdirUserPicker workspaceId="workspace" />);
  const input = screen.getByRole('combobox', { name: 'IDIR user' });
  fireEvent.change(input, { target: { value: 'a' } });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(searchIdirUsers).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'al' } });
  fireEvent.change(input, { target: { value: 'alice' } });
  expect(searchIdirUsers).not.toHaveBeenCalled();
  await screen.findByText('No IDIR users found. Try another search.');
  expect(searchIdirUsers).toHaveBeenCalledTimes(1);
  expect(searchIdirUsers).toHaveBeenCalledWith('token', {
    workspaceId: 'workspace',
    email: 'alice',
  });
});
