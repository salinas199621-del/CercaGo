import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Loading, styles } from "../components/UI";
import type { Order, Product } from "../types";
import { socket } from "./socketRef";

const nextOrderStatus: Record<string, string> = { placed: "accepted", accepted: "preparing", preparing: "ready" };

export function StoreScreen() {
  const { session } = useAuth();
  const token = session!.token;
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextOrders, nextProducts, store] = await Promise.all([
        api<Order[]>("/orders", token),
        api<Product[]>("/products/mine", token),
        api<{ name: string; address: string; description?: string; latitude?: number | null; longitude?: number | null }>("/stores/me", token),
      ]);
      setOrders(nextOrders);
      setProducts(nextProducts);
      setStoreName(store.name);
      setStoreAddress(store.address);
      setStoreDescription(store.description ?? "");
      setLatitude(store.latitude == null ? "" : String(store.latitude));
      setLongitude(store.longitude == null ? "" : String(store.longitude));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const update = () => { void refresh(); };
    socket?.on("order:new", update);
    socket?.on("order:status", update);
    return () => { socket?.off("order:new", update); socket?.off("order:status", update); };
  }, [refresh]);

  function resetForm() {
    setEditing(null); setName(""); setDescription(""); setPrice(""); setImageUrl("");
  }

  async function saveProduct() {
    const numericPrice = Number(price);
    if (!name.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) return setError("Ingresa nombre y precio válido.");
    try {
      const payload = { name, description, price: numericPrice, ...(imageUrl ? { imageUrl } : {}) };
      if (editing) await api(`/products/${editing}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/products", token, { method: "POST", body: JSON.stringify(payload) });
      resetForm();
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el producto"); }
  }

  async function changeOrder(order: Order, status: string) {
    try {
      await api(`/orders/${order.id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
      if (status === "ready") Alert.alert("Pedido listo", "Se notificó a los repartidores disponibles.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el pedido"); }
  }

  async function toggleStock(product: Product) {
    try {
      await api(`/products/${product.id}`, token, { method: "PATCH", body: JSON.stringify({ inStock: !product.in_stock }) });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el producto"); }
  }

  async function saveStoreProfile() {
    const hasLatitude = latitude.trim().length > 0;
    const hasLongitude = longitude.trim().length > 0;
    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    if (hasLatitude !== hasLongitude) return setError("Ingresa latitud y longitud, o deja ambos campos vacíos.");
    if (hasLatitude && (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue) ||
      latitudeValue < -90 || latitudeValue > 90 || longitudeValue < -180 || longitudeValue > 180)) {
      return setError("Las coordenadas no son válidas.");
    }
    try {
      await api("/stores/me", token, {
        method: "PATCH",
        body: JSON.stringify({
          name: storeName,
          address: storeAddress,
          description: storeDescription,
          latitude: hasLatitude ? latitudeValue : null,
          longitude: hasLongitude ? longitudeValue : null,
        }),
      });
      Alert.alert("Perfil actualizado", "Los cambios del comercio fueron guardados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el perfil"); }
  }

  async function deleteProduct(product: Product) {
    Alert.alert("Eliminar producto", `¿Eliminar ${product.name} del catálogo?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        void api(`/products/${product.id}`, token, { method: "DELETE" }).then(refresh).catch((reason) => setError(reason.message));
      } },
    ]);
  }

  if (loading) return <Loading />;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={{ backgroundColor: "#241E1B", borderRadius: 24, padding: 21, gap: 8, overflow: "hidden" }}>
        <Text style={{ color: "#FFC1AE", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>TU NEGOCIO, MÁS CERCA</Text>
        <Text style={{ color: "#fff", fontSize: 25, fontWeight: "900" }}>¡Hola, {storeName || "comercio"}! 👋</Text>
        <Text style={{ color: "#DDD6D1", fontSize: 13 }}>Hoy es un gran día para llegar a más vecinos.</Text>
        <View style={{ flexDirection: "row", gap: 9, marginTop: 7 }}>
          {[
            { value: String(orders.filter((order) => ["placed", "accepted", "preparing"].includes(order.status)).length), label: "PEDIDOS ACTIVOS" },
            { value: String(products.length), label: "PRODUCTOS" },
            { value: String(orders.filter((order) => order.status === "delivered").length), label: "ENTREGADOS" },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: "#FFFFFF18", borderRadius: 15, padding: 11 }}>
              <Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>{item.value}</Text>
              <Text style={{ color: "#D4CBC7", fontSize: 8, fontWeight: "800", marginTop: 3 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <Text style={styles.section}>Perfil del negocio</Text>
        <Field label="Nombre del negocio" value={storeName} onChangeText={setStoreName} />
        <Field label="Dirección" value={storeAddress} onChangeText={setStoreAddress} />
        <Field label="Descripción" value={storeDescription} onChangeText={setStoreDescription} multiline />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Latitud" value={latitude} onChangeText={setLatitude} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><Field label="Longitud" value={longitude} onChangeText={setLongitude} keyboardType="numeric" /></View>
        </View>
        <Text style={styles.subtitle}>Configura las coordenadas para recibir repartidores cercanos.</Text>
        <Button title="Guardar perfil" onPress={() => void saveStoreProfile()} />
      </Card>
      <Text style={styles.section}>Pedidos entrantes</Text>
      {!orders.length && <Text style={styles.subtitle}>No tienes pedidos todavía.</Text>}
      {orders.map((order) => (
        <Card key={order.id}>
          <View style={styles.row}>
            <Text style={{ color: "#191B22", fontWeight: "900", fontSize: 15 }}>Pedido #{order.id.slice(0, 8)}</Text>
            <Text style={{ color: order.status === "placed" ? "#D8482D" : "#6F7480", backgroundColor: order.status === "placed" ? "#FFF0EC" : "#F2F3F5", overflow: "hidden", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: "900" }}>{order.status.toUpperCase()}</Text>
          </View>
          <Text>{order.items?.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}</Text>
          <Text style={styles.subtitle}>Entrega: {order.delivery_address}</Text>
          <Text>Total: ${Number(order.total).toFixed(2)}</Text>
          {nextOrderStatus[order.status] && (
            <Button title={{ placed: "Aceptar pedido", accepted: "Comenzar preparación", preparing: "Marcar listo para retirar" }[order.status] ?? "Avanzar pedido"}
              onPress={() => void changeOrder(order, nextOrderStatus[order.status])} />
          )}
          {["placed", "accepted", "preparing"].includes(order.status) && (
            <Button title="Cancelar pedido" secondary onPress={() => void changeOrder(order, "cancelled")} />
          )}
        </Card>
      ))}
      <Text style={styles.section}>{editing ? "Editar producto" : "Agregar producto"}</Text>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <Field label="Descripción" value={description} onChangeText={setDescription} />
      <Field label="Precio" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Field label="URL de imagen (opcional)" value={imageUrl} onChangeText={setImageUrl} />
      <Button title={editing ? "Guardar cambios" : "Agregar al catálogo"} onPress={() => void saveProduct()} />
      {editing && <Button title="Cancelar edición" secondary onPress={resetForm} />}
      <Text style={styles.section}>Catálogo ({products.length})</Text>
      {products.map((product) => (
        <Card key={product.id}>
          <View style={styles.row}>
            <Text style={{ fontWeight: "700", flex: 1 }}>{product.name} · ${Number(product.price).toFixed(2)}</Text>
            <Text>{product.in_stock ? "En stock" : "Agotado"}</Text>
          </View>
          <View style={styles.row}>
            <Button title="Editar" secondary onPress={() => {
              setEditing(product.id); setName(product.name); setDescription(product.description ?? "");
              setPrice(String(product.price)); setImageUrl(product.image_url ?? "");
            }} />
            <Button title={product.in_stock ? "Marcar agotado" : "Reponer stock"} secondary onPress={() => void toggleStock(product)} />
            <Button title="Eliminar" secondary onPress={() => deleteProduct(product)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
