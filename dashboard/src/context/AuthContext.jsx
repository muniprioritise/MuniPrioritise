/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';

const AUTH_STORAGE_KEY = 'supervisor_dashboard_auth';

const AuthContext = createContext(null);

function readInitialAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { token: '', user: null };
    }
    return JSON.parse(raw);
  } catch {
    return { token: '', user: null };
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readInitialAuth);

  const login = ({ token, user }) => {
    const nextState = { token, user };
    setAuthState(nextState);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
  };

  const logout = () => {
    setAuthState({ token: '', user: null });
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      token: authState.token,
      user: authState.user,
      isAuthenticated: Boolean(authState.token),
      login,
      logout,
    }),
    [authState.token, authState.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
