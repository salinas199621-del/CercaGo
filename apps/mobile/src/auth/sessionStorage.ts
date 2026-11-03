import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";
import { Platform } from "react-native";

const sessionKey = "cercago-session";
const keychainService = "com.cercago.session";

export async function readSession(): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(sessionKey);
  const credentials = await Keychain.getGenericPassword({ service: keychainService });
  return credentials ? credentials.password : null;
}

export async function writeSession(value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(sessionKey, value);
    return;
  }
  const saved = await Keychain.setGenericPassword("session", value, {
    service: keychainService,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error("No se pudo guardar la sesión segura.");
}

export async function clearSession() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(sessionKey);
    return;
  }
  await Keychain.resetGenericPassword({ service: keychainService });
}

export async function migrateLegacySession(): Promise<string | null> {
  const current = await readSession();
  if (current) {
    if (Platform.OS !== "web") await AsyncStorage.removeItem(sessionKey);
    return current;
  }
  if (Platform.OS === "web") return null;

  const legacy = await AsyncStorage.getItem(sessionKey);
  if (!legacy) return null;
  await AsyncStorage.removeItem(sessionKey);
  try {
    const parsed = JSON.parse(legacy) as { token?: unknown };
    if (typeof parsed.token !== "string" || parsed.token === "demo") return null;
  } catch {
    return null;
  }
  await writeSession(legacy);
  return legacy;
}
