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
import type { Category, Order, Product, Store } from "../types";
import { socket } from "./socketRef";

type Address = { id: string; label: string; address_line: string };
type Sheet = "location" | "cart" | "notice" | null;

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
  Restaurantes: { icon: "🍽️", color: "#FFF0E8" },
  Supermercados: { icon: "🥑", color: "#EDF7E9" },
  Farmacias: { icon: "💊", color: "#EAF4FF" },
  Tiendas: { icon: "🛍️", color: "#F5EDFF" },
  Cafeterías: { icon: "☕", color: "#FFF4DD" },
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
          <Text style={{ fontSize: 26 }}>{category.name === "Todo" ? "✦" : visual.icon}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: selected ? palette.orange : "#565C67", fontSize: 11, fontWeight: selected ? "800" : "600" }}>
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function StoreCard({ store, onPress }: { store: Store; onPress: () => void }) {
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
        {fee === 0 && <Text style={{ color: "#fff", alignSelf: "flex-start", backgroundColor: palette.green, overflow: "hidden", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, fontSize: 11, fontWeight: "900" }}>ENVÍO GRATIS</Text>}
      </ImageBackground>
      <View style={{ padding: 14, gap: 9 }}>
        <Text numberOfLines={1} style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>{store.name}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: palette.muted, fontSize: 12 }}>◷ {store.estimated_delivery_minutes ?? 30}–{(store.estimated_delivery_minutes ?? 30) + 10} min</Text>
          <Text style={{ color: fee === 0 ? palette.green : palette.muted, fontSize: 12, fontWeight: "800" }}>
            {fee === 0 ? "Envío gratis" : `Envío $${fee.toFixed(2)}`}
          </Text>
        </View>
        {store.distance_km != null && <Text style={{ color: "#9398A2", fontSize: 11 }}>{Number(store.distance_km).toFixed(1)} km · {store.address}</Text>}
      </View>
    </Pressable>
  );
}

