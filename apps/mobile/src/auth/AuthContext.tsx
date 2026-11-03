import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, connectSocket, disconnectSocket } from "../api";
import { setSocket } from "../screens/socketRef";
import { setDemoRole } from "../demoApi";
import type { User } from "../types";

interface Session { user: User; token: string }
interface AuthValue {
  session: Session | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(payload: Record<string, unknown>): Promise<void>;
  demoSignIn(role: "customer" | "store" | "driver"): Promise<void>;
  signOut(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("cercago-session")
      .then((saved) => {
        if (!saved) return;
        const value = JSON.parse(saved) as Session;
        setSession(value);
        if (value.token === "demo") setDemoRole(value.user.role);
        else {
          setDemoRole(null);
          setSocket(connectSocket(value.token));
        }
      })
      .catch((error) => console.error("No se pudo restaurar la sesión", error))
      .finally(() => setLoading(false));
    return () => disconnectSocket();
  }, []);

  async function save(value: Session) {
    await AsyncStorage.setItem("cercago-session", JSON.stringify(value));
    setSession(value);
    if (value.token === "demo") {
      setDemoRole(value.user.role);
      disconnectSocket();
      setSocket(null);
    } else {
      setDemoRole(null);
      setSocket(connectSocket(value.token));
    }
  }

  async function demoSignIn(role: "customer" | "store" | "driver") {
    const names = { customer: "Alex Demo", store: "Café de la Esquina", driver: "Sam Repartidor" };
    await save({
      token: "demo",
      user: { id: `demo-${role}`, name: names[role], email: `${role}@demo.cercago.local`, role },
    });
  }

  async function signIn(email: string, password: string) {
    await save(await api<Session>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }));
  }

  async function signUp(payload: Record<string, unknown>) {
    await save(await api<Session>("/auth/register", undefined, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  }

  async function signOut() {
    await AsyncStorage.removeItem("cercago-session");
    setDemoRole(null);
    disconnectSocket();
    setSocket(null);
    setSession(null);
  }

  const value = useMemo(() => ({ session, loading, signIn, signUp, signOut, demoSignIn }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
