// apps/mobile/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "../lib/api";

type User = { id: string; email: string; name?: string | null; created_at?: number };
type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const TOKEN_KEY = "tripstack_token";

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function setTokenPersist(next: string | null) {
    setToken(next);
    if (next) await SecureStore.setItemAsync(TOKEN_KEY, next);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  async function refreshMe() {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch("/api/me", { method: "GET", token });
      setUser(me?.user ?? null);
    } catch {
      // token invalid/expired
      await setTokenPersist(null);
      setUser(null);
    }
  }

  async function login(email: string, password: string) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setTokenPersist(data.token);
    setUser(data.user);
  }

  async function register(email: string, password: string, name?: string) {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    await setTokenPersist(data.token);
    setUser(data.user);
  }

  async function logout() {
    // best-effort revoke
    try {
      if (token) {
        await apiFetch("/api/auth/logout", { method: "POST", token });
      }
    } catch {}
    await setTokenPersist(null);
    setUser(null);
  }

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(saved);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  const value = useMemo<AuthState>(
    () => ({ token, user, loading, login, register, logout, refreshMe }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
