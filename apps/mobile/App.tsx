import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, DeviceEventEmitter, Image, Linking, Modal, NativeModules, Platform, Pressable, StatusBar, Text, View } from "react-native";
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
const CURRENT_APP_VERSION = "1.1.0";
const VERSION_MANIFEST_URL = "https://salinas199621-del.github.io/CercaGo/app-version.json";
const nativeUpdater = NativeModules.CercaGoUpdate as {
  installUpdate: (url: string, version: string) => Promise<void>;
} | undefined;

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
type UpdateProgress = {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  phase: "downloading" | "installing";
};

const initialUpdateProgress: UpdateProgress = {
  downloadedBytes: 0,
  totalBytes: 0,
  percent: -1,
  phase: "downloading",
};

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const { theme, darkMode } = useAppearance();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [startupSplashDone, setStartupSplashDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<{ version: string; url: string } | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress>(initialUpdateProgress);
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
  function startUpdate() {
    if (Platform.OS === "web" && typeof window !== "undefined" && availableUpdate) {
      const updatedUrl = new URL(window.location.href);
      updatedUrl.searchParams.set("app_version", availableUpdate.version);
      window.location.replace(updatedUrl.toString());
      return;
    }
    if (Platform.OS === "android" && availableUpdate) {
      if (!nativeUpdater) {
        Alert.alert("No se pudo iniciar la actualización", "CercaGo no tiene disponible el instalador integrado. Descarga el APK desde la página de CercaGo.");
        return;
      }
      setUpdateProgress(initialUpdateProgress);
      const progressSubscription = DeviceEventEmitter.addListener(
        "CercaGoUpdateProgress",
        (progress: UpdateProgress) => setUpdateProgress(progress),
      );
      setInstallingUpdate(true);
      void nativeUpdater.installUpdate(availableUpdate.url, availableUpdate.version)
        .catch((error: unknown) => {
          console.error("No se pudo descargar o iniciar la instalación de CercaGo", error);
          Alert.alert(
            "No se pudo continuar",
            error instanceof Error ? error.message : "Intenta de nuevo. Si Android te pide autorización, permite a CercaGo instalar aplicaciones y vuelve a la app.",
          );
        })
        .finally(() => {
          progressSubscription.remove();
          setInstallingUpdate(false);
          setUpdateProgress(initialUpdateProgress);
        });
      return;
    }
    if (availableUpdate) {
      void Linking.openURL(availableUpdate.url).catch((error: unknown) => {
        console.error("No se pudo abrir la descarga de la actualización", error);
        Alert.alert("No se pudo abrir la descarga", "Intenta de nuevo desde Chrome.");
      });
    }
  }
  if (availableUpdate) return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.primaryDark }}>
        <View style={{ alignItems: "center", backgroundColor: theme.surface, borderRadius: 24, padding: 22, gap: 14 }}>
          <Image
            source={require("./assets/cercago-wordmark.png")}
            accessibilityLabel="Logo de CercaGo"
            resizeMode="contain"
            style={{ width: 220, height: 110 }}
          />
          <Text style={{ color: theme.ink, fontSize: 21, fontWeight: "900" }}>¡Nueva actualización disponible de CercaGo!</Text>
          <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }}>Actualiza CercaGo a la versión {availableUpdate.version}.</Text>
          {Platform.OS === "android" && <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
            La descarga se realiza dentro de CercaGo. Si Android te lleva a Ajustes, activa «Permitir desde esta fuente» y vuelve a CercaGo. Después, confirma la instalación en la ventana de Android.
          </Text>}
          {installingUpdate && Platform.OS === "android" && <>
            <Text style={{ color: theme.ink, fontSize: 13, fontWeight: "700" }}>
              {updateProgress.phase === "installing"
                ? "Descarga completa. Abriendo el instalador de Android…"
                : updateProgress.percent >= 0
                  ? `Descargando actualización: ${updateProgress.percent}%`
                  : updateProgress.downloadedBytes > 0
                    ? `Descargando actualización: ${formatMegabytes(updateProgress.downloadedBytes)}`
                    : "Conectando para iniciar la descarga…"}
            </Text>
            <View
              accessibilityLabel={updateProgress.percent >= 0
                ? `Descarga de actualización: ${updateProgress.percent}%`
                : "Descargando actualización"}
              style={{ width: "100%", height: 8, overflow: "hidden", borderRadius: 8, backgroundColor: theme.background }}
            >
              <View style={{
                width: `${updateProgress.percent >= 0 ? updateProgress.percent : 0}%`,
                height: "100%",
                borderRadius: 8,
                backgroundColor: theme.primary,
              }} />
            </View>
            {updateProgress.percent < 0 && updateProgress.phase === "downloading" && <ActivityIndicator color={theme.primary} />}
          </>}
          <Pressable
            accessibilityRole="button"
            disabled={installingUpdate}
            onPress={startUpdate}
            style={{ width: "100%", minHeight: 48, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", opacity: installingUpdate ? 0.7 : 1 }}
          >
            {installingUpdate
              ? updateProgress.phase === "installing"
                ? <Text style={{ color: "#fff", fontWeight: "900" }}>Preparando instalación…</Text>
                : <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "900" }}>{Platform.OS === "android" ? "Descargar e instalar" : "Actualizar ahora"}</Text>}
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
      <StatusBar barStyle={session?.user.role === "customer"
        ? theme.headerText === "#FFFFFF" ? "light-content" : "dark-content"
        : darkMode ? "light-content" : "dark-content"} />
    </NavigationContainer>
  );
}

export default function App() {
  return <AppearanceProvider><AuthProvider><RootNavigator /></AuthProvider></AppearanceProvider>;
}
