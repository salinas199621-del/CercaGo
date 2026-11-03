import React from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { Text, View } from "react-native";
import type { GoogleSignInButtonProps } from "./GoogleSignInButton.types";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function GoogleSignInButton({ disabled = false, onCredential, onError }: GoogleSignInButtonProps) {
  if (!webClientId) {
    return (
      <View style={{ minHeight: 46, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12 }}>
        <Text style={{ color: "#777D89", fontWeight: "700" }}>Google aún no está configurado</Text>
      </View>
    );
  }

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={{ alignItems: "center", opacity: disabled ? 0.6 : 1 }}>
      <GoogleOAuthProvider clientId={webClientId}>
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) onCredential(response.credential);
            else onError("Google no entregó una credencial válida.");
          }}
          onError={() => onError("No se pudo conectar con Google.")}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="320"
        />
      </GoogleOAuthProvider>
    </View>
  );
}
