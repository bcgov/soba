import React, { act } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import type makeStore from '@/lib/store';
import { initKeycloak } from '@/lib/slices/keycloakSlice';

type Store = ReturnType<typeof makeStore>;

export async function renderInStore(store: Store, ui: React.ReactElement) {
  await act(async () => {
    render(<Provider store={store}>{ui}</Provider>);
  });
}

// Keycloak never runs in tests, so the init lifecycle is driven directly.
export async function answerInit(
  store: Store,
  payload: { authenticated: boolean; token?: string },
) {
  await act(async () => {
    store.dispatch({ type: initKeycloak.pending.type });
  });
  await act(async () => {
    store.dispatch({ type: initKeycloak.fulfilled.type, payload });
  });
}
