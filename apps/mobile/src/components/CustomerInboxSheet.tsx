import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { useAppearance } from "../appearance";
import { useAuth } from "../auth/AuthContext";
import { Button, styles } from "./UI";
import type { Order } from "../types";
import type { Promotion } from "../promotions";

type InboxTab = "orders" | "promotions" | "messages";
export type OrderNotice = {
  id: string;
  title: string;
  body: string;
  orderId: string;
  createdAt: string;
  read: boolean;
};
type Conversation = {
  order_id: string;
  order_status: string;
  store_name: string;
  last_message?: string | null;
  last_sender_id?: string | null;
  last_message_at?: string | null;
};

export function CustomerInboxSheet({ visible, initialTab, notifications, promotions, orders, onClose, onMarkRead, onOpenOrder, onOpenPromotion }: {
  visible: boolean;
  initialTab: InboxTab;
  notifications: OrderNotice[];
  promotions: Promotion[];
  orders: Order[];
  onClose: () => void;
  onMarkRead: () => void;
  onOpenOrder: (order: Order) => void;
  onOpenPromotion: (promotion: Promotion) => void;
}) {
  const { session } = useAuth();
  const { theme } = useAppearance();
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
    onMarkRead();
  }, [initialTab, onMarkRead, visible]);

  useEffect(() => {
    if (!visible || tab !== "messages" || !session) return;
    let active = true;
    setLoading(true);
    api<Conversation[]>("/messages", session.token)
      .then((items) => { if (active) { setConversations(items); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los mensajes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, tab, visible]);

  function openConversation(conversation: Conversation) {
    const order = orders.find((item) => item.id === conversation.order_id);
    if (!order) {
      setError("No se encontró el pedido de esta conversación. Actualiza la lista de pedidos e inténtalo de nuevo.");
      return;
    }
    onOpenOrder(order);
  }

  const tabButton = (value: InboxTab, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: tab === value }}
      onPress={() => setTab(value)}
      style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: tab === value ? theme.soft : "transparent" }}
    >
      <Text style={{ color: tab === value ? theme.primaryDark : theme.muted, fontWeight: "800", fontSize: 11 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar bandeja" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ width: "100%", maxWidth: 600, maxHeight: "84%", alignSelf: "center", backgroundColor: theme.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 }}>
          <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: theme.border, alignSelf: "center" }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[styles.title, { color: theme.ink }]}>Centro de actividad</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={8}><Text style={{ color: theme.muted, fontSize: 24 }}>×</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", padding: 4, borderRadius: 15, backgroundColor: theme.background }}>
            {tabButton("orders", "Estado de pedidos")}
            {tabButton("promotions", "Promociones")}
            {tabButton("messages", "Mensajes")}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            {tab === "orders" && <>
              {!notifications.length && <Text style={[styles.subtitle, { color: theme.muted, textAlign: "center", padding: 20 }]}>Aún no tienes novedades de pedidos.</Text>}
              {notifications.map((notice) => {
                const order = orders.find((item) => item.id === notice.orderId);
                return (
                  <View key={notice.id} style={{ padding: 14, borderRadius: 15, backgroundColor: theme.background, gap: 5 }}>
                    <Text style={{ color: theme.ink, fontWeight: "900" }}>{notice.title}</Text>
                    <Text style={[styles.subtitle, { color: theme.muted }]}>{notice.body}</Text>
                    <Text style={{ color: theme.muted, fontSize: 10 }}>{new Date(notice.createdAt).toLocaleString("es-VE")}</Text>
                    {order && <Pressable accessibilityRole="button" onPress={() => onOpenOrder(order)} style={{ alignSelf: "flex-start", paddingVertical: 5 }}>
                      <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "900" }}>Ver mi pedido</Text>
                    </Pressable>}
                  </View>
                );
              })}
            </>}
            {tab === "promotions" && <>
              {!promotions.length && <Text style={[styles.subtitle, { color: theme.muted, textAlign: "center", padding: 20 }]}>No hay promociones disponibles.</Text>}
              {promotions.map((promotion) => (
                <Pressable key={promotion.id} accessibilityRole="button" onPress={() => onOpenPromotion(promotion)} style={{ padding: 14, borderRadius: 15, backgroundColor: theme.background, gap: 5 }}>
                  <Text style={{ color: theme.primaryDark, fontSize: 10, fontWeight: "900" }}>{promotion.tag}</Text>
                  <Text style={{ color: theme.ink, fontWeight: "900", fontSize: 15 }}>{promotion.title}</Text>
                  <Text style={[styles.subtitle, { color: theme.muted }]}>{promotion.body}</Text>
                  <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "900", marginTop: 3 }}>Ver promoción  ›</Text>
                </Pressable>
              ))}
            </>}
            {tab === "messages" && <>
              {loading && <Text style={[styles.subtitle, { color: theme.muted }]}>Cargando conversaciones…</Text>}
              {!loading && !conversations.length && <Text style={[styles.subtitle, { color: theme.muted, textAlign: "center", padding: 20 }]}>Tus conversaciones de pedidos aparecerán aquí.</Text>}
              {conversations.map((conversation) => (
                <Pressable key={conversation.order_id} accessibilityRole="button" onPress={() => openConversation(conversation)} style={{ padding: 14, borderRadius: 15, backgroundColor: theme.background, gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: theme.ink, fontWeight: "900", flex: 1 }}>{conversation.store_name}</Text>
                    <Text style={{ color: theme.primaryDark, fontSize: 10, fontWeight: "900" }}>{conversation.order_status}</Text>
                  </View>
                  <Text numberOfLines={2} style={[styles.subtitle, { color: theme.muted }]}>{conversation.last_message || "Inicia una conversación sobre tu pedido."}</Text>
                  {conversation.last_message_at && <Text style={{ color: theme.muted, fontSize: 10 }}>{new Date(conversation.last_message_at).toLocaleString("es-VE")}</Text>}
                  <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "900" }}>Abrir chat  ›</Text>
                </Pressable>
              ))}
            </>}
          </ScrollView>
          <Button title="Cerrar" secondary onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
