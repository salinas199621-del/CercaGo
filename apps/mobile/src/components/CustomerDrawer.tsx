import React, { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CercaGoLogo } from "./CercaGoLogo";
import { Avatar } from "./Avatar";
import { useAppearance } from "../appearance";

type DrawerItem = "home" | "orders" | "cart" | "addresses" | "rate" | "settings";

const items: Array<{ id: DrawerItem; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Inicio" },
  { id: "orders", icon: "▤", label: "Mis pedidos" },
  { id: "cart", icon: "▱", label: "Mi bolsa" },
  { id: "addresses", icon: "⌖", label: "Mis direcciones" },
  { id: "rate", icon: "$", label: "Tasa BCV del día" },
  { id: "settings", icon: "⚙", label: "Ajustes" },
];

export function CustomerDrawer({ visible, name, email, avatar, onClose, onSelect, onProfile, onSignOut }: {
  visible: boolean;
  name: string;
  email: string;
  avatar?: string | null;
  onClose: () => void;
  onSelect: (item: DrawerItem) => void;
  onProfile: () => void;
  onSignOut: () => void;
}) {
  const { theme } = useAppearance();
  const { width } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const drawerWidth = Math.min(340, width * 0.86);

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 230, useNativeDriver: Platform.OS !== "web" }).start();
  }, [slide, visible]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#15192388" }}>
        <Animated.View style={{ width: drawerWidth, transform: [{ translateX }] }}>
          <SafeAreaView edges={["top", "bottom", "left"]} style={{ flex: 1, backgroundColor: theme.surface, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 17 }}>
              <CercaGoLogo style={{ width: 156, height: 48, borderRadius: 10, backgroundColor: "#fff" }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={onClose} hitSlop={10}>
                <Text style={{ color: "#667085", fontSize: 26 }}>×</Text>
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={onProfile} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 16, borderRadius: 18, backgroundColor: theme.soft }}>
              <Avatar value={avatar} name={name} size={48} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ color: theme.ink, fontSize: 15, fontWeight: "900" }}>{name}</Text>
                <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12 }}>{email}</Text>
                <Text style={{ color: theme.primaryDark, fontSize: 11, fontWeight: "800" }}>Ver mi perfil  ›</Text>
              </View>
            </Pressable>

            <View style={{ gap: 5 }}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 13, borderRadius: 14, backgroundColor: pressed ? theme.soft : "transparent" })}
                >
                  <Text style={{ width: 24, color: theme.primaryDark, fontSize: 21, fontWeight: "700", textAlign: "center" }}>{item.icon}</Text>
                  <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "700" }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={onSignOut} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 13, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 12 }}>
              <Text style={{ width: 24, color: "#D8482D", fontSize: 20, textAlign: "center" }}>↪</Text>
              <Text style={{ color: "#B93824", fontSize: 14, fontWeight: "800" }}>Cerrar sesión</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </Modal>
  );
}

export type { DrawerItem };