export function CustomerScreen() {
  const { session } = useAuth();
  const token = session!.token;
  const { width: screenWidth } = useWindowDimensions();
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollViewInstance | null>(null);
  const bannerWidth = Math.min(screenWidth - 40, 840);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartTotal = products.reduce((sum, product) => sum + Number(product.price) * (cart[product.id] ?? 0), 0);

  const refreshOrders = useCallback(async () => {
    try { setOrders(await api<Order[]>("/orders", token)); }
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
        if (savedAddresses[0]) setSelectedAddressId(savedAddresses[0].id);
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
      await api("/orders", token, {
        method: "POST",
        body: JSON.stringify({ storeId: selected.id, ...(selectedAddressId ? { addressId: selectedAddressId } : { deliveryAddress: address }), items }),
      });
      setSelected(null);
      setCart({});
      setSelectedAddressId("");
      setSheet(null);
      await refreshOrders();
      setNotice({ title: "¡Pedido enviado!", body: "El comercio ya recibió tu pedido. Te avisaremos cuando lo acepte." });
      setSheet("notice");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el pedido");
      setSheet("cart");
    }
  }

  async function saveAddress() {
    if (!address.trim()) return setError("Escribe una dirección antes de guardarla.");
    try {
      const saved = await api<Address>("/addresses", token, {
        method: "POST",
        body: JSON.stringify({ label: "Casa", addressLine: address }),
      });
      setAddresses((current) => [saved, ...current]);
      setSelectedAddressId(saved.id);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la dirección"); }
  }

  async function findNearby() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Permite el acceso a la ubicación para ordenar los comercios por cercanía.");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const params = new URLSearchParams({ latitude: String(current.coords.latitude), longitude: String(current.coords.longitude) });
      setStores(await api<Store[]>(`/stores?${params.toString()}`));
      setNearbyEnabled(true);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación"); }
  }

  if (busy) return <Loading />;
  const visibleStores = stores.filter((store) => {
    const matchesText = `${store.name} ${store.category_name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || store.category_id === selectedCategory;
    return matchesText && matchesCategory;
  });
  const popular = [...visibleStores].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const freeDelivery = visibleStores.filter((store) => Number(store.delivery_fee ?? 2.99) === 0);
  const newest = [...visibleStores].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 16, paddingBottom: 112 }]} keyboardShouldPersistTaps="handled">
        {error ? <Pressable onPress={() => setError("")}><Text style={styles.error}>{error}  ×</Text></Pressable> : null}
        {selected ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => { setSelected(null); setError(""); }} style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>‹  Volver</Text>
              </Pressable>
              <Text style={{ color: palette.muted, fontWeight: "700" }}>MENÚ DEL COMERCIO</Text>
            </View>
            <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#E7E8E7" }}>
              <ImageBackground source={{ uri: selected.image_url ?? promotions[0].image }} style={{ height: 210, justifyContent: "flex-end", padding: 18 }}>
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
                    <Text style={{ color: palette.ink, fontWeight: "900" }}>${Number(product.price).toFixed(2)}</Text>
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
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Pressable onPress={() => setSheet("location")} style={{ flex: 1, flexDirection: "row", gap: 11, alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "#FFE9E2", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 19 }}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#9398A2", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>ENTREGAR EN</Text>
                  <Text numberOfLines={1} style={{ color: palette.ink, fontSize: 14, fontWeight: "900", marginTop: 2 }}>
                    {addresses.find((item) => item.id === selectedAddressId)?.address_line ?? addresses[0]?.address_line ?? "Elige tu dirección"}  ⌄
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setSheet("notice")} style={{ width: 44, height: 44, backgroundColor: "#fff", borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20 }}>♧</Text>
              </Pressable>
            </View>

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
                <Pressable key={promo.title} onPress={() => { setSearch(index === 1 ? "Café" : ""); setSelectedCategory(""); }} style={{ width: bannerWidth }}>
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
                <Pressable key={promo.title} onPress={() => {
                  setBannerIndex(index);
                  bannerRef.current?.scrollTo({ x: (bannerWidth + 12) * index, animated: true });
                }}>
                  <View style={{ width: bannerIndex === index ? 20 : 6, height: 6, borderRadius: 4, backgroundColor: bannerIndex === index ? palette.orange : "#DADDE2" }} />
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.section}>¿Qué buscamos?</Text>
              <Pressable onPress={() => void findNearby()}><Text style={{ color: palette.orange, fontWeight: "800", fontSize: 12 }}>{nearbyEnabled ? "Cerca de ti ✓" : "Ver cercanos"}</Text></Pressable>
            </View>
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
              {popular.map((store) => <StoreCard key={store.id} store={store} onPress={() => void openStore(store)} />)}
            </ScrollView>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <View><Text style={styles.section}>Envío gratis</Text><Text style={styles.subtitle}>Hoy invitan ellos 🚲</Text></View>
              <Text style={{ color: palette.green, fontWeight: "800", fontSize: 12 }}>Sin costo</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 4 }}>
              {freeDelivery.length
                ? freeDelivery.map((store) => <StoreCard key={store.id} store={store} onPress={() => void openStore(store)} />)
                : <Text style={[styles.subtitle, { padding: 16 }]}>Las promociones de envío gratis aparecerán aquí.</Text>}
            </ScrollView>

            <View style={{ marginTop: 8 }}><Text style={styles.section}>Nuevos comercios</Text><Text style={styles.subtitle}>Descubre quién llegó al barrio</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingVertical: 4 }}>
              {newest.map((store) => <StoreCard key={store.id} store={store} onPress={() => void openStore(store)} />)}
            </ScrollView>

            <View style={{ backgroundColor: "#FFF0EC", padding: 18, borderRadius: 20, marginTop: 8 }}>
              <Text style={{ fontSize: 22 }}>💛</Text>
              <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 16, marginTop: 6 }}>Cada pedido apoya a alguien cerca</Text>
              <Text style={[styles.subtitle, { marginTop: 4 }]}>Gracias por elegir los comercios de tu comunidad.</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFFF5", borderTopWidth: 1, borderTopColor: "#ECEEF1", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: "row", justifyContent: "space-around" }}>
        <Pressable onPress={() => { setSelected(null); setError(""); }} style={{ alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 20, color: palette.orange }}>⌂</Text><Text style={{ color: palette.orange, fontSize: 10, fontWeight: "900" }}>INICIO</Text>
        </Pressable>
        <Pressable onPress={() => { setSelected(null); setSheet("notice"); setNotice({ title: "Tus pedidos", body: orders.length ? `${orders.length} pedidos recientes. Revisa sus estados en la lista.` : "Aún no tienes pedidos. ¡Descubre algo rico cerca de ti!" }); }} style={{ alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 19, color: palette.muted }}>▤</Text><Text style={{ color: palette.muted, fontSize: 10, fontWeight: "800" }}>PEDIDOS</Text>
        </Pressable>
        <Pressable onPress={() => setSheet("cart")} style={{ alignItems: "center", gap: 3 }}>
          <View><Text style={{ fontSize: 20, color: palette.muted }}>▱</Text>{itemCount > 0 && <View style={{ position: "absolute", right: -9, top: -4, backgroundColor: palette.orange, borderRadius: 10, paddingHorizontal: 5 }}><Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{itemCount}</Text></View>}</View>
          <Text style={{ color: palette.muted, fontSize: 10, fontWeight: "800" }}>MI BOLSA</Text>
        </Pressable>
      </View>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
          <Pressable onPress={() => setSheet(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ width: "100%", maxWidth: 560, maxHeight: "82%", alignSelf: "center", backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, gap: 12 }}>
            <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: "#D9DCE2", alignSelf: "center", marginBottom: 4 }} />
            {sheet === "location" && <>
              <Text style={styles.title}>¿A dónde lo llevamos?</Text>
              <Text style={styles.subtitle}>Elige una dirección guardada o escribe otra.</Text>
              {addresses.map((saved) => (
                <Pressable key={saved.id} onPress={() => { setSelectedAddressId(saved.id); setAddress(""); setSheet(null); }} style={{ padding: 14, borderRadius: 15, backgroundColor: selectedAddressId === saved.id ? "#FFF0EC" : "#F7F8FA", flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: palette.ink, fontWeight: "700" }}>⌂  {saved.label} · {saved.address_line}</Text>
                  {selectedAddressId === saved.id && <Text style={{ color: palette.orange }}>✓</Text>}
                </Pressable>
              ))}
              <TextInput placeholder="Calle, número, ciudad" value={address} onChangeText={(value) => { setAddress(value); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14 }} />
              {address.trim() && <Button title="Guardar esta dirección" secondary onPress={() => void saveAddress()} />}
              <Button title="Listo" onPress={() => setSheet(null)} />
            </>}
            {sheet === "cart" && <>
              <Text style={styles.title}>Tu pedido</Text>
              <Text style={styles.subtitle}>{selected?.name ?? "Tu bolsa CercaGo"}</Text>
              {itemCount === 0 ? (
                <Text style={[styles.subtitle, { paddingVertical: 20, textAlign: "center" }]}>Tu bolsa está esperando algo delicioso.</Text>
              ) : products.filter((product) => cart[product.id]).map((product) => (
                <View key={product.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{product.name}</Text><Text style={styles.subtitle}>${Number(product.price).toFixed(2)}</Text></View>
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
                  <Text style={{ color: palette.muted }}>Subtotal · envío desde $2.99</Text><Text style={{ color: palette.ink, fontWeight: "900" }}>${(cartTotal + 2.99).toFixed(2)}</Text>
                </View>
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
                <View key={order.id} style={{ padding: 13, backgroundColor: "#F7F8FA", borderRadius: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{order.store_name ?? "Tu pedido"}</Text><Text style={styles.subtitle}>{order.delivery_address}</Text></View>
                  <Text style={{ color: palette.orange, fontSize: 11, fontWeight: "900" }}>{statusLabel(order.status)}</Text>
                </View>
              ))}
              <Button title="Entendido" onPress={() => setSheet(null)} />
            </>}
          </View>
        </View>
      </Modal>
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
