import React, { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, Text, View } from "react-native";
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

const Stack = createNativeStackNavigator();

function AdminNotice() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Administración web</Text>
      <Text>Usa el panel web de CercaGo para gestionar la plataforma.</Text>
      <Button title="Cerrar sesión" onPress={() => void signOut()} />
    </View>
  );
}

function RootNavigator() {
  const { session, loading, signOut, exchangeRate, exchangeRateValueDate } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("cercago-onboarding-done")
      .then((value) => setOnboardingDone(value === "true"))
      .catch((error) => console.error("No se pudo cargar el onboarding", error))
      .finally(() => setOnboardingLoaded(true));
  }, []);
  async function completeOnboarding() {
    await AsyncStorage.setItem("cercago-onboarding-done", "true");
    setOnboardingDone(true);
  }
  if (loading || !onboardingLoaded) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator size="large" color="#F45B3C" /></View>;
  if (!session && !onboardingDone) return <OnboardingScreen exchangeRate={exchangeRate} exchangeRateValueDate={exchangeRateValueDate} onComplete={() => void completeOnboarding()} />;
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
              headerTintColor: "#191B22",
              headerTitleStyle: { fontWeight: "900" },
              headerStyle: { backgroundColor: "#F7F8FA" },
              headerShadowVisible: false,
              headerRight: () => <Button title="Salir" secondary onPress={() => void signOut()} />,
            }}
          />
        )}
      </Stack.Navigator>
      <StatusBar barStyle={session?.user.role === "customer" ? "light-content" : "dark-content"} />
    </NavigationContainer>
  );
}

export default function App() {
  return <AuthProvider><RootNavigator /></AuthProvider>;
}
