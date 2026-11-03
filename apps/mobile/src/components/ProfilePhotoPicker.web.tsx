import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

export function ProfilePhotoPicker({ onSelect }: { onSelect: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
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
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No se pudo procesar la foto.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        if (dataUrl.length > 420_000) throw new Error("La foto procesada es muy grande. Elige otra imagen.");
        onSelect(dataUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo procesar la foto.");
    }
  }

  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => inputRef.current?.click()} style={{ paddingVertical: 8 }}>
          <Text style={{ color: "#028090", fontWeight: "800" }}>Elegir de galería</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => cameraRef.current?.click()} style={{ paddingVertical: 8 }}>
          <Text style={{ color: "#028090", fontWeight: "800" }}>Tomar una foto</Text>
        </Pressable>
      </View>
      <input ref={inputRef} type="file" accept="image/*" aria-label="Elegir foto de perfil" hidden onChange={(event) => {
        void pickPhoto(event.currentTarget.files?.[0]);
        event.currentTarget.value = "";
      }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" aria-label="Tomar foto de perfil" hidden onChange={(event) => {
        void pickPhoto(event.currentTarget.files?.[0]);
        event.currentTarget.value = "";
      }} />
      {error ? <Text style={{ color: "#B42318", fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
