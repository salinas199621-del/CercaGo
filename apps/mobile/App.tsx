import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, StatusBar, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CustomerScreen } from "./src/screens/CustomerScreen";
import { StoreScreen } from "./src/screens/StoreScreen";
import { DriverScreen } from "./src/screens/DriverScreen";
import { Button } from "./src/components/UI";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { HomeSplash } from "./src/components/HomeSplash";
import { AppearanceProvider, useAppearance } from "./src/appearance";

const Stack = createNativeStackNavigator();
const CURRENT_APP_VERSION = "1.0.6";
const VERSION_MANIFEST_URL = "https://salinas199621-del.github.io/CercaGo/app-version.json";

function getVersionManifestUrl() {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return new URL("app-version.json", window.location.href).toString();
  }
  return VERSION_MANIFEST_URL;
}

type VersionManifest = { app_version?: unknown; update_url?: unknown };

function isNewerVersion(candidate: string, current: string) {
  const parse = (value: string) => value.split(".").map((part) => Number(part));
  const next = parse(candidate);
  const installed = parse(current);
  if ([...next, ...installed].some((part) => !Number.isInteger(part) || part < 0)) return false;
  for (let index = 0; index < Math.max(next.length, installed.length); index += 1) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference) return difference > 0;
  }
  return false;
}

function AdminNotice() {
  const { signOut } = useAuth();
  const { theme } = useAppearance();
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: theme.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: theme.ink }}>Administración web</Text>
      <Text style={{ color: theme.muted }}>Usa el panel web de CercaGo para gestionar la plataforma.</Text>
      <Button title="Cerrar sesión" onPress={() => void signOut()} />
    </View>
  );
}

function RootNavigator() {
  const { session, loading, signOut, exchangeRate, exchangeRateValueDate } = useAuth();
  const { theme } = useAppearance();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [startupSplashDone, setStartupSplashDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("cercago-onboarding-done")
      .then((value) => setOnboardingDone(value === "true"))
      .catch((error) => console.error("No se pudo cargar el onboarding", error))
      .finally(() => setOnboardingLoaded(true));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setStartupSplashDone(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    let active = true;
    async function checkVersion() {
      try {
        const response = await fetch(`${getVersionManifestUrl()}?check=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`El servicio de versiones respondió HTTP ${response.status}`);
        const manifest = await response.json() as VersionManifest;
        if (typeof manifest.app_version !== "string" || !isNewerVersion(manifest.app_version, CURRENT_APP_VERSION)) return;
        if (active) {
          setAvailableUpdate({
            version: manifest.app_version,
            url: typeof manifest.update_url === "string" ? manifest.update_url : "https://github.com/salinas199621-del/CercaGo/releases/latest/download/CercaGo.apk",
          });
        }
      } catch (error) {
        console.error("No se pudo comprobar si hay una actualización de CercaGo", error);
      }
    }
    void checkVersion();
    const timer = setInterval(() => { void checkVersion(); }, 30 * 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!session) {
      setSplashDone(false);
      return;
    }
    if (session.user.role !== "customer") {
      setSplashDone(true);
      return;
    }
    setSplashDone(false);
    const timer = setTimeout(() => setSplashDone(true), 1500);
    return () => clearTimeout(timer);
  }, [session?.user.id, session?.user.role]);
  async function completeOnboarding() {
    await AsyncStorage.setItem("cercago-onboarding-done", "true");
    setOnboardingDone(true);
  }
  if (availableUpdate) return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.primaryDark }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 22, gap: 14 }}>
          <Text style={{ color: theme.ink, fontSize: 21, fontWeight: "900" }}>¡Nueva actualización disponible de CercaGo!</Text>
          <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>Toca el botón para actualizar · versión {availableUpdate.version}</Text>
          {Platform.OS !== "web" && <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Android abrirá la descarga del APK. La instalación requiere confirmar la actualización del archivo; una app nativa no puede reemplazarse desde una página web.</Text>}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS === "web" && typeof window !== "undefined") {
                const updatedUrl = new URL(window.location.href);
                updatedUrl.searchParams.set("app_version", availableUpdate.version);
                window.location.replace(updatedUrl.toString());
                return;
              }
              void Linking.openURL(availableUpdate.url).catch((error: unknown) => {
                console.error("No se pudo abrir la descarga de la actualización", error);
                Alert.alert("No se pudo abrir la descarga", "Intenta de nuevo desde Chrome.");
              });
            }}
            style={{ minHeight: 48, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Actualizar ahora</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
  if (!startupSplashDone) return <HomeSplash />;
  if (loading || !onboardingLoaded) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.primary }}><ActivityIndicator size="large" color="#fff" /></View>;
  if (!session && !onboardingDone) return <OnboardingScreen exchangeRate={exchangeRate} exchangeRateValueDate={exchangeRateValueDate} onComplete={() => void completeOnboarding()} />;
  if (session?.user.role === "customer" && !splashDone) return <HomeSplash />;
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen name="Acceso" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen
            name="Inicio"
            component={session.user.role === "admin" ? AdminNotice : session.user.role === "store" ? StoreScreen : session.user.role === "driver" ? DriverScreen : CustomerScreen}
            options={{
              headerShown: session.user.role !== "customer",
              title: session.user.role === "store" ? "Tu comercio" : session.user.role === "driver" ? "Repartidor" : session.user.role === "admin" ? "Administración" : "CercaGo",
              headerTintColor: theme.ink,
              headerTitleStyle: { fontWeight: "900" },
              headerStyle: { backgroundColor: theme.background },
              headerShadowVisible: false,
              headerRight: () => <Button title="Salir" secondary onPress={() => void signOut()} />,
            }}
          />
        )}
      </Stack.Navigator>
      <StatusBar barStyle={theme.id === "dark" || session?.user.role === "customer" ? "light-content" : "dark-content"} />
    </NavigationContainer>
  );
}

export default function App() {
  return <AppearanceProvider><AuthProvider><RootNavigator /></AuthProvider></AppearanceProvider>;
}
