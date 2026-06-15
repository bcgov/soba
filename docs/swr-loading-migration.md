# Moving data loading to SWR

## Where we are

The frontend fetches data by hand. Each screen has a `useEffect` that calls an
API function, stores the result in `useState`, and tracks its own `loading`
flag. The guards look like this:

```ts
useEffect(() => {
  if (authenticated && token && activeWorkspaceId) {
    // fetch, set state, set loading false
  }
}, [authenticated, token, activeWorkspaceId]);
```

It works, but every screen repeats the same wiring, and "refresh on workspace
switch" is done manually. There's no shared cache, so two screens asking for the
same thing fetch it twice.

The loading UI is already standard: one `CenteredProgress` component (a centered
spinner, `role="status"`, screen-reader label, no visible text). Tables take a
`loading` prop. None of that changes here — SWR just decides when `loading` is
true.

## Where we're going

Use [SWR](https://swr.vercel.app/) to do the fetching. We picked SWR over
TanStack Query because it's smaller and its conditional-key feature lines up
with how we gate on auth and workspace.

The key idea: a request key that's `null` means "not ready, don't fetch." So the
auth/workspace guard becomes part of the key instead of an `if`:

```ts
const key = token && workspaceId ? ["forms", workspaceId] : null;
const { data, isLoading } = useSWR(key, () => getSobaForms(token, workspaceId));
```

When `workspaceId` changes, the key changes, and SWR refetches on its own. That
removes the manual refetch effects.

## Plan

Do it one screen at a time. Each phase is shippable on its own.

### Phase B — set up SWR, migrate one screen

1. Add the `swr` dependency.
2. Wrap the app in `<SWRConfig>` (in `AppProviders`) with the default options we
   want (e.g. don't revalidate on window focus unless we decide to).
3. Write a small `useAuthedSWR` hook that reads the token and `activeWorkspaceId`
   from the store, builds the key (or `null`), and calls the API function. It
   returns SWR's `data`, `isLoading`, `isValidating`, `error`, and `mutate`.
4. Migrate `FormList` to it. Delete the `useEffect`, the `useState`, and the
   guard. Feed `isLoading` to the table's `loading` prop.
5. Update the `FormList` test to render inside an `<SWRConfig>` that resets the
   cache (see Testing below).

After this, FormList is the reference. The rest copy it.

### Phase C — migrate the other reads

One per change, same shape as FormList:

- `SubmissionList`
- `SubmissionView`
- `Header` (workspaces, current user)
- the designer's schema/version loads

Each migration deletes a `useEffect` and its guard. Workspace-switch refetch
effects go away because the key handles it.

### Phase D — writes and Redux cleanup

- Move the create/save/publish calls to `useSWRMutation`, and call `mutate` to
  refresh the affected list after a write.
- Once a slice is only holding fetched data, delete it. `currentUserSlice` and
  the list part of `workspaceSlice` are the candidates.
- Keep in Redux what's actually client state: the Keycloak token and auth flags,
  the selected `activeWorkspaceId`, and notifications.

### Phase E — optional

Add Next's `loading.tsx` files for route transitions, reusing `CenteredProgress`.
Only worth it if the route-change flash bothers us.

## How loading maps

| State                                                     | What the user sees                                |
| --------------------------------------------------------- | ------------------------------------------------- |
| `isLoading` (first load, no data yet)                     | `CenteredProgress` / table `loading`              |
| `isValidating` (background refresh, data already showing) | leave the data up; optionally a small inline hint |
| `error`                                                   | the existing inline alert / empty state           |

Don't show the full spinner on a background refresh — that's the point of
splitting `isLoading` from `isValidating`.

## Testing

SWR caches across renders, so tests need a fresh cache each time or they leak
into each other. Wrap the component under test:

```tsx
import { SWRConfig } from "swr";

render(
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <FormList />
  </SWRConfig>,
);
```

The fetch functions are already mocked the same way they are today, so the
assertions don't change much — you're just driving them through SWR.

## Notes

- These are client-side reads, same as now. SWR runs in the browser; there's no
  server-rendering change.
- Don't touch the Form.io engine. This is about how SOBA loads its own data.
- Token stays in Redux. The hook reads it for the key; SWR never owns auth.
