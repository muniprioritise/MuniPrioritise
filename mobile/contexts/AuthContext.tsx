import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import * as authService from "@/services/authService";
import * as notificationsService from "@/services/notificationsService";
import type { User } from "@/types/user";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PUSH_TOKEN_TIMEOUT_MS = 5000;

// A missing push token must never block sign-in (emulators, denied
// permission, no projectId). The backend takes it as an optional login field.
async function getPushTokenSafely(): Promise<string | undefined> {
  try {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), PUSH_TOKEN_TIMEOUT_MS)
    );

    const pushToken = await Promise.race([
      notificationsService.registerForPushNotifications(),
      timeout,
    ]);

    return pushToken ?? undefined;
  } catch (error) {
    console.warn("Push token registration failed; continuing without it.", error);
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const storedToken = await authService.getToken();
        const storedUser = await authService.getStoredUser();

        if (active && storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch (error) {
        console.error("Failed to restore session:", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      authService.subscribeToLogout(() => {
        setToken(null);
        setUser(null);
      }),
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    const pushToken = await getPushTokenSafely();

    const { token: newToken, user: newUser } = await authService.login(
      email,
      password,
      pushToken
    );

    setToken(newToken);
    setUser(newUser);

    return newUser;
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      await authService.register(fullName, email, password);
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => authService.logout(), []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}

