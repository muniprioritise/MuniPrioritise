import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import * as authService from "@/services/authService";
import * as notificationsService from "@/services/notificationsService";
import type { User } from "@/types/user";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await authService.getToken();
      const storedUser = await authService.getStoredUser();
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
      setIsLoading(false);
    })();
  }, []);

  const registerPushToken = useCallback(async () => {
    const pushToken = await notificationsService.registerForPushNotifications();
    if (pushToken) await notificationsService.savePushTokenToBackend(pushToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await authService.login(email, password);
    await authService.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    await registerPushToken();
  }, [registerPushToken]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { token: newToken, user: newUser } = await authService.register(name, email, password);
    await authService.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    await registerPushToken();
  }, [registerPushToken]);

  const logout = useCallback(async () => {
    await authService.clearSession();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}