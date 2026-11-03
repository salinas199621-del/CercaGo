import React, { useRef } from "react";
import { Pressable, Text } from "react-native";

export function ReceiptPhotoPicker({ disabled, onSelect }: { disabled: boolean; value: string; onSelect: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
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
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo procesar la foto.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      if (dataUrl.length > 760_000) throw new Error("La imagen procesada supera el límite. Elige otra foto.");
      onSelect(dataUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <>
      <Pressable disabled={disabled} accessibilityRole="button" onPress={() => inputRef.current?.click()} style={{ alignSelf: "flex-start", opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ color: "#028090", fontWeight: "800", paddingVertical: 8 }}>Adjuntar foto del comprobante</Text>
      </Pressable>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Seleccionar foto del comprobante"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          void selectPhoto(file).catch((error: unknown) => window.alert(error instanceof Error ? error.message : "No se pudo procesar la foto."));
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}
