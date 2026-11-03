import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";

export function ReceiptPhotoPicker({ disabled, value, onSelect }: { disabled: boolean; value: string; onSelect: (dataUrl: string) => void }) {
  const [error, setError] = useState("");

  async function pickPhoto() {
    try {
      setError("");
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
        includeBase64: true,
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.7,
      });
      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || "No se pudo abrir la galería.");
      const asset = result.assets?.[0];
      if (!asset?.base64) throw new Error("No se pudo leer la foto seleccionada.");
      const type = asset.type === "image/png" || asset.type === "image/webp" ? asset.type : "image/jpeg";
      const dataUrl = `data:${type};base64,${asset.base64}`;
      if (dataUrl.length > 760_000) throw new Error("La foto procesada supera el límite. Elige otra imagen.");
      onSelect(dataUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo seleccionar la foto.");
    }
  }

  return (
    <View style={{ gap: 5 }}>
      <Pressable disabled={disabled} accessibilityRole="button" onPress={() => void pickPhoto()} style={{ alignSelf: "flex-start", opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ color: "#028090", fontWeight: "800", paddingVertical: 8 }}>{value.startsWith("data:image/") ? "Cambiar foto del comprobante" : "Adjuntar foto del comprobante"}</Text>
      </Pressable>
      {value.startsWith("data:image/") && <Text style={{ color: "#667085", fontSize: 11 }}>Foto adjunta y lista para enviar.</Text>}
      <Text style={{ color: "#667085", fontSize: 11 }}>O pega un enlace público a la foto:</Text>
      <TextInput value={value.startsWith("data:image/") ? "" : value} editable={!disabled} onChangeText={onSelect} placeholder="https://…" autoCapitalize="none" keyboardType="url" style={{ minHeight: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12 }} />
      {error ? <Text style={{ color: "#B42318", fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
