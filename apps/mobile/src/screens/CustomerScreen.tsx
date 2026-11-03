import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Loading, styles } from "../components/UI";
import { ExchangeRateBadge } from "../components/ExchangeRateBadge";
import { LocationPicker } from "../components/LocationPicker";
import type { LocationCoordinates } from "../components/LocationPickerMap";
import { OrderChatSheet } from "../components/OrderChatSheet";
import { formatDualPrice } from "../currency";
import type { Address, Category, Order, Product, Store } from "../types";
import { socket } from "./socketRef";

type Sheet = "location" | "cart" | "notice" | null;
type CustomerTab = "home" | "orders";

const palette = {
  ink: "#191B22",
  muted: "#777D89",
  orange: "#F45B3C",
  background: "#F7F8FA",
  green: "#23824E",
};

const promotions = [
  {
    tag: "FAVORITOS DEL BARRIO",
    title: "Lo rico llega rápido",
    body: "Descubre algo nuevo a la vuelta de la esquina.",
    image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=85",
    tint: "#351A13",
  },
  {
    tag: "UNA PAUSA QUE TE MERECES",
    title: "Café y algo dulce",
    body: "Tu tarde acaba de mejorar. Desde $3.50.",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85",
    tint: "#332014",
  },
  {
    tag: "CERCA, FRESCO, LOCAL",
    title: "El mercado va a ti",
    body: "Llena tu cocina con productos frescos.",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85",
    tint: "#183324",
  },
];

const categoryVisuals: Record<string, { icon: string; color: string }> = {
  Todo: { icon: "▦", color: "#EEF0F4" },
  Restaurantes: { icon: "🍽️", color: "#FFF0E8" },
  Comidas: { icon: "🍲", color: "#FFF0E8" },
  Supermercados: { icon: "🥑", color: "#EDF7E9" },
  Bodegas: { icon: "🛒", color: "#EDF7E9" },
  Farmacias: { icon: "💊", color: "#EAF4FF" },
  Tiendas: { icon: "🛍️", color: "#F5EDFF" },
  Cafeterías: { icon: "☕", color: "#FFF4DD" },
  Repuestos: { icon: "⚙️", color: "#EAF4FF" },
};

function CategoryItem({ category, selected, onPress }: {
  category: Category | { id: ""; name: "Todo" };
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const visual = categoryVisuals[category.name] ?? { icon: "✨", color: "#F0F1F4" };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: Platform.OS !== "web", speed: 35, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 30, bounciness: 5 }).start()}
    >
      <Animated.View style={{ alignItems: "center", gap: 8, width: 72, transform: [{ scale }] }}>
        <View style={{
          width: 62, height: 62, borderRadius: 22,
          backgroundColor: selected ? "#FFE7DF" : visual.color,
          borderWidth: selected ? 2 : 1, borderColor: selected ? palette.orange : "#FFFFFF",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 26 }}>{visual.icon}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: selected ? palette.orange : "#565C67", fontSize: 11, fontWeight: selected ? "800" : "600" }}>
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function StoreCard({ store, exchangeRate, onPress }: { store: Store; exchangeRate: number | null; onPress: () => void }) {
  const ratingValue = Number(store.rating ?? 0);
  const rating = ratingValue > 0 ? ratingValue.toFixed(1) : "Nuevo";
  const fee = Number(store.delivery_fee ?? 2.99);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({
      width: 260, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
      borderWidth: 1, borderColor: "#EEF0F3", opacity: pressed ? 0.94 : 1,
      transform: [{ scale: pressed ? 0.985 : 1 }],
    })}>
      <ImageBackground
        source={{ uri: store.image_url ?? promotions[0].image }}
        style={{ height: 142, justifyContent: "space-between", padding: 12, backgroundColor: "#E9E9E9" }}
        imageStyle={{ resizeMode: "cover" }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", backgroundColor: "#191B22B8", overflow: "hidden", paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20 }}>
            {store.category_name ?? "Comercio local"}
          </Text>
          <Text style={{ color: "#252832", fontWeight: "900", backgroundColor: "#FFFFFFE8", overflow: "hidden", paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20 }}>
            {ratingValue > 0 ? `★ ${rating}` : rating}
          </Text>
        </View>
        {store.free_delivery === true && <Text style={{ color: "#fff", alignSelf: "flex-start", backgroundColor: palette.green, overflow: "hidden", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, fontSize: 11, fontWeight: "900" }}>DELIVERY GRATIS</Text>}
      </ImageBackground>
      <View style={{ padding: 14, gap: 9 }}>
        <Text numberOfLines={1} style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>{store.name}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: palette.muted, fontSize: 12 }}>◷ {store.estimated_delivery_minutes ?? 30}–{(store.estimated_delivery_minutes ?? 30) + 10} min</Text>
          <Text style={{ color: fee === 0 ? palette.green : palette.muted, fontSize: 12, fontWeight: "800" }}>
            {store.free_delivery === true ? "Delivery gratis" : `Envío ${formatDualPrice(fee, exchangeRate)}`}
          </Text>
        </View>
        {store.distance_km != null && <Text style={{ color: "#9398A2", fontSize: 11 }}>{Number(store.distance_km).toFixed(1)} km · {store.address}</Text>}
      </View>
    </Pressable>
  );
}

