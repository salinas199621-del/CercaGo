import React, { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, styles } from "./UI";
import type { Order, OrderMessage, Role } from "../types";
import { socket } from "../screens/socketRef";
import { getDemoMessagesStorageKey, isDemoMode, readDemoMessages } from "../demoApi";

const quickReplies = [
  "Pedido confirmado, esperando pago",
  "Datos de Pago Móvil enviados",
  "Pago recibido y verificado",
  "Pedido en preparación",
  "Pedido en camino",
];

export function OrderChatSheet({ order, role, onClose }: {
  order: Order | null;
  role: Role;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const token = session!.token;
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!order) return;
    try {
      setMessages(isDemoMode()
        ? readDemoMessages(order.id, true)
        : await api<OrderMessage[]>(`/orders/${order.id}/messages`, token));
      setError("");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el chat"); }
  }, [order, token]);

  useEffect(() => {
    if (!order) return;
    void refresh();
    const receive = (next: OrderMessage) => {
      if (next.order_id === order.id) setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
    };
    const syncDemoMessages = (event: StorageEvent) => {
      if (event.key === getDemoMessagesStorageKey()) setMessages(readDemoMessages(order.id, true));
    };
    socket?.on("order:message", receive);
    if (typeof window !== "undefined") window.addEventListener("storage", syncDemoMessages);
    const timer = setInterval(() => { void refresh(); }, 3000);
    return () => {
      clearInterval(timer);
      socket?.off("order:message", receive);
      if (typeof window !== "undefined") window.removeEventListener("storage", syncDemoMessages);
    };
  }, [order, refresh]);

  async function send(text = message) {
    if (!order || (!text.trim() && !reference.trim() && !attachmentUrl.trim())) return;
    setSending(true);
    setError("");
    try {
      const created = await api<OrderMessage>(`/orders/${order.id}/messages`, token, {
        method: "POST",
        body: JSON.stringify({
          message: text.trim(),
          ...(reference.trim() ? { paymentReference: reference.trim() } : {}),
          ...(attachmentUrl.trim() ? { attachmentUrl: attachmentUrl.trim() } : {}),
        }),
      });
      await refresh();
      setMessages((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
      setMessage("");
      setReference("");
      setAttachmentUrl("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar el mensaje"); }
    finally { setSending(false); }
  }

  return (
    <Modal visible={Boolean(order)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ width: "100%", maxWidth: 620, maxHeight: "90%", alignSelf: "center", backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 10 }}>
          <View style={styles.row}>
            <View>
              <Text style={styles.title}>Chat del pedido</Text>
              <Text style={styles.subtitle}>#{order?.id.slice(0, 8)} · {order?.store_name}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button"><Text style={{ color: "#777D89", fontSize: 24 }}>×</Text></Pressable>
          </View>
          {role === "customer" && order?.payment_bank && (
            <View style={{ backgroundColor: "#F0F8F3", borderRadius: 14, padding: 12, gap: 3 }}>
              <Text style={{ color: "#17633A", fontWeight: "900" }}>Datos de Pago Móvil del comercio</Text>
              <Text style={{ color: "#334155", fontSize: 13 }}>{order.payment_bank} · {order.payment_document} · {order.payment_phone}</Text>
              <Text style={{ color: "#667085", fontSize: 12 }}>Espera la confirmación de la tienda antes de transferir.</Text>
            </View>
          )}
          {isDemoMode() && (
            <View style={{ backgroundColor: "#FFF7E8", borderRadius: 12, padding: 10 }}>
              <Text style={{ color: "#7A4B00", fontSize: 11, lineHeight: 16 }}>
                Demo local: los mensajes se guardan en este navegador. Para chatear desde otro teléfono necesitas iniciar sesión con la API conectada.
              </Text>
            </View>
          )}
          {role === "store" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {quickReplies.map((reply) => (
                <Pressable key={reply} disabled={sending} onPress={() => void send(reply)} style={{ backgroundColor: "#FFF0EC", paddingHorizontal: 11, paddingVertical: 9, borderRadius: 16 }}>
                  <Text style={{ color: "#D8482D", fontSize: 11, fontWeight: "800" }}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <ScrollView style={{ minHeight: 130, maxHeight: 300, backgroundColor: "#F7F8FA", borderRadius: 16, padding: 10 }}>
            {!messages.length && <Text style={[styles.subtitle, { padding: 12, textAlign: "center" }]}>Aún no hay mensajes. Coordinen aquí el pago y la preparación.</Text>}
            {messages.map((item) => {
              const own = item.sender_id === session!.user.id;
              return (
                <View key={item.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "90%", backgroundColor: own ? "#FFF0EC" : "#fff", padding: 10, borderRadius: 13, marginVertical: 4 }}>
                  <Text style={{ fontSize: 10, color: "#777D89", fontWeight: "800" }}>{own ? "Tú" : item.sender_name}</Text>
                  {item.message ? <Text style={{ color: "#191B22", marginTop: 3 }}>{item.message}</Text> : null}
                  {item.payment_reference ? <Text style={{ color: "#17633A", fontWeight: "800", marginTop: 4 }}>Referencia: {item.payment_reference}</Text> : null}
                  {item.attachment_url ? <Pressable onPress={() => void Linking.openURL(item.attachment_url!)}><Text selectable style={{ color: "#1767A5", fontSize: 12, marginTop: 4 }}>Ver comprobante ↗</Text></Pressable> : null}
                  <Text style={{ color: "#9398A2", fontSize: 9, marginTop: 5 }}>{new Date(item.created_at).toLocaleString("es-VE")}</Text>
                </View>
              );
            })}
          </ScrollView>
          {role === "customer" && order?.status === "placed" && (
            <Text style={{ color: "#B54708", fontSize: 12, fontWeight: "700" }}>Espera la confirmación de la tienda antes de transferir. Después podrás enviar aquí el comprobante o su referencia.</Text>
          )}
          {role === "customer" && order && ["accepted", "preparing", "ready", "picked_up", "delivered"].includes(order.status) && <>
            <Text style={{ color: "#B54708", fontSize: 12, fontWeight: "700" }}>
              {order.status === "accepted" ? "Obligatorio para iniciar la preparación: envía el número de referencia o un enlace a la captura del comprobante." : "Puedes enviar el número de referencia o el enlace a la captura del comprobante."}
            </Text>
            <TextInput value={reference} onChangeText={setReference} placeholder="Número de referencia de Pago Móvil" style={{ minHeight: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12 }} />
            <TextInput value={attachmentUrl} onChangeText={setAttachmentUrl} placeholder="Enlace a la captura del comprobante" autoCapitalize="none" keyboardType="url" style={{ minHeight: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12 }} />
          </>}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput value={message} onChangeText={setMessage} placeholder="Escribe un mensaje…" multiline style={{ flex: 1, minHeight: 46, maxHeight: 90, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 }} />
            <Pressable disabled={sending || (role === "customer" && order?.status === "accepted" && !reference.trim() && !attachmentUrl.trim())} onPress={() => void send()} style={{ backgroundColor: "#F45B3C", borderRadius: 13, padding: 13, opacity: sending || (role === "customer" && order?.status === "accepted" && !reference.trim() && !attachmentUrl.trim()) ? 0.6 : 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>{sending ? "…" : "Enviar"}</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Cerrar chat" secondary onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
