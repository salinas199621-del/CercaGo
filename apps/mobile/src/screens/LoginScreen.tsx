import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Button, Field, styles } from "../components/UI";
import { ExchangeRateBadge } from "../components/ExchangeRateBadge";

export function LoginScreen() {
  const { signIn, signUp, demoSignIn, exchangeRate, exchangeRateValueDate } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<"customer" | "store" | "driver">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enterDemo(demoRole: "customer" | "store" | "driver") {
    setBusy(true);
    setError("");
    try {
      await demoSignIn(demoRole);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir la demo");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (registering) {
        const payload: Record<string, unknown> = { name, email, password, role };
        if (role === "store") payload.store = { name: storeName, address: storeAddress };
        await signUp(payload);
      } else {
        await signIn(email, password);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "center", maxWidth: 520, paddingVertical: 36 }]}>
      <View style={{ backgroundColor: "#FFF0EC", height: 190, borderRadius: 28, padding: 22, justifyContent: "space-between", overflow: "hidden" }}>
        <Text style={{ color: "#D8482D", fontSize: 14, fontWeight: "900", letterSpacing: 2 }}>CERCAGO</Text>
        <Text style={{ fontSize: 65, position: "absolute", right: 24, top: 28 }}>🛍️</Text>
        <View style={{ maxWidth: 290, gap: 5 }}>
          <Text style={{ color: "#191B22", fontSize: 28, lineHeight: 33, fontWeight: "900" }}>{registering ? "Tu barrio te da la bienvenida" : "Todo lo bueno, más cerca."}</Text>
          <Text style={{ color: "#777D89", fontSize: 13 }}>Descubre, pide y apoya a los comercios de tu comunidad.</Text>
        </View>
        <View style={{ marginTop: 14 }}>
          <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} />
        </View>
      </View>
      {!registering && <>
        <View style={{ marginTop: 16, gap: 10 }}>
          <Text style={styles.section}>Explora la experiencia</Text>
          <Text style={styles.subtitle}>Elige un perfil para entrar con datos de ejemplo.</Text>
          <Button title="🏠   Entrar como cliente" onPress={() => void enterDemo("customer")} disabled={busy} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Comercio" secondary onPress={() => void enterDemo("store")} disabled={busy} /></View>
            <View style={{ flex: 1 }}><Button title="Repartidor" secondary onPress={() => void enterDemo("driver")} disabled={busy} /></View>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
          <Text style={styles.subtitle}>o usa tu cuenta</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
        </View>
      </>}
      {registering && <>
        <Field label="Nombre completo" value={name} onChangeText={setName} />
        <Text style={styles.section}>¿Cómo quieres usar CercaGo?</Text>
        <View style={styles.row}>
          <Button title="Cliente" secondary={role !== "customer"} onPress={() => setRole("customer")} />
          <Button title="Comercio" secondary={role !== "store"} onPress={() => setRole("store")} />
          <Button title="Repartidor" secondary={role !== "driver"} onPress={() => setRole("driver")} />
        </View>
        {role === "store" && <>
          <Field label="Nombre del comercio" value={storeName} onChangeText={setStoreName} />
          <Field label="Dirección del comercio" value={storeAddress} onChangeText={setStoreAddress} />
        </>}
      </>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ backgroundColor: "#fff", borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: "#EEF0F3", marginTop: 4 }}>
        <Text style={{ color: "#191B22", fontSize: 18, fontWeight: "900" }}>{registering ? "Crea tu cuenta" : "Inicia sesión"}</Text>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="tu@email.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 10 caracteres" />
        <Button title={busy ? "Procesando..." : registering ? "Crear cuenta" : "Continuar"} onPress={() => void submit()} disabled={busy} />
        <Button title={registering ? "Ya tengo una cuenta" : "Crear cuenta nueva"} secondary onPress={() => { setError(""); setRegistering(!registering); }} />
      </View>
      {registering && role === "store" && <Text style={styles.subtitle}>Los comercios nuevos requieren aprobación antes de aparecer en el marketplace.</Text>}
    </ScrollView>
  );
}
