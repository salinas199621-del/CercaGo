import React, { useRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppearance } from "../appearance";

export function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const { theme } = useAppearance();
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: Platform.OS !== "web", speed: 35, bounciness: 4 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 30, bounciness: 5 }).start()}
        style={[styles.button, {
          backgroundColor: secondary ? theme.soft : theme.primary,
          borderWidth: secondary ? 1 : 0,
          borderColor: secondary ? theme.border : "transparent",
        }, disabled && styles.disabled]}
      >
        <Text style={[styles.buttonText, { color: secondary ? theme.primaryDark : "#fff" }]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (text: string) => void; placeholder?: string;
  secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric" | "phone-pad"; multiline?: boolean;
}) {
  const { theme } = useAppearance();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink }, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        multiline={multiline}
      />
    </View>
  );
}

export function Card({ children }: React.PropsWithChildren) {
  const { theme } = useAppearance();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function Loading() {
  const { theme } = useAppearance();
  return <ActivityIndicator size="large" color={theme.primary} style={{ margin: 24 }} />;
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F8FA" },
  content: { padding: 20, gap: 14, paddingBottom: 42, width: "100%", maxWidth: 880, alignSelf: "center" },
  title: { color: "#191B22", fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: "#777D89", fontSize: 14, lineHeight: 20 },
  section: { color: "#191B22", fontSize: 19, fontWeight: "800", marginTop: 14, letterSpacing: -0.3 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 10,
    borderWidth: 1, borderColor: "#EEF0F3", shadowColor: "#151927",
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.055, shadowRadius: 14, elevation: 3,
  },
  button: { minHeight: 46, backgroundColor: "#00A896", justifyContent: "center", alignItems: "center", borderRadius: 14, paddingHorizontal: 16, marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "800", letterSpacing: 0.1 },
  secondary: { backgroundColor: "#E7F7F5", borderWidth: 1, borderColor: "#BFE5E0" },
  secondaryText: { color: "#028090" },
  disabled: { opacity: 0.55 },
  field: { gap: 5 },
  label: { color: "#414653", fontWeight: "700", fontSize: 13 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 13, backgroundColor: "#fff", minHeight: 48, paddingHorizontal: 14, color: "#191B22" },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  error: { color: "#B42318", backgroundColor: "#FFF0EF", padding: 12, borderRadius: 12 },
});
