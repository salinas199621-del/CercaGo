import React from "react";
import { Alert, Linking, Platform, Pressable, Text } from "react-native";

export const ANDROID_APK_URL = "https://github.com/salinas199621-del/CercaGo/releases/latest/download/CercaGo.apk";

export function AndroidDownloadLink({ compact = false }: { compact?: boolean }) {
  if (Platform.OS !== "web") return null;

  async function openDownload() {
    try {
      await Linking.openURL(ANDROID_APK_URL);
    } catch (error) {
      console.error("No se pudo abrir la descarga de CercaGo", error);
      Alert.alert("No se pudo abrir la descarga", "Intenta de nuevo desde Chrome.");
    }
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Descargar CercaGo para Android"
      onPress={() => void openDownload()}
      style={{
        minHeight: compact ? 40 : 46,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        paddingHorizontal: 16,
        backgroundColor: compact ? "#E8F5F3" : "#00A896",
        borderWidth: compact ? 1 : 0,
        borderColor: "#BFE5E0",
      }}
    >
      <Text style={{ color: compact ? "#08766F" : "#fff", fontSize: 13, fontWeight: "900" }}>
        {compact ? "📲 Descargar app para Android" : "📲 Descargar CercaGo para Android"}
      </Text>
    </Pressable>
  );
}
