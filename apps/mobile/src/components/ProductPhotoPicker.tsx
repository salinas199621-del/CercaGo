import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Camera, ImagePlus } from "lucide-react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useAppearance } from "../appearance";

const maxPhotoDataUrlLength = 760_000;

export function ProductPhotoPicker({ value, disabled, onSelect }: {
  value: string;
  disabled: boolean;
  onSelect: (dataUrl: string) => void;
}) {
  const { theme } = useAppearance();
  const [error, setError] = useState("");

  async function pickPhoto(fromCamera: boolean) {
    try {
      setError("");
      const options = {
        mediaType: "photo",
        selectionLimit: 1,
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
      } as const;
      const result = fromCamera ? await launchCamera(options) : await launchImageLibrary(options);
      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || "No se pudo abrir la cámara o galería.");
      const asset = result.assets?.[0];
      if (!asset?.base64) throw new Error("No se pudo leer la foto seleccionada.");
      const mimeType = asset.type === "image/png" || asset.type === "image/webp" ? asset.type : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      if (dataUrl.length > maxPhotoDataUrlLength) throw new Error("La foto procesada es muy grande. Elige otra imagen.");
      onSelect(dataUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo seleccionar la foto.");
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => void pickPhoto(false)}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.soft, opacity: disabled ? 0.55 : 1 }}
        >
          <ImagePlus size={17} color={theme.primaryDark} />
          <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>Elegir de mis fotos</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => void pickPhoto(true)}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.soft, opacity: disabled ? 0.55 : 1 }}
        >
          <Camera size={17} color={theme.primaryDark} />
          <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>Tomar una foto</Text>
        </Pressable>
      </View>
      {value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 9, borderRadius: 14, backgroundColor: theme.background }}>
          <Image source={{ uri: value }} resizeMode="cover" style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: theme.soft }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.ink, fontSize: 12, fontWeight: "800" }}>Foto del producto</Text>
            <Text style={{ color: theme.muted, fontSize: 11 }}>Lista para guardar en el catálogo</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onSelect("")} hitSlop={8}>
            <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>Quitar</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>Opcional. Puedes elegir una imagen de tu galería o tomarla ahora.</Text>
      )}
      {error ? <Text style={{ color: "#B42318", fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
