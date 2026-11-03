import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";

export function ProfilePhotoPicker({ onSelect }: { onSelect: (dataUrl: string) => void }) {
  const [error, setError] = useState("");

  async function pickPhoto(fromCamera: boolean) {
    try {
      setError("");
      const options = {
        mediaType: "photo",
        selectionLimit: 1,
        includeBase64: true,
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.7,
      } as const;
      const result = fromCamera ? await launchCamera(options) : await launchImageLibrary(options);
      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || "No se pudo abrir la galería.");
      const asset = result.assets?.[0];
      if (!asset?.base64) throw new Error("No se pudo leer la foto seleccionada.");
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      if (dataUrl.length > 420_000) throw new Error("La foto procesada es muy grande. Elige otra imagen.");
      onSelect(dataUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo seleccionar la foto.");
    }
  }

  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => void pickPhoto(false)} style={{ paddingVertical: 8 }}>
          <Text style={{ color: "#028090", fontWeight: "800" }}>Elegir de galería</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void pickPhoto(true)} style={{ paddingVertical: 8 }}>
          <Text style={{ color: "#028090", fontWeight: "800" }}>Tomar una foto</Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: "#B42318", fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
