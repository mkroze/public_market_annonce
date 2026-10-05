import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "./types";
import { getMe } from "./api";
import { applyThemePreference, getStoredThemePreference } from "./theme";

interface AuthContextType {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  setAuth: () => {},
  updateUser: () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyThemePreference(getStoredThemePreference());
  }, []);

  useEffect(() => {
    if (token) {
      getMe()
        .then((loadedUser) => {
          setUser(loadedUser);
          applyThemePreference(loadedUser.theme || getStoredThemePreference());
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function setAuth(newToken: string, newUser: User) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    applyThemePreference(newUser.theme || getStoredThemePreference());
  }

  function updateUser(patch: Partial<User>) {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.theme) applyThemePreference(patch.theme);
      return next;
    });
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, setAuth, updateUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
