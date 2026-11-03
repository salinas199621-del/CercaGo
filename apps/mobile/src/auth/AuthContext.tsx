import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, connectSocket, disconnectSocket } from "../api";
import { setSocket, socket } from "../screens/socketRef";
import { clearSession, migrateLegacySession, writeSession } from "./sessionStorage";
import type { User } from "../types";

interface Session { user: User; token: string }
interface AuthValue {
  session: Session | null;
  loading: boolean;
  exchangeRate: number | null;
  exchangeRateValueDate: string | null;
  exchangeRateFallback: boolean;
  signIn(identifier: string, password: string): Promise<void>;
  signInWithGoogle(credential: string): Promise<void>;
  signUp(payload: Record<string, unknown>): Promise<void>;
  requestPasswordReset(identifier: string): Promise<void>;
  resetPassword(identifier: string, code: string, password: string): Promise<void>;
  updateProfile(name: string, email: string, phone: string | null): Promise<void>;
  signOut(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
const exchangeRateStorageKey = "cercago-bcv-last-official-rate";

type OfficialRatePayload = {
  moneda?: unknown;
  fuente?: unknown;
  promedio?: unknown;
  fechaActualizacion?: unknown;
};

async function fetchOfficialRate(): Promise<{ rate: number; valueDate: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`DolarAPI respondió HTTP ${response.status}`);
    const payload = await response.json() as OfficialRatePayload;
    const rate = Number(payload.promedio);
    const updatedAt = typeof payload.fechaActualizacion === "string" ? new Date(payload.fechaActualizacion) : null;
    if (payload.moneda !== "USD" || payload.fuente !== "oficial" || !Number.isFinite(rate) || rate <= 0 ||
      !updatedAt || !Number.isFinite(updatedAt.getTime())) {
      throw new Error("DolarAPI no devolvió una tasa oficial USD válida.");
    }
    return { rate, valueDate: updatedAt.toISOString().slice(0, 10) };
  } finally {
    clearTimeout(timeout);
  }
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateValueDate, setExchangeRateValueDate] = useState<string | null>(null);
  const [exchangeRateFallback, setExchangeRateFallback] = useState(false);

  const refreshExchangeRate = useCallback(async (token?: string) => {
    try {
      let current: { rate: number; valueDate: string };
      try {
        current = await fetchOfficialRate();
      } catch (publicApiError) {
        console.warn("No se pudo consultar DolarAPI; se intentará usar la tasa oficial del servidor.", publicApiError);
        const serverRate = await api<{ rate: number | null; valueDate: string | null }>("/exchange-rate", token);
        if (!Number.isFinite(serverRate.rate) || Number(serverRate.rate) <= 0 || !serverRate.valueDate) {
          throw new Error("El servidor no tiene una tasa oficial guardada.");
        }
        current = { rate: Number(serverRate.rate), valueDate: serverRate.valueDate };
      }
      if (Number.isFinite(current.rate) && current.rate > 0) {
        setExchangeRate(current.rate);
        setExchangeRateValueDate(current.valueDate);
        setExchangeRateFallback(false);
        try {
          await AsyncStorage.setItem(exchangeRateStorageKey, JSON.stringify(current));
        } catch (cacheError) {
          console.error("No se pudo guardar la última tasa BCV oficial", cacheError);
        }
      }
    } catch (error) {
      try {
        const cached = await AsyncStorage.getItem(exchangeRateStorageKey);
        if (cached) {
          const value = JSON.parse(cached) as { rate?: unknown; valueDate?: unknown };
          if (typeof value.rate === "number" && Number.isFinite(value.rate) && value.rate > 0 &&
            typeof value.valueDate === "string") {
            setExchangeRate(value.rate);
            setExchangeRateValueDate(value.valueDate);
            setExchangeRateFallback(true);
            return;
          }
        }
      } catch (cacheError) {
        console.error("No se pudo leer la última tasa BCV guardada", cacheError);
      }
      console.error("No se pudo cargar la tasa oficial desde DolarAPI, el servidor ni el almacenamiento local", error);
    }
  }, []);

  useEffect(() => {
    migrateLegacySession()
      .then(async (saved) => {
        if (!saved) {
          void refreshExchangeRate();
          return;
        }
        const value = JSON.parse(saved) as Session;
        if (value.token === "demo") {
          await clearSession();
          return;
        }
        setSession(value);
        setSocket(connectSocket(value.token));
        void refreshExchangeRate(value.token);
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
    await writeSession(JSON.stringify(value));
    setSession(value);
    setSocket(connectSocket(value.token));
    void refreshExchangeRate(value.token);
  }

  async function signIn(identifier: string, password: string) {
    await save(await api<Session>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
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

  async function requestPasswordReset(identifier: string) {
    await api("/auth/password-reset/request", undefined, {
      method: "POST",
      body: JSON.stringify({ identifier }),
    });
  }

  async function resetPassword(identifier: string, code: string, password: string) {
    await api("/auth/password-reset/confirm", undefined, {
      method: "POST",
      body: JSON.stringify({ identifier, code, password }),
    });
  }

  async function updateProfile(name: string, email: string, phone: string | null) {
    if (!session) throw new Error("Inicia sesión para editar tu perfil.");
    const user = (await api<{ user: User }>("/auth/me", session.token, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone }),
    })).user;
    const updated = { ...session, user };
    await writeSession(JSON.stringify(updated));
    setSession(updated);
  }

  async function signOut() {
    await clearSession();
    disconnectSocket();
    setSocket(null);
    setSession(null);
  }

  const value = useMemo(() => ({
    session, loading, exchangeRate, exchangeRateValueDate, exchangeRateFallback,
    signIn, signInWithGoogle, signUp, requestPasswordReset, resetPassword, updateProfile, signOut,
  }), [session, loading, exchangeRate, exchangeRateValueDate, exchangeRateFallback]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
