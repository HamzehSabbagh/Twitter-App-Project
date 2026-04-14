import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { unregisterStoredPushToken } from "@/lib/push-notifications";

type AuthUser = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  picture_url?: string | null;
  cover_url?: string | null;
  role?: {
    id: number;
    name: string;
  };
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  birth_date: string;
  password: string;
  password_confirmation: string;
};

type RegisterResponse = {
  message: string;
  email: string;
  requires_verification: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  updateUser: (nextUser: Partial<AuthUser>) => Promise<void>;
  resendVerification: (email: string) => Promise<{ message: string }>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreAuth() {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      setToken(storedToken);
      setUser(storedUser ? JSON.parse(storedUser) : null);
      setLoading(false);
    }

    restoreAuth();
  }, []);

  async function persistAuth(nextToken: string, nextUser: AuthUser) {
    setToken(nextToken);
    setUser(nextUser);

    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, nextToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)),
    ]);
  }

  async function clearAuth() {
    setToken(null);
    setUser(null);

    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  }

  async function updateUser(nextUser: Partial<AuthUser>) {
    if (!user) {
      return;
    }

    const mergedUser = { ...user, ...nextUser };
    setUser(mergedUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(mergedUser));
  }

  async function signIn(payload: LoginPayload) {
    const response = await apiFetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse<{ token: string; user: AuthUser }>(response);
    await persistAuth(data.token, data.user);
  }

  async function signUp(payload: RegisterPayload) {
    const response = await apiFetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse<RegisterResponse>(response);
  }

  async function resendVerification(email: string) {
    const response = await apiFetch(`${API_BASE_URL}/email/verification-notification`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    return parseJsonResponse<{ message: string }>(response);
  }

  async function signOut() {
    if (token) {
      try {
        await unregisterStoredPushToken(token);
        await apiFetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.log(error);
      }
    }

    await clearAuth();
  }

  async function authFetch(input: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {});
    headers.set("Accept", "application/json");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return apiFetch(input, {
      ...init,
      headers,
    });
  }

  const value = useMemo(
    () => ({ token, user, loading, signIn, signUp, signOut, updateUser, authFetch, resendVerification }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
