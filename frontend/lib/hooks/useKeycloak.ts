import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  login,
  logout,
  refreshToken,
  initKeycloak,
  getKeycloakInstance,
  signInAfterRefusal,
} from '../slices/keycloakSlice';

export function useKeycloak() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.keycloak);

  const doLogin = useCallback((redirectUri?: string) => dispatch(login(redirectUri)), [dispatch]);
  const doSignInAfterRefusal = useCallback(
    (redirectUri: string) => dispatch(signInAfterRefusal(redirectUri)),
    [dispatch],
  );
  const doLogout = useCallback(() => dispatch(logout()), [dispatch]);
  const doRefresh = useCallback(() => dispatch(refreshToken()), [dispatch]);
  const doInit = useCallback(() => dispatch(initKeycloak()), [dispatch]);

  return {
    keycloak: getKeycloakInstance(),
    token: state.token,
    idTokenParsed: state.idTokenParsed,
    authenticated: state.authenticated,
    initializing: state.initializing,
    initStarted: state.initStarted,
    error: state.error,
    login: doLogin,
    signInAfterRefusal: doSignInAfterRefusal,
    logout: doLogout,
    refresh: doRefresh,
    init: doInit,
  };
}
