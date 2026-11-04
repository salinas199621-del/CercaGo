import React from "react";
import { Image, Text, View, type ViewStyle } from "react-native";

export const illustratedAvatars = [
  { id: "avatar:woman-warm", label: "Mujer, piel cálida", skin: "#C98254", hair: "#38231F", shirt: "#F07832", hairStyle: "long" },
  { id: "avatar:man-deep", label: "Hombre, piel oscura", skin: "#70442F", hair: "#171717", shirt: "#2457A6", hairStyle: "short" },
  { id: "avatar:woman-light", label: "Mujer, piel clara", skin: "#F0C6A7", hair: "#6E4732", shirt: "#7C3AED", hairStyle: "curly" },
  { id: "avatar:man-olive", label: "Hombre, piel oliva", skin: "#B9815D", hair: "#25211F", shirt: "#16865B", hairStyle: "short" },
  { id: "avatar:person-copper", label: "Persona, cabello cobrizo", skin: "#E6AB83", hair: "#A44B2C", shirt: "#DB2777", hairStyle: "curly" },
  { id: "avatar:woman-deep", label: "Mujer, piel oscura", skin: "#8C543A", hair: "#151515", shirt: "#0891B2", hairStyle: "long" },
  { id: "avatar:man-light", label: "Hombre, piel clara", skin: "#E8B994", hair: "#594132", shirt: "#CA8A04", hairStyle: "short" },
  { id: "avatar:person-rose", label: "Persona, piel rosada", skin: "#DDA58B", hair: "#38231F", shirt: "#DC2626", hairStyle: "long" },
] as const;

const avatarById = new Map(illustratedAvatars.map((avatar) => [avatar.id, avatar]));

export function Avatar({ value, name, size = 48, style }: {
  value?: string | null;
  name: string;
  size?: number;
  style?: ViewStyle;
}) {
  const isImage = value?.startsWith("data:image/");
  const illustration = value ? avatarById.get(value as typeof illustratedAvatars[number]["id"]) : undefined;
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2, backgroundColor: "#E7F7F5",
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    }, style]}>
      {isImage ? (
        <Image source={{ uri: value! }} accessibilityLabel={`Foto de ${name}`} style={{ width: size, height: size }} resizeMode="cover" />
      ) : illustration ? (
        <View accessibilityLabel={illustration.label} style={{ width: size, height: size, alignItems: "center", overflow: "hidden" }}>
          {illustration.hairStyle === "long" && <View style={{ position: "absolute", top: size * 0.19, width: size * 0.61, height: size * 0.56, borderTopLeftRadius: size * 0.3, borderTopRightRadius: size * 0.3, backgroundColor: illustration.hair }} />}
          <View style={{ position: "absolute", top: size * 0.2, width: size * 0.43, height: size * 0.47, borderRadius: size * 0.22, backgroundColor: illustration.skin }}>
            {illustration.hairStyle !== "long" && <View style={{ position: "absolute", top: -size * 0.04, left: -size * 0.015, right: -size * 0.015, height: size * (illustration.hairStyle === "curly" ? 0.2 : 0.13), borderRadius: size * 0.18, backgroundColor: illustration.hair }} />}
            <View style={{ position: "absolute", top: size * 0.24, left: size * 0.1, width: size * 0.04, height: size * 0.04, borderRadius: size, backgroundColor: "#36251F" }} />
            <View style={{ position: "absolute", top: size * 0.24, right: size * 0.1, width: size * 0.04, height: size * 0.04, borderRadius: size, backgroundColor: "#36251F" }} />
          </View>
          <View style={{ position: "absolute", bottom: -size * 0.2, width: size * 0.8, height: size * 0.46, borderTopLeftRadius: size * 0.4, borderTopRightRadius: size * 0.4, backgroundColor: illustration.shirt }} />
        </View>
      ) : (
        <Text style={{ color: "#028090", fontSize: value ? size * 0.53 : size * 0.42, fontWeight: "900" }}>
          {value || name.trim().charAt(0).toUpperCase() || "C"}
        </Text>
      )}
    </View>
  );
}