export function CustomerScreen() {
  const { session, exchangeRate, exchangeRateValueDate } = useAuth();
  const token = session!.token;
  const { width: screenWidth } = useWindowDimensions();
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("");
  const [addressCoordinates, setAddressCoordinates] = useState<LocationCoordinates | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState("Casa");
  const [editingAddressId, setEditingAddressId] = useState("");
  const [deleteAddressCandidate, setDeleteAddressCandidate] = useState<Address | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyCoordinates, setNearbyCoordinates] = useState<LocationCoordinates | null>(null);
  const [activeTab, setActiveTab] = useState<CustomerTab>("home");
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [storeRating, setStoreRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollViewInstance | null>(null);
  const pageScrollRef = useRef<ScrollViewInstance | null>(null);
  const [storeSectionY, setStoreSectionY] = useState(0);
  const bannerWidth = Math.min(screenWidth - 40, 840);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartTotal = products.reduce((sum, product) => sum + Number(product.price) * (cart[product.id] ?? 0), 0);

  const refreshOrders = useCallback(async () => {
    try {
      const recent = await api<Order[]>("/orders", token);
      setOrders(recent);
      setActiveChatOrder((current) => current ? recent.find((item) => item.id === current.id) ?? current : null);
      setReviewOrder((current) => current ?? recent.find((item) => item.status === "delivered" && !item.has_review) ?? null);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Error cargando pedidos"); }
  }, [token]);

  useEffect(() => {
    Promise.all([
      api<Store[]>("/stores"),
      api<Order[]>("/orders", token),
      api<Category[]>("/categories"),
      api<Address[]>("/addresses", token),
    ])
      .then(([nearby, recent, availableCategories, savedAddresses]) => {
        setStores(nearby);
        setOrders(recent);
        setCategories(availableCategories);
        setAddresses(savedAddresses);
        const preferred = savedAddresses.find((item) => item.is_default) ?? savedAddresses[0];
        if (preferred) setSelectedAddressId(preferred.id);
        setReviewOrder(recent.find((item) => item.status === "delivered" && !item.has_review) ?? null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos"))
      .finally(() => setBusy(false));
  }, [token]);

  useEffect(() => {
    const changed = (order?: Order) => {
      if (order) {
        setNotice({ title: "Tu pedido se actualizó", body: statusLabel(order.status) });
        setSheet("notice");
      }
      void refreshOrders();
    };
    socket?.on("order:status", changed);
    socket?.on("delivery:assigned", changed);
    return () => { socket?.off("order:status", changed); socket?.off("delivery:assigned", changed); };
  }, [refreshOrders]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((current) => {
        const next = (current + 1) % promotions.length;
        bannerRef.current?.scrollTo({ x: (bannerWidth + 12) * next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerWidth]);

  async function openStore(store: Store) {
    setSelected(store);
    setCart({});
    setProducts([]);
    setProductsLoading(true);
    setError("");
    try { setProducts(await api<Product[]>(`/stores/${store.id}/products`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir el comercio"); }
    finally { setProductsLoading(false); }
  }

  async function placeOrder() {
    if (!selected || (!selectedAddressId && !address.trim())) {
      setError("Selecciona o indica la dirección de entrega.");
      setSheet("cart");
      return;
    }
    const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));
    if (!items.length) return setError("Agrega al menos un producto.");
    setError("");
    try {
      await api<Order>("/orders", token, {
        method: "POST",
        body: JSON.stringify({ storeId: selected.id, ...(selectedAddressId ? { addressId: selectedAddressId } : { deliveryAddress: address }), items }),
      });
      setSelected(null);
      setCart({});
      setSelectedAddressId("");
      setSheet(null);
      await refreshOrders();
      setNotice({ title: "Solicitud enviada", body: "Espera la confirmación de la tienda en el chat antes de transferir. Después, envía obligatoriamente el comprobante o número de referencia por Pago Móvil." });
      setSheet("notice");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el pedido");
      setSheet("cart");
    }
  }

  async function saveAddress() {
    if (!address.trim()) return setError("Escribe una dirección antes de guardarla.");
    try {
      const saved = await api<Address>(editingAddressId ? `/addresses/${editingAddressId}` : "/addresses", token, {
        method: editingAddressId ? "PATCH" : "POST",
        body: JSON.stringify({
          label: addressLabel,
          addressLine: address,
          latitude: addressCoordinates?.latitude ?? null,
          longitude: addressCoordinates?.longitude ?? null,
        }),
      });
      setAddresses((current) => editingAddressId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      setSelectedAddressId(saved.id);
      setAddress("");
      setAddressCoordinates(null);
      setEditingAddressId("");
      setAddressLabel("Casa");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la dirección"); }
  }

  async function setDefaultAddress(saved: Address) {
    try {
      const updated = await api<Address>(`/addresses/${saved.id}`, token, {
        method: "PATCH", body: JSON.stringify({ isDefault: true }),
      });
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.id === updated.id })));
      setSelectedAddressId(updated.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar la dirección predeterminada"); }
  }

  async function deleteAddress(saved: Address) {
    try {
      await api(`/addresses/${saved.id}`, token, { method: "DELETE" });
      const remaining = addresses.filter((item) => item.id !== saved.id);
      setAddresses(remaining.map((item) => ({ ...item, is_default: item.is_default || (saved.is_default && item.id === remaining[0]?.id) })));
      if (selectedAddressId === saved.id) setSelectedAddressId(remaining.find((item) => item.is_default)?.id ?? "");
      if (editingAddressId === saved.id) { setEditingAddressId(""); setAddress(""); setAddressLabel("Casa"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar la dirección"); }
  }

  async function submitReview() {
    if (!reviewOrder || storeRating < 1) return setError("Selecciona una calificación de 1 a 5 estrellas.");
    try {
      await api(`/orders/${reviewOrder.id}/review`, token, {
        method: "POST",
        body: JSON.stringify({
          rating: storeRating,
          comment: reviewComment,
          ...(reviewOrder.driver_id && driverRating ? { driverRating, driverComment } : {}),
        }),
      });
      const reviewedId = reviewOrder.id;
      setOrders((current) => current.map((item) => item.id === reviewedId ? { ...item, has_review: true } : item));
      setReviewOrder(null);
      setStoreRating(0); setDriverRating(0); setReviewComment(""); setDriverComment("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar la reseña"); }
  }
  async function findNearby() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Permite el acceso a la ubicación para ordenar los comercios por cercanía.");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentCoordinates = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      const params = new URLSearchParams({ latitude: String(current.coords.latitude), longitude: String(current.coords.longitude) });
      const nearbyStores = await api<Store[]>(`/stores?${params.toString()}`);
      const toRadians = (degrees: number) => degrees * Math.PI / 180;
      setStores(nearbyStores.map((store) => {
        if (store.distance_km != null || store.latitude == null || store.longitude == null) return store;
        const latitudeDelta = toRadians(Number(store.latitude) - currentCoordinates.latitude);
        const longitudeDelta = toRadians(Number(store.longitude) - currentCoordinates.longitude);
        const distance = 2 * 6371 * Math.asin(Math.sqrt(
          Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(toRadians(currentCoordinates.latitude)) * Math.cos(toRadians(Number(store.latitude))) *
          Math.sin(longitudeDelta / 2) ** 2,
        ));
        return { ...store, distance_km: distance };
      }).sort((a, b) => Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity)));
      setNearbyEnabled(true);
      setNearbyCoordinates(currentCoordinates);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación"); }
  }

  function explorePromotion(index: number) {
    const categoryOptions = [
      ["comidas", "restaurantes"],
      ["cafeter", "café"],
      ["bodega", "supermercado"],
    ][index] ?? [];
    const category = categories.find((item) => categoryOptions.some((term) => item.name.toLowerCase().includes(term)));
    setSelectedCategory(category?.id ?? "");
    setSearch(category ? "" : index === 1 ? "café" : index === 2 ? "mercado" : "comida");
    setSelected(null);
    setActiveTab("home");
    requestAnimationFrame(() => pageScrollRef.current?.scrollTo({ y: storeSectionY, animated: true }));
  }

  if (busy) return <Loading />;
  const visibleStores = stores.filter((store) => {
    const matchesText = `${store.name} ${store.category_name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || store.category_id === selectedCategory;
    return matchesText && matchesCategory;
  });
  const popular = nearbyEnabled
    ? visibleStores
    : [...visibleStores].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const freeDelivery = visibleStores.filter((store) => store.free_delivery === true);
  const newest = [...visibleStores].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const deliveryFee = selected?.free_delivery ? 0 : Number(selected?.delivery_fee ?? 2.99);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView ref={pageScrollRef} style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 16, paddingBottom: 112 }]} keyboardShouldPersistTaps="handled">
        {error ? <Pressable onPress={() => setError("")}><Text style={styles.error}>{error}  ×</Text></Pressable> : null}
        <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} />
        {activeTab === "orders" ? (
          <>
            <View style={{ gap: 5, marginTop: 6 }}>
              <Text style={{ color: palette.ink, fontSize: 25, fontWeight: "900" }}>Pedidos y chat</Text>
              <Text style={styles.subtitle}>Revisa tus pedidos y conversa con cada comercio.</Text>
            </View>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#EEF0F3", padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>Dirección de entrega</Text>
                  <Text numberOfLines={2} style={styles.subtitle}>
                    {addresses.find((item) => item.id === selectedAddressId)?.address_line ?? "Aún no has seleccionado una dirección"}
                  </Text>
                </View>
                <Text style={{ fontSize: 22 }}>📍</Text>
              </View>
              <Button title="Administrar mis direcciones" secondary onPress={() => setSheet("location")} />
            </View>
            {orders.length ? orders.map((order) => (
              <View key={order.id} style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#EEF0F3", padding: 15, gap: 9 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "900" }}>{order.store_name ?? "Comercio"}</Text>
                    <Text style={styles.subtitle}>{order.delivery_address}</Text>
                  </View>
                  <Text style={{ color: palette.orange, fontSize: 11, fontWeight: "900" }}>{statusLabel(order.status)}</Text>
                </View>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>{formatDualPrice(order.total, order.exchange_rate ?? exchangeRate)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Pressable onPress={() => setActiveChatOrder(order)} style={{ backgroundColor: palette.orange, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>Abrir chat</Text>
                  </Pressable>
                  {order.status === "delivered" && !order.has_review && <Pressable onPress={() => setReviewOrder(order)}><Text style={{ color: palette.green, fontSize: 12, fontWeight: "900" }}>Calificar</Text></Pressable>}
                </View>
              </View>
            )) : (
              <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 22, alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 34 }}>🛍️</Text>
                <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>Aún no tienes pedidos</Text>
                <Text style={[styles.subtitle, { textAlign: "center" }]}>Cuando hagas tu primer pedido, aquí podrás revisar su estado y abrir el chat.</Text>
                <Button title="Explorar comercios" onPress={() => setActiveTab("home")} />
              </View>
            )}
          </>
        ) : selected ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => { setSelected(null); setError(""); }} style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>‹  Volver</Text>
              </Pressable>
              <Text style={{ color: palette.muted, fontWeight: "700" }}>MENÚ DEL COMERCIO</Text>
            </View>
            <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#E7E8E7" }}>
              <ImageBackground source={{ uri: selected.image_url ?? promotions[0].image }} style={{ height: 210, justifyContent: "space-between", padding: 18 }}>
                {selected.free_delivery === true && <Text style={{ color: "#fff", alignSelf: "flex-start", backgroundColor: palette.green, overflow: "hidden", borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11, fontSize: 11, fontWeight: "900" }}>DELIVERY GRATIS</Text>}
                <View style={{ backgroundColor: "#151515A8", padding: 14, borderRadius: 16 }}>
                  <Text style={{ color: "#fff", fontSize: 23, fontWeight: "900" }}>{selected.name}</Text>
                  <Text style={{ color: "#fff", marginTop: 5 }}>{Number(selected.rating ?? 0) > 0 ? `★ ${Number(selected.rating).toFixed(1)}  ·  ` : ""}◷ {selected.estimated_delivery_minutes ?? 30}–{(selected.estimated_delivery_minutes ?? 30) + 10} min  ·  {selected.address}</Text>
                </View>
              </ImageBackground>
            </View>
            <Text style={styles.section}>Lo que más te va a gustar</Text>
            {productsLoading && <Loading />}
            {products.map((product) => (
              <Card key={product.id}>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <View style={{ flex: 1, gap: 7 }}>
                    <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 16 }}>{product.name}</Text>
                    <Text style={styles.subtitle}>{product.description || (product.in_stock ? "Preparado con cariño" : "Sin stock por ahora")}</Text>
                    <Text style={{ color: palette.ink, fontWeight: "900" }}>{formatDualPrice(product.price, exchangeRate)}</Text>
                  </View>
                  {product.image_url ? <Image source={{ uri: product.image_url }} style={{ width: 88, height: 88, borderRadius: 16, backgroundColor: "#F0F1F3" }} resizeMode="cover" /> : (
                    <View style={{ width: 88, height: 88, borderRadius: 16, backgroundColor: "#FFF1EC", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 34 }}>🥐</Text></View>
                  )}
                </View>
                <Button
                  title={!product.in_stock ? "Agotado" : cart[product.id] ? `Añadir otro  ·  ${cart[product.id]} en tu bolsa` : "Añadir a mi pedido"}
                  disabled={!product.in_stock}
                  onPress={() => setCart((value) => ({ ...value, [product.id]: (value[product.id] ?? 0) + 1 }))}
                />
              </Card>
            ))}
            {!productsLoading && !products.length && <Text style={styles.subtitle}>Este comercio aún no tiene productos publicados.</Text>}
          </>
        ) : (
          <>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 14, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#EEF0F3" }}>
              <Text style={{ fontSize: 18, color: "#9196A0" }}>⌕</Text>
              <TextInput
                accessibilityLabel="Buscar comercios o antojos"
                placeholder="¿Qué se te antoja hoy?"
                placeholderTextColor="#A0A4AE"
                value={search}
                onChangeText={setSearch}
                style={{ flex: 1, minHeight: 48, color: palette.ink, fontSize: 14 }}
              />
              {search.length > 0 && <Pressable onPress={() => setSearch("")}><Text style={{ color: palette.muted, padding: 8 }}>✕</Text></Pressable>}
            </View>

            <ScrollView
              ref={bannerRef}
              horizontal
              pagingEnabled
              snapToInterval={bannerWidth + 12}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / (bannerWidth + 12)))}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {promotions.map((promo, index) => (
                <Pressable key={promo.title} accessibilityRole="button" onPress={() => explorePromotion(index)} style={{ width: bannerWidth }}>
                  <ImageBackground source={{ uri: promo.image }} style={{ height: 190, justifyContent: "center", padding: 22, overflow: "hidden", borderRadius: 24 }} imageStyle={{ borderRadius: 24 }}>
                    <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${promo.tint}88`, borderRadius: 24 }} />
                    <Text style={{ color: "#FFE3A0", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{promo.tag}</Text>
                    <Text style={{ color: "#fff", fontSize: 27, fontWeight: "900", marginTop: 8, maxWidth: 280 }}>{promo.title}</Text>
                    <Text style={{ color: "#FFFFFFE8", fontSize: 13, marginTop: 5, maxWidth: 280 }}>{promo.body}</Text>
                    <View style={{ alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, marginTop: 14 }}>
                      <Text style={{ color: palette.ink, fontSize: 11, fontWeight: "900" }}>Explorar ahora  →</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -4 }}>
              {promotions.map((promo, index) => (
                <Pressable key={promo.title} accessibilityRole="button" accessibilityLabel={`Ver promoción ${index + 1}`} onPress={() => {
                  setBannerIndex(index);
                  bannerRef.current?.scrollTo({ x: (bannerWidth + 12) * index, animated: true });
                }}>
                  <View style={{ width: bannerIndex === index ? 20 : 6, height: 6, borderRadius: 4, backgroundColor: bannerIndex === index ? palette.orange : "#DADDE2" }} />
                </Pressable>
              ))}
            </View>

            <View onLayout={(event) => setStoreSectionY(event.nativeEvent.layout.y)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.section}>¿Qué buscamos?</Text>
              <Pressable accessibilityRole="button" onPress={() => void findNearby()}><Text style={{ color: palette.orange, fontWeight: "800", fontSize: 12 }}>{nearbyEnabled ? "Cerca de ti ✓" : "Ver cercanos"}</Text></Pressable>
            </View>
            {nearbyCoordinates && <Text style={{ color: palette.muted, fontSize: 11 }}>Distancias desde {nearbyCoordinates.latitude.toFixed(3)}, {nearbyCoordinates.longitude.toFixed(3)}.</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 2 }}>
              <CategoryItem category={{ id: "", name: "Todo" }} selected={!selectedCategory} onPress={() => setSelectedCategory("")} />
              {categories.map((category) => (
                <CategoryItem key={category.id} category={category} selected={selectedCategory === category.id} onPress={() => setSelectedCategory(category.id)} />
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <View><Text style={styles.section}>Populares en tu zona</Text><Text style={styles.subtitle}>Los favoritos de tus vecinos</Text></View>
              <Text style={{ color: palette.orange, fontSize: 12, fontWeight: "800" }}>{visibleStores.length} lugares</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 4 }}>
              {popular.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} onPress={() => void openStore(store)} />)}
            </ScrollView>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <View><Text style={styles.section}>Envío gratis</Text><Text style={styles.subtitle}>Hoy invitan ellos 🚲</Text></View>
              <Text style={{ color: palette.green, fontWeight: "800", fontSize: 12 }}>Sin costo</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 4 }}>
              {freeDelivery.length
                ? freeDelivery.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} onPress={() => void openStore(store)} />)
                : <Text style={[styles.subtitle, { padding: 16 }]}>Las promociones de envío gratis aparecerán aquí.</Text>}
            </ScrollView>

            <View style={{ marginTop: 8 }}><Text style={styles.section}>Nuevos comercios</Text><Text style={styles.subtitle}>Descubre quién llegó al barrio</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 4 }}>
              {newest.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} onPress={() => void openStore(store)} />)}
            </ScrollView>

            <View style={{ backgroundColor: "#FFF0EC", padding: 18, borderRadius: 20, marginTop: 8 }}>
              <Text style={{ fontSize: 22 }}>💛</Text>
              <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 16, marginTop: 6 }}>Cada pedido apoya a alguien cerca</Text>
              <Text style={[styles.subtitle, { marginTop: 4 }]}>Gracias por elegir los comercios de tu comunidad.</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFFF5", borderTopWidth: 1, borderTopColor: "#ECEEF1", paddingHorizontal: 14, paddingTop: 9, paddingBottom: 14, flexDirection: "row", justifyContent: "space-around" }}>
        <Pressable onPress={() => { setActiveTab("home"); setSelected(null); setError(""); }} style={{ alignItems: "center", gap: 3, minWidth: 76, paddingVertical: 3 }}>
          <Text style={{ fontSize: 20, color: activeTab === "home" ? palette.orange : palette.muted }}>🏠</Text><Text style={{ color: activeTab === "home" ? palette.orange : palette.muted, fontSize: 10, fontWeight: "900" }}>INICIO</Text>
        </Pressable>
        <Pressable onPress={() => { setActiveTab("orders"); setSelected(null); setError(""); }} style={{ alignItems: "center", gap: 3, minWidth: 76, paddingVertical: 3 }}>
          <Text style={{ fontSize: 20, color: activeTab === "orders" ? palette.orange : palette.muted }}>💬</Text><Text style={{ color: activeTab === "orders" ? palette.orange : palette.muted, fontSize: 10, fontWeight: "900" }}>PEDIDOS</Text>
        </Pressable>
        <Pressable onPress={() => setSheet("cart")} style={{ alignItems: "center", gap: 3, minWidth: 76, paddingVertical: 3 }}>
          <View><Text style={{ fontSize: 20, color: palette.muted }}>🛍️</Text>{itemCount > 0 && <View style={{ position: "absolute", right: -9, top: -4, backgroundColor: palette.orange, borderRadius: 10, paddingHorizontal: 5 }}><Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{itemCount}</Text></View>}</View>
          <Text style={{ color: palette.muted, fontSize: 10, fontWeight: "800" }}>BOLSA</Text>
        </Pressable>
      </View>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
          <Pressable onPress={() => setSheet(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ width: "100%", maxWidth: 560, maxHeight: "82%", alignSelf: "center", backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, gap: 12 }}>
            <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: "#D9DCE2", alignSelf: "center", marginBottom: 4 }} />
            {sheet === "location" && <>
              <Text style={styles.title}>¿A dónde lo llevamos?</Text>
              <Text style={styles.subtitle}>Administra tus direcciones y elige dónde recibir.</Text>
              {addresses.map((saved) => (
                <View key={saved.id} style={{ padding: 12, borderRadius: 15, backgroundColor: selectedAddressId === saved.id ? "#FFF0EC" : "#F7F8FA", gap: 8 }}>
                  <Pressable onPress={() => { setSelectedAddressId(saved.id); setAddress(""); setSheet(null); }} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ flex: 1, color: palette.ink, fontWeight: "700" }}>⌂  {saved.label}{saved.is_default ? " · Predeterminada" : ""} · {saved.address_line}</Text>
                    {selectedAddressId === saved.id && <Text style={{ color: palette.orange }}>✓</Text>}
                  </Pressable>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {!saved.is_default && <Pressable onPress={() => void setDefaultAddress(saved)}><Text style={{ color: palette.green, fontSize: 12, fontWeight: "800" }}>Hacer predeterminada</Text></Pressable>}
                    <Pressable onPress={() => {
                      setEditingAddressId(saved.id);
                      setAddressLabel(saved.label);
                      setAddress(saved.address_line);
                      setAddressCoordinates(saved.latitude != null && saved.longitude != null
                        ? { latitude: Number(saved.latitude), longitude: Number(saved.longitude) }
                        : null);
                    }}><Text style={{ color: palette.orange, fontSize: 12, fontWeight: "800" }}>Editar</Text></Pressable>
                    <Pressable onPress={() => setDeleteAddressCandidate(saved)}><Text style={{ color: "#B42318", fontSize: 12, fontWeight: "800" }}>Eliminar</Text></Pressable>
                  </View>
                </View>
              ))}
              <TextInput placeholder="Etiqueta (Casa, trabajo…)" value={addressLabel} onChangeText={setAddressLabel} style={{ minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14 }} />
              <TextInput placeholder="Calle, número, ciudad" value={address} onChangeText={(value) => { setAddress(value); setAddressCoordinates(null); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14 }} />
              <Button title={addressCoordinates ? "Cambiar ubicación en el mapa" : "Agregar ubicación con mapa y GPS"} secondary onPress={() => setLocationPickerVisible(true)} />
              {addressCoordinates && <Text style={{ color: palette.green, fontSize: 11 }}>📍 Coordenadas guardadas: {addressCoordinates.latitude.toFixed(5)}, {addressCoordinates.longitude.toFixed(5)}</Text>}
              {address.trim() && <Button title={editingAddressId ? "Guardar cambios" : "Agregar dirección"} secondary onPress={() => void saveAddress()} />}
              <Button title="Listo" onPress={() => setSheet(null)} />
            </>}
            {sheet === "cart" && <>
              <Text style={styles.title}>Tu pedido</Text>
              <Text style={styles.subtitle}>{selected?.name ?? "Tu bolsa CercaGo"}</Text>
              {itemCount === 0 ? (
                <Text style={[styles.subtitle, { paddingVertical: 20, textAlign: "center" }]}>Tu bolsa está esperando algo delicioso.</Text>
              ) : products.filter((product) => cart[product.id]).map((product) => (
                <View key={product.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{product.name}</Text><Text style={styles.subtitle}>{formatDualPrice(product.price, exchangeRate)}</Text></View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable onPress={() => setCart((value) => {
                      const count = (value[product.id] ?? 0) - 1;
                      if (count <= 0) { const next = { ...value }; delete next[product.id]; return next; }
                      return { ...value, [product.id]: count };
                    })}><Text style={{ color: palette.orange, fontSize: 22, fontWeight: "900" }}>−</Text></Pressable>
                    <Text style={{ color: palette.ink, fontWeight: "900" }}>{cart[product.id]}</Text>
                    <Pressable onPress={() => setCart((value) => ({ ...value, [product.id]: value[product.id] + 1 }))}><Text style={{ color: palette.orange, fontSize: 22, fontWeight: "900" }}>＋</Text></Pressable>
                  </View>
                </View>
              ))}
              {itemCount > 0 && <>
                <Text style={styles.section}>Dirección de entrega</Text>
                {addresses.map((saved) => (
                  <Pressable key={saved.id} onPress={() => { setSelectedAddressId(saved.id); setAddress(""); }} style={{ padding: 12, borderRadius: 13, backgroundColor: selectedAddressId === saved.id ? "#FFF0EC" : "#F7F8FA" }}>
                    <Text style={{ color: palette.ink, fontWeight: "700" }}>{selectedAddressId === saved.id ? "✓  " : ""}{saved.label}: {saved.address_line}</Text>
                  </Pressable>
                ))}
                <TextInput placeholder="Usar otra dirección" value={address} onChangeText={(value) => { setAddress(value); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                  <Text style={{ color: palette.muted }}>Total · {selected?.free_delivery ? "delivery gratis" : `envío ${formatDualPrice(deliveryFee, exchangeRate)}`}</Text>
                  <Text style={{ color: palette.ink, fontWeight: "900" }}>{formatDualPrice(cartTotal + deliveryFee, exchangeRate)}</Text>
                </View>
                <Button title="Administrar direcciones" secondary onPress={() => setSheet("location")} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button title="Confirmar pedido" onPress={() => void placeOrder()} />
              </>}
            </>}
            {sheet === "notice" && <>
              <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: "#FFF0EC", alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8 }}>
                <Text style={{ fontSize: 28 }}>✦</Text>
              </View>
              <Text style={[styles.title, { textAlign: "center", marginTop: 6 }]}>{notice.title || "¡Todo cerca de ti!"}</Text>
              <Text style={[styles.subtitle, { textAlign: "center", marginVertical: 4 }]}>{notice.body || "Las novedades de tus pedidos aparecerán aquí."}</Text>
              {orders.slice(0, 3).map((order) => (
                <View key={order.id} style={{ padding: 13, backgroundColor: "#F7F8FA", borderRadius: 14, gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{order.store_name ?? "Tu pedido"}</Text><Text style={styles.subtitle}>{order.delivery_address}</Text></View>
                    <Text style={{ color: palette.orange, fontSize: 11, fontWeight: "900" }}>{statusLabel(order.status)}</Text>
                  </View>
                  {order.items?.map((item) => (
                    <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: palette.muted, flex: 1, fontSize: 12 }}>{item.quantity} × {item.productName}</Text>
                      {item.lineTotal != null && <Text style={{ color: palette.muted, fontSize: 12 }}>{formatDualPrice(item.lineTotal, order.exchange_rate ?? exchangeRate)}</Text>}
                    </View>
                  ))}
                  {order.subtotal != null && <Text style={{ color: palette.muted, fontSize: 11 }}>Subtotal: {formatDualPrice(order.subtotal, order.exchange_rate ?? exchangeRate)}</Text>}
                  {order.delivery_fee != null && <Text style={{ color: palette.muted, fontSize: 11 }}>Envío: {formatDualPrice(order.delivery_fee, order.exchange_rate ?? exchangeRate)}</Text>}
                  <Text style={{ color: palette.ink, fontWeight: "800" }}>{formatDualPrice(order.total, order.exchange_rate ?? exchangeRate)}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable onPress={() => setActiveChatOrder(order)}><Text style={{ color: palette.orange, fontSize: 12, fontWeight: "900" }}>Abrir chat</Text></Pressable>
                    {order.status === "delivered" && !order.has_review && <Pressable onPress={() => setReviewOrder(order)}><Text style={{ color: palette.green, fontSize: 12, fontWeight: "900" }}>Calificar</Text></Pressable>}
                  </View>
                </View>
              ))}
              <Button title="Entendido" onPress={() => setSheet(null)} />
            </>}
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(deleteAddressCandidate)} transparent animationType="fade" onRequestClose={() => setDeleteAddressCandidate(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#15192388" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 12 }}>
            <Text style={styles.title}>Eliminar dirección</Text>
            <Text style={styles.subtitle}>¿Quieres eliminar {deleteAddressCandidate?.label}?</Text>
            <Button title="Eliminar dirección" onPress={() => {
              const candidate = deleteAddressCandidate;
              setDeleteAddressCandidate(null);
              if (candidate) void deleteAddress(candidate);
            }} />
            <Button title="Cancelar" secondary onPress={() => setDeleteAddressCandidate(null)} />
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(reviewOrder)} transparent animationType="fade" onRequestClose={() => setReviewOrder(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#15192388" }}>
          <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#fff", borderRadius: 24, padding: 22, gap: 12 }}>
            <Text style={styles.title}>¿Cómo estuvo tu pedido?</Text>
            <Text style={styles.subtitle}>Califica a {reviewOrder?.store_name ?? "la tienda"} para ayudar a otros vecinos.</Text>
            <Text style={{ color: palette.ink, fontWeight: "800" }}>Comercio</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setStoreRating(value)}><Text style={{ fontSize: 32, color: value <= storeRating ? "#F5A623" : "#D0D5DD" }}>★</Text></Pressable>)}
            </View>
            <TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Comentario para el comercio (opcional)" multiline style={{ minHeight: 76, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 13, padding: 12, textAlignVertical: "top" }} />
            {reviewOrder?.driver_id && <>
              <Text style={{ color: palette.ink, fontWeight: "800" }}>Repartidor (opcional)</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setDriverRating(value)}><Text style={{ fontSize: 28, color: value <= driverRating ? "#F5A623" : "#D0D5DD" }}>★</Text></Pressable>)}
              </View>
              <TextInput value={driverComment} onChangeText={setDriverComment} placeholder="Comentario para el repartidor (opcional)" multiline style={{ minHeight: 64, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 13, padding: 12, textAlignVertical: "top" }} />
            </>}
            <Button title="Enviar reseña" onPress={() => void submitReview()} />
            <Button title="Más tarde" secondary onPress={() => setReviewOrder(null)} />
          </View>
        </View>
      </Modal>
      <OrderChatSheet order={activeChatOrder} role="customer" onClose={() => setActiveChatOrder(null)} />
      <LocationPicker
        visible={locationPickerVisible}
        initialCoordinates={addressCoordinates}
        onClose={() => setLocationPickerVisible(false)}
        onSelect={(coordinates, addressLabel) => {
          setAddressCoordinates(coordinates);
          if (addressLabel) setAddress(addressLabel);
          setSelectedAddressId("");
        }}
      />
    </View>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    placed: "Recibido",
    accepted: "Aceptado",
    preparing: "Preparando",
    ready: "Listo para retirar",
    picked_up: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}
