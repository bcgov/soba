'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { IdentityProviders, type UserSearchUser } from '@soba/lib';
import { idirSearchErrorMessage, searchUsers } from '../data/api';
import { useCallToken } from '@/src/shared/api/callToken';

type SearchField = 'email' | 'firstName' | 'lastName';

const userLabel = (user: UserSearchUser) =>
  `${user.displayName || user.username || user.subject} — ${user.email || user.username || user.subject}`;

export function IdirUserPicker({
  formId,
  onSelect,
}: Readonly<{
  formId: string;
  onSelect?: (user: UserSearchUser | null) => void;
}>) {
  const id = useId();
  const { signedInToken } = useCallToken();
  const [field, setField] = useState<SearchField>('email');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserSearchUser[]>([]);
  const [selected, setSelected] = useState<UserSearchUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);

  function reset() {
    request.current += 1;
    setUsers([]);
    setSelected(null);
    setSearched(false);
    setLoading(false);
    setError('');
    setActive(-1);
    onSelect?.(null);
  }

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const current = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchUsers(signedInToken(), formId, IdentityProviders.azureidir, {
          [field]: query.trim(),
        });
        if (current !== request.current) return;
        setUsers(result.users);
        setSearched(true);
      } catch (err) {
        if (current === request.current) setError(idirSearchErrorMessage(err));
      } finally {
        if (current === request.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [query, field, formId, selected, signedInToken]);

  function select(user: UserSearchUser) {
    request.current += 1;
    setSelected(user);
    setQuery(userLabel(user));
    setOpen(false);
    setLoading(false);
    onSelect?.(user);
  }
  const expanded = open && !selected && users.length > 0;
  return (
    <div>
      <h3 className="h5">Find an IDIR user</h3>
      <div className="d-flex flex-wrap align-items-start gap-3 mb-3">
        <div>
          <label htmlFor={`${id}-field`} className="form-label">
            Search by
          </label>
          <select
            id={`${id}-field`}
            className="form-select"
            value={field}
            onChange={(e) => {
              reset();
              setQuery('');
              setField(e.target.value as SearchField);
            }}
          >
            <option value="email">Email</option>
            <option value="firstName">First name</option>
            <option value="lastName">Last name</option>
          </select>
        </div>
        <div className="position-relative flex-grow-1">
          <label htmlFor={`${id}-query`} className="form-label">
            IDIR user
          </label>
          <input
            id={`${id}-query`}
            className="form-control"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={`${id}-users`}
            aria-describedby={`${id}-hint`}
            aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
            autoComplete="off"
            value={query}
            maxLength={254}
            placeholder="Type to search…"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              reset();
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setActive(-1);
              }
              if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && users.length > 0 && !selected) {
                e.preventDefault();
                setOpen(true);
                setActive((previous) => {
                  if (e.key === 'ArrowDown') return (previous + 1) % users.length;
                  return previous <= 0 ? users.length - 1 : previous - 1;
                });
              }
              if (e.key === 'Enter' && expanded && active >= 0) {
                e.preventDefault();
                select(users[active]);
              }
            }}
          />
          <p id={`${id}-hint`} className="form-text">
            Type at least 2 characters. Results appear automatically.
          </p>
          {expanded && (
            <ul
              id={`${id}-users`}
              role="listbox"
              aria-label="IDIR users"
              className="list-group position-absolute w-100 shadow"
              style={{ zIndex: 10, maxHeight: '18rem', overflowY: 'auto' }}
            >
              {users.map((user, index) => (
                <li key={`${user.identityProvider}-${user.subject}`} role="none">
                  <button
                    type="button"
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={active === index}
                    tabIndex={-1}
                    className={`list-group-item list-group-item-action${active === index ? ' active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(user)}
                  >
                    {userLabel(user)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div role="status" aria-live="polite">
        {loading && <p>Searching IDIR users…</p>}
        {searched && !selected && users.length === 0 && (
          <p>No IDIR users found. Try another search.</p>
        )}
        {searched && !selected && users.length > 0 && <p>{users.length} users found.</p>}
      </div>
      {selected && (
        <p>
          Selected: {selected.username ?? selected.subject}
          {selected.email ? ` (${selected.email})` : ''}
        </p>
      )}
      <p className="text-muted mb-0">
        Selecting a user does not grant access. Team assignment is not available yet.
      </p>
    </div>
  );
}
