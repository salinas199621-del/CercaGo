import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import type { GoogleSignInButtonProps } from "./GoogleSignInButton.types";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function GoogleSignInButton({ disabled = false, onCredential, onError }: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (webClientId) GoogleSignin.configure({ webClientId, offlineAccess: false });
  }, []);

  async function signIn() {
    if (!webClientId || disabled || busy) return;
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      if (!response.data.idToken) throw new Error("Google no entregó una credencial válida.");
      onCredential(response.data.idToken);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "SIGN_IN_CANCELLED") {
        onError(error instanceof Error ? error.message : "No se pudo conectar con Google.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!webClientId) {
    return (
      <View style={{ minHeight: 46, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12 }}>
        <Text style={{ color: "#777D89", fontWeight: "700" }}>Google aún no está configurado</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continuar con Google"
      disabled={disabled || busy}
      onPress={() => void signIn()}
      style={{ minHeight: 46, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#DADCE0", borderRadius: 12, backgroundColor: "#fff", opacity: disabled || busy ? 0.6 : 1 }}
    >
      <Text style={{ color: "#4285F4", fontSize: 18, fontWeight: "900" }}>G</Text>
      <Text style={{ color: "#3C4043", fontSize: 14, fontWeight: "700" }}>{busy ? "Conectando..." : "Continuar con Google"}</Text>
    </Pressable>
  );
}
