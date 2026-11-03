import AsyncStorage from "@react-native-async-storage/async-storage";

const sessionKey = "cercago-session";

export async function readSession() {
  return AsyncStorage.getItem(sessionKey);
}

export async function writeSession(value: string) {
  await AsyncStorage.setItem(sessionKey, value);
}

export async function clearSession() {
  await AsyncStorage.removeItem(sessionKey);
}

export async function migrateLegacySession() {
  return readSession();
}
