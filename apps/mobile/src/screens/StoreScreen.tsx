import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Loading, styles } from "../components/UI";
import { OrderChatSheet } from "../components/OrderChatSheet";
import { formatDualPrice } from "../currency";
import { LocationPickerMap, type LocationCoordinates } from "../components/LocationPickerMap";
import { ProductPhotoPicker } from "../components/ProductPhotoPicker";
import * as Location from "../location";
import { useAppearance } from "../appearance";
import type { Order, Product } from "../types";
import { socket } from "./socketRef";

type StoreCoupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string | number;
  usage_limit: number | null;
  used_count: number;
  required_completed_orders: number;
  active: boolean;
};

const defaultStoreMapCenter: LocationCoordinates = { latitude: 10.245, longitude: -67.595 };

export function StoreScreen() {
  const { session, exchangeRate } = useAuth();
  const { theme } = useAppearance();
  const token = session!.token;
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [locatingStore, setLocatingStore] = useState(false);
  const [resolvingStoreAddress, setResolvingStoreAddress] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates | null>(null);
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [paymentBank, setPaymentBank] = useState("");
  const [paymentDocument, setPaymentDocument] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"percent" | "fixed">("percent");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [couponUsageLimit, setCouponUsageLimit] = useState("");
  const [couponRequiredOrders, setCouponRequiredOrders] = useState("0");
  const addressLookupSequence = useRef(0);

  const refresh = useCallback(async () => {
    const [ordersResult, productsResult, storeResult, couponsResult] = await Promise.allSettled([
      api<Order[]>("/orders", token),
      api<Product[]>("/products/mine", token),
      api<{
        name: string;
        address: string;
        description?: string;
        latitude?: number | string | null;
        longitude?: number | string | null;
        has_own_delivery?: boolean;
        free_delivery?: boolean;
        payment_bank?: string | null;
        payment_document?: string | null;
        payment_phone?: string | null;
      }>("/stores/me", token),
      api<StoreCoupon[]>("/store/coupons", token),
    ]);
    const failures: string[] = [];
    if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
    else failures.push(ordersResult.reason instanceof Error ? ordersResult.reason.message : "No se pudieron cargar los pedidos.");
    if (productsResult.status === "fulfilled") setProducts(productsResult.value);
    else failures.push(productsResult.reason instanceof Error ? productsResult.reason.message : "No se pudo cargar el catálogo.");
    if (storeResult.status === "fulfilled") {
      const store = storeResult.value;
      setStoreName(store.name);
      setStoreAddress(store.address);
      setStoreDescription(store.description ?? "");
      const latitude = store.latitude == null ? null : Number(store.latitude);
      const longitude = store.longitude == null ? null : Number(store.longitude);
      setLocationCoordinates(latitude !== null && longitude !== null ? { latitude, longitude } : null);
      setHasOwnDelivery(Boolean(store.has_own_delivery));
      setFreeDelivery(Boolean(store.free_delivery));
      setPaymentBank(store.payment_bank ?? "");
      setPaymentDocument(store.payment_document ?? "");
      setPaymentPhone(store.payment_phone ?? "");
    } else failures.push(storeResult.reason instanceof Error ? storeResult.reason.message : "No se pudo cargar el perfil del negocio.");
    if (couponsResult.status === "fulfilled") setCoupons(couponsResult.value);
    else failures.push(couponsResult.reason instanceof Error ? `No se pudieron cargar los cupones: ${couponsResult.reason.message}` : "No se pudieron cargar los cupones.");
    setError(failures.join(" "));
    setLoading(false);
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const update = () => { void refresh(); };
    socket?.on("order:new", update);
    socket?.on("order:status", update);
    return () => { socket?.off("order:new", update); socket?.off("order:status", update); };
  }, [refresh]);

  function resetForm() {
    setEditing(null); setName(""); setDescription(""); setPrice(""); setImageUrl(""); setStockQuantity("1");
  }

  async function saveProduct() {
    const numericPrice = Number(price);
    const quantity = Number(stockQuantity);
    if (!name.trim() || !Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isInteger(quantity) || quantity < 0) return setError("Ingresa nombre, precio y stock válido.");
    setSavingProduct(true);
    setError("");
    setNotice("");
    try {
      const payload = { name: name.trim(), description: description.trim(), price: numericPrice, stockQuantity: quantity, inStock: quantity > 0, imageUrl: imageUrl || null };
      const savedProduct = editing
        ? await api<Product>(`/products/${editing}`, token, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<Product>("/products", token, { method: "POST", body: JSON.stringify(payload) });
      setProducts((current) => {
        const next = editing
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct];
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
      resetForm();
      await refresh();
      setNotice(editing ? "Producto actualizado." : "Producto guardado en tu catálogo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el producto");
    } finally { setSavingProduct(false); }
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
      const quantity = product.in_stock ? 0 : Math.max(1, product.stock_quantity ?? 1);
      await api(`/products/${product.id}`, token, { method: "PATCH", body: JSON.stringify({ stockQuantity: quantity, inStock: quantity > 0 }) });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el producto"); }
  }

  async function resolveStoreAddress(coordinates: LocationCoordinates) {
    const sequence = ++addressLookupSequence.current;
    setResolvingStoreAddress(true);
    try {
      const result = await api<{ street: string; city: string }>(
        `/location/reverse?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}`,
      );
      if (sequence !== addressLookupSequence.current) return;
      const address = [result.street, result.city].filter(Boolean).join(", ");
      if (address) {
        setStoreAddress(address);
        setNotice("Dirección encontrada. Puedes ajustarla antes de guardar.");
      } else {
        setNotice("Ubicación seleccionada. Completa la dirección si hace falta.");
      }
    } catch (reason) {
      if (sequence !== addressLookupSequence.current) return;
      console.error("No se pudo obtener la dirección del comercio desde el mapa", reason);
      setNotice("Ubicación seleccionada. Escribe la dirección manualmente si no se completa.");
    } finally {
      if (sequence === addressLookupSequence.current) setResolvingStoreAddress(false);
    }
  }

  function selectStoreLocation(coordinates: LocationCoordinates) {
    setLocationCoordinates(coordinates);
    setNotice("");
    void resolveStoreAddress(coordinates);
  }

  async function useStoreCurrentLocation() {
    setLocatingStore(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Debes permitir el acceso a la ubicación para usar el GPS.");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      selectStoreLocation(current.coords);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación.";
      setError(message);
      Alert.alert("Ubicación no disponible", message);
    } finally { setLocatingStore(false); }
  }

  async function saveStoreProfile() {
    if (storeName.trim().length < 2 || storeAddress.trim().length < 5) {
      return setError("Ingresa el nombre y la dirección completa del negocio.");
    }
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      await api("/stores/me", token, {
        method: "PATCH",
        body: JSON.stringify({
          name: storeName.trim(),
          address: storeAddress.trim(),
          description: storeDescription.trim(),
          latitude: locationCoordinates?.latitude ?? null,
          longitude: locationCoordinates?.longitude ?? null,
          hasOwnDelivery,
          freeDelivery,
          paymentBank: paymentBank || null,
          paymentDocument: paymentDocument || null,
          paymentPhone: paymentPhone || null,
        }),
      });
      setNotice("Perfil del negocio guardado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el perfil");
    } finally { setSavingProfile(false); }
  }

  async function createCoupon() {
    const value = Number(couponDiscountValue);
    const usageLimit = couponUsageLimit.trim() ? Number(couponUsageLimit) : null;
    const requiredOrders = Number(couponRequiredOrders);
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(couponCode.trim())) return setError("El código debe tener entre 3 y 32 letras, números, guiones o guiones bajos.");
    if (!Number.isFinite(value) || value <= 0 || (couponDiscountType === "percent" && value > 100)) return setError("El descuento debe ser mayor que cero y el porcentaje no puede superar 100.");
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) return setError("El límite de usos debe ser un número entero positivo.");
    if (!Number.isInteger(requiredOrders) || requiredOrders < 0) return setError("El requisito de pedidos completados no es válido.");
    try {
      await api<StoreCoupon>("/store/coupons", token, {
        method: "POST",
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          discountType: couponDiscountType,
          discountValue: value,
          usageLimit,
          requiredCompletedOrders: requiredOrders,
        }),
      });
      setCouponCode("");
      setCouponDiscountValue("");
      setCouponUsageLimit("");
      setCouponRequiredOrders("0");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el cupón"); }
  }

  async function toggleCoupon(coupon: StoreCoupon) {
    try {
      await api<StoreCoupon>(`/store/coupons/${coupon.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ active: !coupon.active }),
      });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el cupón"); }
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
    <ScrollView style={[styles.page, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={{ backgroundColor: theme.primaryDark, borderRadius: 24, padding: 21, gap: 8, overflow: "hidden" }}>
        <Text style={{ color: "#E8FFFC", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>TU NEGOCIO, MÁS CERCA</Text>
        <Text style={{ color: "#fff", fontSize: 25, fontWeight: "900" }}>¡Hola, {storeName || "comercio"}! 👋</Text>
        <Text style={{ color: "#E8FFFC", fontSize: 13 }}>Hoy es un gran día para llegar a más vecinos.</Text>
        <View style={{ flexDirection: "row", gap: 9, marginTop: 7 }}>
          {[
            { value: String(orders.filter((order) => ["placed", "accepted", "preparing"].includes(order.status)).length), label: "PEDIDOS ACTIVOS" },
            { value: String(products.length), label: "PRODUCTOS" },
            { value: String(orders.filter((order) => order.status === "delivered").length), label: "ENTREGADOS" },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: "#FFFFFF18", borderRadius: 15, padding: 11 }}>
              <Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>{item.value}</Text>
              <Text style={{ color: "#D8FFFA", fontSize: 8, fontWeight: "800", marginTop: 3 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={{ color: theme.primaryDark, backgroundColor: theme.soft, padding: 11, borderRadius: 12, fontSize: 12, fontWeight: "700" }}>{notice}</Text> : null}
      <Card>
        <Text style={[styles.section, { color: theme.ink, marginTop: 0 }]}>Perfil del negocio</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Mantén actualizados los datos que verán tus clientes y repartidores.</Text>
        <Field label="Nombre del negocio" value={storeName} onChangeText={setStoreName} />
        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <MapPin size={16} color={theme.primaryDark} />
            <Text style={[styles.label, { color: theme.ink }]}>Ubicación del negocio</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Toca el mapa para marcar tu local. La dirección se completa automáticamente.
          </Text>
          <LocationPickerMap
            coordinates={locationCoordinates ?? defaultStoreMapCenter}
            onSelect={selectStoreLocation}
            mapHeight={230}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ flex: 1, color: locationCoordinates ? theme.primaryDark : theme.muted, fontSize: 11, fontWeight: "700" }}>
              {resolvingStoreAddress ? "Buscando dirección…" : locationCoordinates ? "Punto del negocio marcado en el mapa" : "Marca la ubicación exacta de tu negocio"}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={locatingStore}
              onPress={() => void useStoreCurrentLocation()}
              style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 10, borderRadius: 11, backgroundColor: theme.soft, opacity: locatingStore ? 0.6 : 1 }}
            >
              <Text style={{ color: theme.primaryDark, fontSize: 11, fontWeight: "800" }}>
                {locatingStore ? "Buscando GPS…" : "Usar GPS"}
              </Text>
            </Pressable>
          </View>
        </View>
        <Field label="Dirección del negocio" value={storeAddress} onChangeText={(value) => { setStoreAddress(value); setNotice(""); }} placeholder="Se completa al elegir el mapa; puedes editarla" multiline />
        <Field label="Descripción" value={storeDescription} onChangeText={setStoreDescription} multiline />
        <Button title={`Delivery propio: ${hasOwnDelivery ? "Sí" : "No"}`} secondary onPress={() => setHasOwnDelivery((value) => !value)} />
        <Button title={`Delivery gratis: ${freeDelivery ? "Sí" : "No"}`} secondary onPress={() => setFreeDelivery((value) => !value)} />
        <Text style={[styles.section, { color: theme.ink }]}>Datos de pago móvil</Text>
        <Field label="Banco" value={paymentBank} onChangeText={setPaymentBank} placeholder="Banco de Venezuela" />
        <Field label="RIF o cédula" value={paymentDocument} onChangeText={setPaymentDocument} placeholder="J-12345678-9" />
        <Field label="Teléfono" value={paymentPhone} onChangeText={setPaymentPhone} placeholder="0412-1234567" keyboardType="numeric" />
        <Button title={savingProfile ? "Guardando perfil…" : "Guardar perfil"} disabled={savingProfile} onPress={() => void saveStoreProfile()} />
      </Card>
      <Text style={[styles.section, { color: theme.ink }]}>Pedidos entrantes</Text>
      {!orders.length && <Text style={[styles.subtitle, { color: theme.muted }]}>No tienes pedidos todavía.</Text>}
      {orders.map((order) => (
        <Card key={order.id}>
          <View style={styles.row}>
            <Text style={{ color: theme.ink, fontWeight: "900", fontSize: 15 }}>Pedido #{order.id.slice(0, 8)}</Text>
            <Text style={{ color: order.status === "placed" ? theme.primaryDark : theme.muted, backgroundColor: order.status === "placed" ? theme.soft : theme.background, overflow: "hidden", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: "900" }}>{order.status.toUpperCase()}</Text>
          </View>
          <Text style={{ color: theme.ink }}>{order.items?.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Entrega: {order.delivery_address}</Text>
          <Text style={{ color: theme.ink }}>Total: {formatDualPrice(order.total, order.exchange_rate ?? exchangeRate)}</Text>
          <Button title="Abrir chat del pedido" secondary onPress={() => setActiveChatOrder(order)} />
          {(order.status === "placed" || order.status === "accepted" || order.status === "preparing" ||
            (hasOwnDelivery && (order.status === "ready" || order.status === "picked_up"))) && (
            <Button title={({
              placed: "Aceptar pedido",
              accepted: "Iniciar preparación (requiere comprobante)",
              preparing: "Marcar listo para retirar",
              ready: "Confirmar que va en camino",
              picked_up: "Confirmar entrega al cliente",
            } as Record<string, string>)[order.status]}
              onPress={() => void changeOrder(order, ({
                placed: "accepted", accepted: "preparing", preparing: "ready",
                ready: "picked_up", picked_up: "delivered",
              } as Record<string, string>)[order.status])} />
          )}
          {["placed", "accepted", "preparing"].includes(order.status) && (
            <Button title="Cancelar pedido" secondary onPress={() => void changeOrder(order, "cancelled")} />
          )}
        </Card>
      ))}
      <Card>
        <Text style={[styles.section, { color: theme.ink }]}>Cupones de descuento</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Los descuentos se verifican en el servidor al crear el pedido.</Text>
        <Field label="Código" value={couponCode} onChangeText={setCouponCode} placeholder="VECINO10" />
        <Button title={`Tipo de descuento: ${couponDiscountType === "percent" ? "Porcentaje" : "Monto fijo USD"}`} secondary onPress={() => setCouponDiscountType((type) => type === "percent" ? "fixed" : "percent")} />
        <Field label={couponDiscountType === "percent" ? "Porcentaje (máximo 100)" : "Monto a descontar en USD"} value={couponDiscountValue} onChangeText={setCouponDiscountValue} keyboardType="numeric" />
        <Field label="Límite de usos (opcional)" value={couponUsageLimit} onChangeText={setCouponUsageLimit} keyboardType="numeric" placeholder="Sin límite" />
        <Field label="Pedidos entregados en este comercio requeridos" value={couponRequiredOrders} onChangeText={setCouponRequiredOrders} keyboardType="numeric" placeholder="0" />
        <Button title="Crear cupón" onPress={() => void createCoupon()} />
        {!coupons.length && <Text style={[styles.subtitle, { color: theme.muted }]}>Aún no has creado cupones.</Text>}
        {coupons.map((coupon) => (
          <View key={coupon.id} style={{ padding: 12, borderRadius: 14, backgroundColor: theme.background, gap: 5 }}>
            <Text style={{ color: theme.ink, fontWeight: "900" }}>{coupon.code} · {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `${coupon.discount_value} USD`}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Usos: {coupon.used_count}{coupon.usage_limit == null ? "" : ` / ${coupon.usage_limit}`} · Requiere {coupon.required_completed_orders} pedidos entregados · {coupon.active ? "Activo" : "Pausado"}
            </Text>
            <Button title={coupon.active ? "Pausar cupón" : "Activar cupón"} secondary onPress={() => void toggleCoupon(coupon)} />
          </View>
        ))}
      </Card>
      <Card>
        <Text style={[styles.section, { color: theme.ink, marginTop: 0 }]}>{editing ? "Editar producto" : "Nuevo producto"}</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Completa los datos y agrega una foto directamente desde tu teléfono.</Text>
        <Field label="Nombre del producto" value={name} onChangeText={setName} placeholder="Ej. Arepas de queso" />
        <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} placeholder="Ingredientes, tamaño o detalles" multiline />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Precio" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" /></View>
          <View style={{ flex: 1 }}><Field label="Unidades disponibles" value={stockQuantity} onChangeText={setStockQuantity} keyboardType="numeric" /></View>
        </View>
        <View style={{ gap: 7 }}>
          <Text style={[styles.label, { color: theme.ink }]}>Foto del producto</Text>
          <ProductPhotoPicker value={imageUrl} onSelect={setImageUrl} disabled={savingProduct} />
        </View>
        <Button title={savingProduct ? "Guardando producto…" : editing ? "Guardar cambios" : "Agregar al catálogo"} disabled={savingProduct} onPress={() => void saveProduct()} />
        {editing && <Button title="Cancelar edición" secondary onPress={resetForm} />}
      </Card>
      <Text style={[styles.section, { color: theme.ink }]}>Tu catálogo · {products.length}</Text>
      {!products.length && <Text style={[styles.subtitle, { color: theme.muted }]}>Todavía no hay productos. Agrega el primero con el formulario.</Text>}
      {products.map((product) => (
        <Card key={product.id}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} resizeMode="cover" style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: theme.soft }} />
            ) : (
              <View style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: theme.soft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: theme.primaryDark, fontSize: 20, fontWeight: "900" }}>{product.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: theme.ink, fontWeight: "800", fontSize: 14 }}>{product.name}</Text>
              <Text style={{ color: theme.primaryDark, fontWeight: "800", fontSize: 12 }}>{formatDualPrice(product.price, exchangeRate)}</Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{product.in_stock ? `${product.stock_quantity ?? 0} disponibles` : "Agotado"}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 100 }}><Button title="Editar" secondary onPress={() => {
              setEditing(product.id); setName(product.name); setDescription(product.description ?? "");
              setPrice(String(product.price)); setImageUrl(product.image_url ?? ""); setStockQuantity(String(product.stock_quantity ?? 0));
              setNotice("");
            }} /></View>
            <View style={{ flex: 1, minWidth: 130 }}><Button title={product.in_stock ? "Marcar agotado" : "Reponer stock"} secondary onPress={() => void toggleStock(product)} /></View>
            <View style={{ flex: 1, minWidth: 100 }}><Button title="Eliminar" secondary onPress={() => deleteProduct(product)} /></View>
          </View>
        </Card>
      ))}
      <OrderChatSheet order={activeChatOrder} role="store" onClose={() => setActiveChatOrder(null)} />
    </ScrollView>
  );
}
