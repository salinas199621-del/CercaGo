import React from "react";
import { Image, Text, View, type ViewStyle } from "react-native";

export const illustratedAvatars = ["🦊", "🐼", "🐻", "🐱", "🐶", "🐸", "🦁", "🐰"];

export function Avatar({ value, name, size = 48, style }: {
  value?: string | null;
  name: string;
  size?: number;
  style?: ViewStyle;
}) {
  const isImage = value?.startsWith("data:image/");
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2, backgroundColor: "#E7F7F5",
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    }, style]}>
      {isImage ? (
        <Image source={{ uri: value! }} accessibilityLabel={`Foto de ${name}`} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ color: "#028090", fontSize: value ? size * 0.53 : size * 0.42, fontWeight: "900" }}>
          {value || name.trim().charAt(0).toUpperCase() || "C"}
        </Text>
      )}
    </View>
  );
}
