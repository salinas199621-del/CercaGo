import React, { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleDollarSign, House, ListChecks, LogOut, MapPin, MessageCircle, Settings, ShoppingBag, type LucideIcon } from "lucide-react-native";
import { CercaGoLogo } from "./CercaGoLogo";
import { Avatar } from "./Avatar";
import { useAppearance } from "../appearance";

type DrawerItem = "home" | "orders" | "cart" | "addresses" | "messages" | "rate" | "settings";

const items: Array<{ id: DrawerItem; icon: LucideIcon; label: string; color: string }> = [
  { id: "home", icon: House, label: "Inicio", color: "#0B9B89" },
  { id: "orders", icon: ListChecks, label: "Mis pedidos", color: "#6A7B93" },
  { id: "cart", icon: ShoppingBag, label: "Mi bolsa", color: "#F08A37" },
  { id: "addresses", icon: MapPin, label: "Mis direcciones", color: "#E85E49" },
  { id: "messages", icon: MessageCircle, label: "Mis mensajes", color: "#7957C8" },
  { id: "rate", icon: CircleDollarSign, label: "Tasa BCV del día", color: "#20986A" },
  { id: "settings", icon: Settings, label: "Ajustes", color: "#607185" },
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
                  <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${item.color}18` }}>
                    <item.icon size={19} color={item.color} strokeWidth={2.2} />
                  </View>
                  <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "700" }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={onSignOut} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 13, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 12 }}>
              <LogOut size={20} color="#D8482D" strokeWidth={2.2} />
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
