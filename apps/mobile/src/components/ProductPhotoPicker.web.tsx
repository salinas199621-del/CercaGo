import React, { useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Camera, ImagePlus } from "lucide-react-native";
import { useAppearance } from "../appearance";

const maxPhotoDataUrlLength = 760_000;

export function ProductPhotoPicker({ value, disabled, onSelect }: {
  value: string;
  disabled: boolean;
  onSelect: (dataUrl: string) => void;
}) {
  const { theme } = useAppearance();
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");

  async function pickPhoto(file?: File) {
    if (!file) return;
    try {
      setError("");
      if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen.");
      if (file.size > 12 * 1024 * 1024) throw new Error("La foto no puede superar 12 MB.");
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new window.Image();
        image.src = objectUrl;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("No se pudo abrir la foto seleccionada."));
        });
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No se pudo procesar la foto.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.68);
        if (dataUrl.length > maxPhotoDataUrlLength) throw new Error("La foto procesada es muy grande. Elige otra imagen.");
        onSelect(dataUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo procesar la foto.");
    }
  }

  function fileInput(ref: React.RefObject<HTMLInputElement | null>, capture?: "environment") {
    return (
      <input
        ref={ref}
        type="file"
        accept="image/*"
        {...(capture ? { capture } : {})}
        aria-label={capture ? "Tomar foto del producto" : "Elegir foto del producto"}
        hidden
        onChange={(event) => {
          void pickPhoto(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => galleryRef.current?.click()}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.soft, opacity: disabled ? 0.55 : 1 }}
        >
          <ImagePlus size={17} color={theme.primaryDark} />
          <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>Elegir de mis fotos</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => cameraRef.current?.click()}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.soft, opacity: disabled ? 0.55 : 1 }}
        >
          <Camera size={17} color={theme.primaryDark} />
          <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>Tomar una foto</Text>
        </Pressable>
      </View>
      {fileInput(galleryRef)}
      {fileInput(cameraRef, "environment")}
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
