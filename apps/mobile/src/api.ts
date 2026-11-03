import { io, Socket } from "socket.io-client";
import { Platform } from "react-native";
import { demoApi, isDemoMode } from "./demoApi";

const defaultApiHost = Platform.OS === "web" && typeof window !== "undefined"
  ? window.location.hostname
  : Platform.OS === "android" ? "10.0.2.2" : "localhost";
const defaultApiUrl = `http://${defaultApiHost}:4000/api`;
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;
const BASE_URL = API_URL.replace(/\/api\/?$/, "");
let socket: Socket | null = null;

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const isPublicExchangeRate = path === "/exchange-rate" && (init.method ?? "GET").toUpperCase() === "GET";
  const isUnconfiguredHostedWeb = Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    !process.env.EXPO_PUBLIC_API_URL;
  if (isPublicExchangeRate && isUnconfiguredHostedWeb) {
    return demoApi<T>(path, init);
  }
  if (!isPublicExchangeRate && (token === "demo" || isDemoMode())) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    return demoApi<T>(path, init);
  }
  if (isUnconfiguredHostedWeb) {
    throw new Error("La API de CercaGo aún no está configurada para esta web.");
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Error de solicitud (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function connectSocket(token: string) {
  socket?.disconnect();
  socket = io(BASE_URL, { auth: { token }, transports: ["websocket"] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
