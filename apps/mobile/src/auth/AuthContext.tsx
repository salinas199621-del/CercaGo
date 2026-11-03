import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, connectSocket, disconnectSocket } from "../api";
import { setSocket, socket } from "../screens/socketRef";
import { setDemoRole } from "../demoApi";
import type { User } from "../types";

interface Session { user: User; token: string }
interface AuthValue {
  session: Session | null;
  loading: boolean;
  exchangeRate: number | null;
  exchangeRateValueDate: string | null;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(credential: string): Promise<void>;
  signUp(payload: Record<string, unknown>): Promise<void>;
  demoSignIn(role: "customer" | "store" | "driver"): Promise<void>;
  signOut(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateValueDate, setExchangeRateValueDate] = useState<string | null>(null);

  const refreshExchangeRate = useCallback(async (token?: string) => {
    try {
      const current = await api<{ rate: number; valueDate: string }>("/exchange-rate", token);
      if (Number.isFinite(current.rate) && current.rate > 0) {
        setExchangeRate(current.rate);
        setExchangeRateValueDate(current.valueDate);
      }
    } catch (error) {
      console.error("No se pudo cargar la tasa de cambio", error);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("cercago-session")
      .then((saved) => {
        if (!saved) {
          void refreshExchangeRate();
          return;
        }
        const value = JSON.parse(saved) as Session;
        setSession(value);
        if (value.token === "demo") {
          setDemoRole(value.user.role);
          void refreshExchangeRate(value.token);
        }
        else {
          setDemoRole(null);
          setSocket(connectSocket(value.token));
          void refreshExchangeRate(value.token);
        }
      })
      .catch((error) => console.error("No se pudo restaurar la sesión", error))
      .finally(() => setLoading(false));
    return () => disconnectSocket();
  }, [refreshExchangeRate]);

  useEffect(() => {
    const timer = setInterval(() => { void refreshExchangeRate(session?.token); }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [refreshExchangeRate, session?.token]);

  useEffect(() => {
    const updateRate = (value: { rate: number; valueDate: string }) => {
      if (Number.isFinite(value.rate) && value.rate > 0) {
        setExchangeRate(value.rate);
        setExchangeRateValueDate(value.valueDate);
      }
    };
    const currentSocket = socket;
    currentSocket?.on("exchange-rate:updated", updateRate);
    return () => { currentSocket?.off("exchange-rate:updated", updateRate); };
  }, [session]);

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
    await refreshExchangeRate(value.token);
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

  async function signInWithGoogle(credential: string) {
    await save(await api<Session>("/auth/google", undefined, {
      method: "POST",
      body: JSON.stringify({ credential }),
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

  const value = useMemo(() => ({ session, loading, exchangeRate, exchangeRateValueDate, signIn, signInWithGoogle, signUp, signOut, demoSignIn }), [session, loading, exchangeRate, exchangeRateValueDate]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
