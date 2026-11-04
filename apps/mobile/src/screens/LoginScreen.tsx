import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useAppearance } from "../appearance";
import { Button, Field, styles } from "../components/UI";
import { CercaGoLogo } from "../components/CercaGoLogo";
import { AndroidDownloadLink } from "../components/AndroidDownloadLink";

type AccountRole = "customer" | "store" | "driver";

export function LoginScreen() {
  const { signIn, signUp, requestPasswordReset, resetPassword } = useAuth();
  const { theme } = useAppearance();
  const [registering, setRegistering] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [role, setRole] = useState<AccountRole>("customer");
  const [identityDocument, setIdentityDocument] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  async function submit() {
    setBusy(true);
    resetMessages();
    try {
      if (recovering) {
        const contact = identifier.trim();
        if (contact.includes("@")) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error("Escribe un correo electrónico válido.");
        } else {
          const digits = contact.replace(/\D/g, "");
          const national = digits.startsWith("58") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
          if (national.length !== 10) throw new Error("Escribe un correo válido o un teléfono venezolano con 10 dígitos.");
        }
        if (!resetRequested) {
          await requestPasswordReset(contact);
          setResetRequested(true);
          setSuccess("Si la cuenta existe, recibirás un código de recuperación en el correo o teléfono registrado.");
        } else {
          await resetPassword(contact, code.trim(), password);
          setRecovering(false);
          setResetRequested(false);
          setPassword("");
          setCode("");
          setSuccess("Contraseña actualizada. Ya puedes iniciar sesión.");
        }
      } else if (registering) {
        const email = identifier.trim().toLowerCase();
        if (!/^[^\s@]+@gmail\.com$/.test(email)) throw new Error("Regístrate con una dirección de correo @gmail.com.");
        if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
        const normalizedIdentityDocument = identityDocument.trim().toUpperCase();
        if (role === "driver" && !/^[VE]-?\d{5,9}$/.test(normalizedIdentityDocument)) {
          throw new Error("Escribe una cédula válida, por ejemplo V-12345678.");
        }
        const payload: Record<string, unknown> = {
          email,
          password,
          role,
        };
        if (role === "driver") payload.identityDocument = normalizedIdentityDocument;
        await signUp(payload);
      } else {
        await signIn(identifier.trim(), password);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo completar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: "login" | "register" | "recover") {
    setRegistering(next === "register");
    setRecovering(next === "recover");
    setResetRequested(false);
    setPassword("");
    setCode("");
    resetMessages();
  }

  const title = recovering
    ? resetRequested ? "Crea una nueva contraseña" : "Recupera tu cuenta"
    : registering ? "Únete a CercaGo" : "Qué bueno verte";

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "center", maxWidth: 520, paddingVertical: 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ backgroundColor: theme.primary, minHeight: 184, borderRadius: 28, padding: 22, justifyContent: "space-between", overflow: "hidden" }}>
        <CercaGoLogo style={{ width: 150, height: 43, borderRadius: 8, backgroundColor: "#fff" }} />
        <Text style={{ fontSize: 64, position: "absolute", right: 24, top: 24 }}>🛍️</Text>
        <View style={{ maxWidth: 310, gap: 7 }}>
          <Text style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "900" }}>
            {registering ? "Tu barrio te da la bienvenida." : recovering ? "Volvamos a encontrarnos." : "Todo lo bueno, más cerca."}
          </Text>
          <Text style={{ color: "#E8FFFC", fontSize: 13, lineHeight: 19 }}>Descubre, pide y apoya a los comercios de tu comunidad.</Text>
        </View>
      </View>

      {!registering && !recovering && <AndroidDownloadLink />}

      <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: theme.border, marginTop: 10 }}>
        <View style={{ gap: 4, marginBottom: 2 }}>
          <Text style={{ color: theme.ink, fontSize: 21, fontWeight: "900" }}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {recovering
              ? resetRequested ? "Escribe el código recibido y define una contraseña segura." : "Te enviaremos un código al correo o teléfono asociado a tu cuenta."
              : registering ? "Crea tu acceso con Gmail. Tu nombre y teléfono podrás agregarlos después en el perfil." : "Ingresa con tu correo o teléfono y contraseña."}
          </Text>
        </View>

        {registering && (
          <>
            <View style={{ gap: 5 }}>
              <Text style={styles.label}>Tipo de cuenta</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([
                  ["customer", "Cliente"],
                  ["store", "Comercio"],
                  ["driver", "Repartidor"],
                ] as const).map(([value, label]) => (
                  <Pressable key={value} accessibilityRole="button" onPress={() => setRole(value)} style={{
                    flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1,
                    borderColor: role === value ? theme.primary : theme.border,
                    backgroundColor: role === value ? theme.soft : theme.surface,
                    alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
                  }}>
                    <Text style={{ color: role === value ? theme.primaryDark : theme.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {role === "driver" && <>
              <Field
                label="Cédula de identidad"
                value={identityDocument}
                onChangeText={(value) => setIdentityDocument(value.toUpperCase().replace(/\s/g, ""))}
                placeholder="V-12345678"
              />
              <Text style={[styles.subtitle, { color: theme.muted }]}>La cédula identifica tu cuenta de repartidor y no se muestra a los clientes.</Text>
            </>}
          </>
        )}

        {!recovering && <Field
          label={registering ? "Correo Gmail" : "Correo o teléfono"}
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType={registering ? "email-address" : "default"}
          placeholder={registering ? "tunombre@gmail.com" : "tu@email.com o +58 412…"}
        />}
        {recovering && !resetRequested && <Field
          label="Correo o teléfono registrado"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="tu@email.com o +58 412…"
        />}
        {recovering && resetRequested && <Field label="Código de recuperación" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="numeric" placeholder="6 dígitos" />}
        {(!recovering || resetRequested) && <Field
          label={recovering ? "Nueva contraseña" : "Contraseña"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mínimo 10 caracteres"
        />}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={{ color: "#17633A", backgroundColor: "#EAF7EF", padding: 12, borderRadius: 12, lineHeight: 19 }}>{success}</Text> : null}
        <Button
          title={busy ? "Procesando…" : recovering ? resetRequested ? "Actualizar contraseña" : "Enviar código" : registering ? "Crear cuenta" : "Iniciar sesión"}
          onPress={() => void submit()}
          disabled={busy}
        />
        {recovering && resetRequested && <Button title="Enviar otro código" secondary onPress={() => { setResetRequested(false); setCode(""); setPassword(""); resetMessages(); }} />}
        <Button title={recovering ? "Volver al acceso" : registering ? "Ya tengo una cuenta" : "Crear cuenta nueva"} secondary onPress={() => changeMode(recovering ? "login" : registering ? "login" : "register")} />
        {!registering && !recovering && <Pressable accessibilityRole="button" onPress={() => changeMode("recover")} style={{ alignSelf: "center", padding: 8 }}>
          <Text style={{ color: theme.primaryDark, fontSize: 13, fontWeight: "800" }}>Olvidé mi contraseña</Text>
        </Pressable>}
        {registering && <Text style={[styles.subtitle, { color: theme.muted, fontSize: 12 }]}>
          {role === "store"
            ? "Después de crear la cuenta, completa el nombre y la ubicación del comercio. Requiere aprobación antes de aparecer."
            : role === "driver"
              ? "Tu cuenta de repartidor también podrá usar CercaGo en modo cliente."
              : "Tu cuenta se creará con el nombre genérico “Usuario CercaGo”; complétalo en tu perfil cuando quieras."}
        </Text>}
      </View>
    </ScrollView>
  );
}
