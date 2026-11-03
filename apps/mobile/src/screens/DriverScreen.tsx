import React, { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import * as Location from "../location";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Loading, styles } from "../components/UI";
import { formatDualPrice } from "../currency";
import { ExchangeRateBadge } from "../components/ExchangeRateBadge";
import type { Order } from "../types";
import { socket } from "./socketRef";

interface AvailableDelivery extends Order {
  delivery_id: string;
  store_address: string;
  store_latitude?: number | null;
  store_longitude?: number | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
}

export function DriverScreen() {
  const { session, exchangeRate, exchangeRateValueDate } = useAuth();
  const token = session!.token;
  const [available, setAvailable] = useState<AvailableDelivery[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [deliveries, orders] = await Promise.all([
        api<AvailableDelivery[]>("/deliveries/available", token),
        api<Order[]>("/orders", token),
      ]);
      setAvailable(deliveries);
      setMine(orders.filter((order) => ["ready", "picked_up"].includes(order.status)));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las entregas");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    const reportLocation = (position: Location.LocationObject) => {
      void api("/drivers/location", token, {
        method: "POST",
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      }).then(() => refresh()).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo actualizar tu ubicación"));
    };
    async function watchLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Permite el acceso a la ubicación para ver entregas cercanas.");
        return;
      }
      reportLocation(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 100 },
        reportLocation,
        (reason) => setError(reason.message),
      );
      if (cancelled) subscription.remove();
    }
    void watchLocation().catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación"));
    return () => { cancelled = true; subscription?.remove(); };
  }, [token, refresh]);
  useEffect(() => {
    const update = () => { void refresh(); };
    socket?.on("delivery:available", update);
    return () => { socket?.off("delivery:available", update); };
  }, [refresh]);

  async function accept(delivery: AvailableDelivery) {
    try {
      await api(`/deliveries/${delivery.delivery_id}/accept`, token, { method: "POST" });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo aceptar la entrega"); }
  }

  async function updateStatus(order: Order, status: "picked_up" | "delivered") {
    if (!order.delivery_id) return;
    try {
      await api(`/deliveries/${order.delivery_id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar la entrega"); }
  }

  function openMap(destination: string) {
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
  }

  if (loading) return <Loading />;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={{ backgroundColor: "#F45B3C", borderRadius: 24, padding: 21, gap: 9 }}>
        <Text style={{ color: "#FFE6DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>CERCA DE TI, EN MOVIMIENTO</Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>¡Hola, {session!.user.name.split(" ")[0]}! 🛵</Text>
        <Text style={{ color: "#FFF4F0", fontSize: 13 }}>Tu próxima entrega está a unos minutos.</Text>
        <View style={{ flexDirection: "row", gap: 9, marginTop: 5 }}>
          {[{ value: String(mine.length), label: "EN CURSO" }, { value: String(available.length), label: "CERCA DE TI" }].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: "#FFFFFF25", borderRadius: 15, padding: 12 }}>
              <Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>{item.value}</Text>
              <Text style={{ color: "#FFE6DC", fontSize: 9, fontWeight: "800", marginTop: 3 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} />
      <Text style={styles.subtitle}>Las ofertas se actualizan con tu ubicación.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.section}>Mis entregas</Text>
      {mine.map((order) => (
        <Card key={order.id}>
          <View style={styles.row}><Text style={{ color: "#191B22", fontWeight: "900", fontSize: 16 }}>{order.store_name}</Text><Text style={{ color: "#D8482D", fontWeight: "900", fontSize: 11 }}>{order.status.toUpperCase()}</Text></View>
          <Text>Cliente: {order.delivery_address}</Text>
          <Button title="Ruta al comercio" secondary onPress={() => openMap(order.store_address ?? order.store_name ?? "")} />
          {order.status === "ready" && <Button title="Confirmar retiro" onPress={() => void updateStatus(order, "picked_up")} />}
          {order.status === "picked_up" && <>
            <Button title="Ruta al cliente" secondary onPress={() => openMap(order.delivery_address)} />
            <Button title="Confirmar entrega" onPress={() => void updateStatus(order, "delivered")} />
          </>}
        </Card>
      ))}
      {!mine.length && <Text style={styles.subtitle}>Aún no tienes entregas asignadas.</Text>}
      <Text style={styles.section}>Disponibles</Text>
      {available.map((delivery) => (
        <Card key={delivery.delivery_id}>
          <Text style={{ fontWeight: "700" }}>{delivery.store_name} · {formatDualPrice(delivery.total, delivery.exchange_rate ?? exchangeRate)}</Text>
          <Text style={styles.subtitle}>Retiro: {delivery.store_address}</Text>
          <Text style={styles.subtitle}>Entrega: {delivery.delivery_address}</Text>
          <Button title="Ver ruta al comercio" secondary onPress={() => openMap(delivery.store_address)} />
          <Button title="Aceptar entrega" onPress={() => void accept(delivery)} />
        </Card>
      ))}
      {!available.length && <Text style={styles.subtitle}>No hay pedidos listos cerca en este momento.</Text>}
    </ScrollView>
  );
}
