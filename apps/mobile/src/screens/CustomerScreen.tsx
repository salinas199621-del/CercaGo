import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  Linking,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, Bike, Carrot, Clock3, Croissant, House, MapPin, Menu, Pill, Search, ShoppingBag, Shapes, Store as StoreIcon, Trash2, Utensils, Wrench, type LucideIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "../location";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { colorOptions, themeOptions, useAppearance } from "../appearance";
import { Button, Card, Field, Loading, styles } from "../components/UI";
import { ExchangeRateBadge } from "../components/ExchangeRateBadge";
import { CustomerDrawer, type DrawerItem } from "../components/CustomerDrawer";
import { CercaGoLogo } from "../components/CercaGoLogo";
import { Avatar, illustratedAvatars } from "../components/Avatar";
import { ProfilePhotoPicker } from "../components/ProfilePhotoPicker";
import { PromotionBanner } from "../components/PromotionBanner";
import { ExternalAdMedia } from "../components/ExternalAdMedia";
import { LocationPicker } from "../components/LocationPicker";
import type { LocationCoordinates } from "../components/LocationPickerMap";
import { OrderChatSheet } from "../components/OrderChatSheet";
import { CustomerInboxSheet, type OrderNotice } from "../components/CustomerInboxSheet";
import { formatDualPrice } from "../currency";
import { defaultPromotions, parsePromotions, type Promotion } from "../promotions";
import { parseSponsoredAds, type SponsoredAd } from "../externalAds";
import type { Address, Category, Order, Product, Store } from "../types";
import { socket } from "./socketRef";

type Sheet = "profile" | "location" | "cart" | "notice" | "rate" | "settings" | null;
type CustomerTab = "home" | "orders";
const notificationsStorageKey = "cercago-notifications-enabled";
const profileAvatarStoragePrefix = "cercago-profile-avatar-v1:";
const orderNoticesStoragePrefix = "cercago-order-notices-v1:";

type StoreCoupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string | number;
  usage_limit: number | null;
  used_count: number;
  required_completed_orders: number;
};
type AppliedCoupon = { code: string; discountAmount: string; discountType: "percent" | "fixed"; discountValue: number };

type HomeCategoryGroup = { key: string; name: string; aliases: string[]; icon: LucideIcon; color: string; iconColor: string };
const primaryCategoryGroups: HomeCategoryGroup[] = [
  { key: "supermarkets", name: "Supermercados", aliases: ["supermercado", "supermercados"], icon: Carrot, color: "#FFF3DD", iconColor: "#D98300" },
  { key: "minimarkets", name: "Bodegas", aliases: ["bodega", "bodegas", "minimarket", "minimarkets", "minimercado", "minimercados", "bodega / minimarket", "bodegas / minimarkets", "bodegas y minimarkets"], icon: StoreIcon, color: "#E5F8F1", iconColor: "#07896A" },
  { key: "pharmacies", name: "Farmacias", aliases: ["farmacia", "farmacias"], icon: Pill, color: "#EAF2FF", iconColor: "#3878D4" },
  { key: "restaurants", name: "Restaurantes", aliases: ["restaurante", "restaurantes", "comida", "comidas", "comida rapida", "fast food", "comida rapida / restaurantes", "restaurantes / comida rapida", "comida rapida y restaurantes", "restaurantes y comida rapida"], icon: Utensils, color: "#FFF0E8", iconColor: "#E56A3A" },
  { key: "hardware", name: "Repuestos", aliases: ["repuesto", "repuestos", "ferreteria", "ferreterias", "ferreteria / repuestos", "repuestos / ferreteria", "ferreteria y repuestos", "repuestos y ferreteria"], icon: Wrench, color: "#F0EBFF", iconColor: "#7653C6" },
  { key: "cafes-bakeries", name: "Cafeterías", aliases: ["cafeteria", "cafeterias", "cafe", "cafes", "panaderia", "panaderias", "cafeteria / panaderia", "cafeterias / panaderias", "panaderias / cafeterias"], icon: Croissant, color: "#FFF4DD", iconColor: "#A86B2D" },
  { key: "shops", name: "Tiendas", aliases: ["tienda", "tiendas", "miscelanea", "miscelaneas", "tiendas y miscelaneas", "tiendas / miscelaneas"], icon: ShoppingBag, color: "#FDEDF5", iconColor: "#CE4A8B" },
];

function normalizeCategoryName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function storeHasFreeDelivery(store: Store) {
  const fee = Number(store.delivery_fee);
  return store.free_delivery === true || (Number.isFinite(fee) && fee <= 0);
}

function categoryGroupKey(name: string, id: string) {
  const normalizedName = normalizeCategoryName(name);
  return primaryCategoryGroups.find((group) => group.aliases.includes(normalizedName))?.key ?? `extra:${id}`;
}

function CategoryItem({ category, selected, onPress }: {
  category: HomeCategoryGroup;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppearance();
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: Platform.OS !== "web", speed: 35, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 30, bounciness: 5 }).start()}
    >
      <Animated.View style={{ alignItems: "center", gap: 7, width: 78, minHeight: 98, transform: [{ scale }] }}>
        <View style={{
          width: 58, height: 58, borderRadius: 20,
          backgroundColor: selected ? theme.soft : category.color,
          borderWidth: selected ? 2 : 1, borderColor: selected ? category.iconColor : theme.border,
          alignItems: "center", justifyContent: "center",
        }}>
          <category.icon size={25} color={category.iconColor} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={2} style={{ color: selected ? theme.primaryDark : theme.ink, fontSize: 10, lineHeight: 13, fontWeight: selected ? "800" : "600", textAlign: "center", minHeight: 26, width: "100%" }}>
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function StoreCard({ store, exchangeRate, onPress, cardWidth }: {
  store: Store; exchangeRate: number | null; onPress: () => void; cardWidth: number;
}) {
  const { theme } = useAppearance();
  const ratingValue = Number(store.rating ?? 0);
  const rating = ratingValue > 0 ? ratingValue.toFixed(1) : "Nuevo";
  const fee = Number(store.delivery_fee ?? 2.99);
  const feeInBolivars = Number(exchangeRate) > 0
    ? new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fee * Number(exchangeRate))
    : null;
  const freeDelivery = storeHasFreeDelivery(store);
  const deliveryMinutes = store.estimated_delivery_minutes ?? 30;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({
      width: cardWidth, minWidth: 0, minHeight: 96, flexDirection: "row", alignItems: "center", gap: 11,
      padding: 10, backgroundColor: theme.surface, borderRadius: 16, overflow: "hidden",
      borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.94 : 1,
      shadowColor: "#151927", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
      transform: [{ scale: pressed ? 0.985 : 1 }],
    })}>
      <Image
        source={{ uri: store.image_url ?? defaultPromotions[0].mediaUrl }}
        style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 14, backgroundColor: theme.soft }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center", gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: theme.muted, fontSize: 10, fontWeight: "700" }}>{store.category_name ?? "Comercio local"}</Text>
          <Text numberOfLines={1} style={{ color: "#C17B00", backgroundColor: "#FFF7DF", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, lineHeight: 13, fontWeight: "900" }}>
            {ratingValue > 0 ? `★ ${rating}` : rating}
          </Text>
        </View>
        <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.ink, fontSize: 14, lineHeight: 18, fontWeight: "900" }}>{store.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Bike size={14} color={freeDelivery ? (theme.darkMode ? "#4ADE80" : "#168653") : theme.muted} strokeWidth={2.3} />
            <Text numberOfLines={1} style={{ color: freeDelivery ? (theme.darkMode ? "#4ADE80" : "#168653") : theme.muted, fontSize: 10, fontWeight: "800" }}>
              {freeDelivery ? "Delivery gratis" : `Envío $${fee.toFixed(2)}`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock3 size={13} color={theme.muted} strokeWidth={2} />
            <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10, fontWeight: "700" }}>{deliveryMinutes}–{deliveryMinutes + 10} min</Text>
          </View>
        </View>
        {feeInBolivars && !freeDelivery && (
          <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10, lineHeight: 13 }}>Delivery Bs. {feeInBolivars}</Text>
        )}
        {store.distance_km != null && (
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.muted, fontSize: 10, lineHeight: 13 }}>
            {Number(store.distance_km).toFixed(1)} km · {store.address}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function SponsoredAdCard({ ad, variant, onPress, onDismiss }: {
  ad: SponsoredAd;
  variant: "banner" | "floating";
  onPress: () => void;
  onDismiss?: () => void;
}) {
  const { theme } = useAppearance();
  const height = variant === "floating" ? 108 : 132;
  return (
    <View style={{
      height,
      width: variant === "floating" ? "100%" : undefined,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: theme.primaryDark,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 5,
    }}>
      {ad.mediaType === "video" ? (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <ExternalAdMedia ad={ad} onPress={onPress} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#091A20A8" }} />
          <View pointerEvents="none" style={{ padding: 14, paddingRight: onDismiss ? 52 : 14 }}>
            <Text numberOfLines={1} style={{ color: "#FFFFFFD9", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }}>PATROCINADO</Text>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: variant === "floating" ? 15 : 17, fontWeight: "900", marginTop: 3 }}>{ad.brandName}</Text>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Publicidad patrocinada de ${ad.brandName}`} onPress={onPress} style={{ flex: 1, justifyContent: "flex-end" }}>
          <ExternalAdMedia ad={ad} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#091A20A8" }} />
          <View pointerEvents="none" style={{ padding: 14, paddingRight: onDismiss ? 52 : 14 }}>
          <Text numberOfLines={1} style={{ color: "#FFFFFFD9", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }}>PATROCINADO</Text>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: variant === "floating" ? 15 : 17, fontWeight: "900", marginTop: 3 }}>{ad.brandName}</Text>
          </View>
        </Pressable>
      )}
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar publicidad patrocinada"
          onPress={onDismiss}
          style={{ position: "absolute", right: 8, top: 8, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#111827B8" }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 23 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

export function CustomerScreen() {
  const { session, signOut, updateProfile, exchangeRate, exchangeRateValueDate, exchangeRateFallback } = useAuth();
  const { theme, darkMode, accentColor, headerColor, setTheme, setDarkMode, setAccentColor, setHeaderColor } = useAppearance();
  const palette = {
    ink: theme.ink,
    muted: theme.muted,
    orange: theme.primaryDark,
    brand: theme.primary,
    brandDark: theme.primaryDark,
    background: theme.background,
    green: darkMode ? "#4ADE80" : "#23824E",
  };
  const token = session!.token;
  const customerOrdersEndpoint = session!.user.role === "customer" ? "/orders" : "/orders?scope=customer";
  const { width: screenWidth } = useWindowDimensions();
  const storeCardWidth = Math.max(0, Math.min(840, screenWidth - 40));
  const logoWidth = Math.min(120, Math.max(42, screenWidth - 295));
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<StoreCoupon[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileName, setProfileName] = useState(session!.user.name);
  const [profileEmail, setProfileEmail] = useState(session!.user.email);
  const [profilePhone, setProfilePhone] = useState(session!.user.phone ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [orderNotifications, setOrderNotifications] = useState<OrderNotice[]>([]);
  const [orderNotificationsLoaded, setOrderNotificationsLoaded] = useState(false);
  const [inboxVisible, setInboxVisible] = useState(false);
  const [inboxInitialTab, setInboxInitialTab] = useState<"orders" | "promotions" | "messages">("orders");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [usdAmount, setUsdAmount] = useState("");
  const [vesAmount, setVesAmount] = useState("");
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [storeRating, setStoreRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [bannerIndex, setBannerIndex] = useState(0);
  const [promotions, setPromotions] = useState<Promotion[]>(defaultPromotions);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAd[]>([]);
  const [dismissedSplashAdIds, setDismissedSplashAdIds] = useState<string[]>([]);
  const [floatingAdDismissed, setFloatingAdDismissed] = useState(false);
  const [splashCloseAllowed, setSplashCloseAllowed] = useState(false);
  const [splashCloseCountdown, setSplashCloseCountdown] = useState(10);
  const bannerRef = useRef<ScrollViewInstance | null>(null);
  const pageScrollRef = useRef<ScrollViewInstance | null>(null);
  const [storeSectionY, setStoreSectionY] = useState(0);
  const splashTimerAd = activeTab === "home" && !selected
    ? sponsoredAds.find((ad) => ad.position === "startup_splash" && !dismissedSplashAdIds.includes(ad.id))
    : undefined;
  const bannerWidth = Math.min(screenWidth - 40, 840);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartTotal = products.reduce((sum, product) => sum + Number(product.price) * (cart[product.id] ?? 0), 0);
  const unreadOrderCount = orderNotifications.filter((item) => !item.read).length;
  const searchTerm = search.trim().toLowerCase();
  const storeSuggestions = searchTerm
    ? stores.filter((store) => `${store.name} ${store.category_name ?? ""}`.toLowerCase().includes(searchTerm)).slice(0, 3)
    : [];
  const categorySuggestions = searchTerm
    ? categories.filter((category) => category.name.toLowerCase().includes(searchTerm)).slice(0, 2)
    : [];
  useEffect(() => {
    setSplashCloseAllowed(false);
    setSplashCloseCountdown(10);
    if (!splashTimerAd) return;

    let remaining = 10;
    const timer = setInterval(() => {
      remaining -= 1;
      setSplashCloseCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setSplashCloseAllowed(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [splashTimerAd?.id]);
  const extraCategoryGroups: HomeCategoryGroup[] = categories
    .filter((category) => categoryGroupKey(category.name, category.id).startsWith("extra:"))
    .map((category) => ({
      key: `extra:${category.id}`,
      name: category.name,
      aliases: [normalizeCategoryName(category.name)],
      icon: StoreIcon,
      color: "#F0F1F4",
      iconColor: "#667085",
    }));
  const categoryTiles: HomeCategoryGroup[] = [
    { key: "", name: "Todos", aliases: [], icon: Shapes, color: "#EEF0F4", iconColor: "#667085" },
    ...primaryCategoryGroups,
    ...extraCategoryGroups,
  ];

  useEffect(() => {
    if (!exchangeRate) {
      setUsdAmount("");
      setVesAmount("");
    } else if (usdAmount.trim()) {
      const amount = Number(usdAmount.replace(",", "."));
      setVesAmount(Number.isFinite(amount) ? (amount * exchangeRate).toFixed(2) : "");
    } else if (vesAmount.trim()) {
      const amount = Number(vesAmount.replace(",", "."));
      setUsdAmount(Number.isFinite(amount) ? (amount / exchangeRate).toFixed(2) : "");
    }
  }, [exchangeRate]);

  const refreshOrders = useCallback(async () => {
    try {
      const recent = await api<Order[]>(customerOrdersEndpoint, token);
      setOrders(recent);
      setActiveChatOrder((current) => current ? recent.find((item) => item.id === current.id) ?? current : null);
      setReviewOrder((current) => current ?? recent.find((item) => item.status === "delivered" && !item.has_review) ?? null);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Error cargando pedidos"); }
  }, [customerOrdersEndpoint, token]);

  useEffect(() => {
    Promise.all([
      api<Store[]>("/stores"),
      api<Order[]>(customerOrdersEndpoint, token),
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
  }, [customerOrdersEndpoint, token]);

  useEffect(() => {
    AsyncStorage.getItem(notificationsStorageKey)
      .then((saved) => { if (saved !== null) setNotificationsEnabled(saved === "true"); })
      .catch((reason) => console.error("No se pudo cargar la preferencia de notificaciones", reason));
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(`${orderNoticesStoragePrefix}${session!.user.id}`)
      .then((saved) => {
        if (!active || !saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setOrderNotifications(parsed as OrderNotice[]);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las notificaciones guardadas."))
      .finally(() => { if (active) setOrderNotificationsLoaded(true); });
    return () => { active = false; };
  }, [session!.user.id]);

  useEffect(() => {
    if (!orderNotificationsLoaded) return;
    AsyncStorage.setItem(`${orderNoticesStoragePrefix}${session!.user.id}`, JSON.stringify(orderNotifications))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron guardar las notificaciones."));
  }, [orderNotifications, orderNotificationsLoaded, session!.user.id]);

  useEffect(() => {
    let active = true;
    async function loadPromotions() {
      try {
        const result = await api<{ promotions: Promotion[] | null }>("/promotions");
        const configured = result.promotions === null ? defaultPromotions : parsePromotions(result.promotions);
        if (active) {
          setPromotions(configured);
          setBannerIndex(0);
        }
      } catch (reason) {
        console.error("No se pudo cargar la configuración de anuncios; se conservarán los anuncios integrados.", reason);
      }
    }
    void loadPromotions();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshSponsoredAds() {
      try {
        const result = await api<{ ads: unknown }>("/external-ads");
        const configured = parseSponsoredAds(result.ads).filter((ad) => ad.active);
        if (active) setSponsoredAds(configured);
      } catch (reason) {
        console.error("No se pudo actualizar la publicidad externa.", reason);
      }
    }
    const handleAdsUpdated = () => { void refreshSponsoredAds(); };
    void refreshSponsoredAds();
    socket?.on("external-ads:updated", handleAdsUpdated);
    const refreshTimer = setInterval(handleAdsUpdated, 60_000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
      socket?.off("external-ads:updated", handleAdsUpdated);
    };
  }, []);

  useEffect(() => {
    setProfileName(session!.user.name);
    setProfileEmail(session!.user.email);
    setProfilePhone(session!.user.phone ?? "");
  }, [session!.user.name, session!.user.email, session!.user.phone]);

  useEffect(() => {
    AsyncStorage.getItem(`${profileAvatarStoragePrefix}${session!.user.id}`)
      .then(setProfileAvatar)
      .catch((reason) => console.error("No se pudo cargar la foto de perfil", reason));
  }, [session!.user.id]);

  async function saveProfileAvatar(value: string) {
    setProfileAvatar(value);
    try {
      await AsyncStorage.setItem(`${profileAvatarStoragePrefix}${session!.user.id}`, value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la foto de perfil.");
    }
  }

  useEffect(() => {
    const changed = (order?: Order) => {
      if (order) {
        const id = `${order.id}:${order.status}`;
        setOrderNotifications((current) => current.some((item) => item.id === id) ? current : [{
          id,
          title: `${order.store_name ?? "Tu pedido"}: ${statusLabel(order.status)}`,
          body: "Toca para ver el estado y conversar con el comercio.",
          orderId: order.id,
          createdAt: new Date().toISOString(),
          read: false,
        }, ...current].slice(0, 100));
        if (notificationsEnabled) {
          setNotice({ title: "Tu pedido se actualizó", body: statusLabel(order.status) });
          setSheet("notice");
        }
      }
      void refreshOrders();
    };
    socket?.on("order:status", changed);
    socket?.on("delivery:assigned", changed);
    return () => { socket?.off("order:status", changed); socket?.off("delivery:assigned", changed); };
  }, [notificationsEnabled, refreshOrders]);

  useEffect(() => {
    if (!promotions.length) return;
    const timer = setInterval(() => {
      setBannerIndex((current) => {
        const next = (current + 1) % promotions.length;
        bannerRef.current?.scrollTo({ x: (bannerWidth + 12) * next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerWidth, promotions.length]);

  async function openStore(store: Store) {
    setSelected(store);
    setCart({});
    setAvailableCoupons([]);
    setCouponCode("");
    setAppliedCoupon(null);
    setProducts([]);
    setProductsLoading(true);
    setError("");
    try {
      setProducts(await api<Product[]>(`/stores/${store.id}/products`));
      try { setAvailableCoupons(await api<StoreCoupon[]>(`/stores/${store.id}/coupons`)); }
      catch (reason) { setError(reason instanceof Error ? `No se pudieron cargar los cupones: ${reason.message}` : "No se pudieron cargar los cupones."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir el comercio"); }
    finally { setProductsLoading(false); }
  }

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cart, selected?.id]);

  async function applyCoupon() {
    if (!selected) return setError("Abre un comercio antes de aplicar un cupón.");
    if (!couponCode.trim()) return setError("Escribe el código del cupón.");
    const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));
    if (!items.length) return setError("Agrega productos antes de aplicar un cupón.");
    setCouponApplying(true);
    setError("");
    try {
      const result = await api<AppliedCoupon & { subtotal: string }>(`/stores/${selected.id}/coupons/validate`, token, {
        method: "POST",
        body: JSON.stringify({ code: couponCode.trim(), items }),
      });
      setCouponCode(result.code);
      setAppliedCoupon(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo validar el cupón."); }
    finally { setCouponApplying(false); }
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
        body: JSON.stringify({
          storeId: selected.id,
          ...(selectedAddressId ? { addressId: selectedAddressId } : { deliveryAddress: [address, city].filter(Boolean).join(", ") }),
          items,
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        }),
      });
      setSelected(null);
      setCart({});
      setCouponCode("");
      setAppliedCoupon(null);
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
          addressLine: [address, city].filter(Boolean).join(", "),
          latitude: addressCoordinates?.latitude ?? null,
          longitude: addressCoordinates?.longitude ?? null,
        }),
      });
      setAddresses((current) => editingAddressId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      setSelectedAddressId(saved.id);
      setAddress("");
      setCity("");
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

  async function saveProfile() {
    if (profileName.trim().length < 2) {
      setError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      setError("Escribe un correo electrónico válido.");
      return;
    }
    const digits = profilePhone.replace(/\D/g, "");
    const nationalPhone = digits.startsWith("58") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
    if (nationalPhone && nationalPhone.length !== 10) {
      setError("El teléfono debe tener 10 dígitos después del prefijo +58.");
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile(profileName, profileEmail, nationalPhone ? `+58${nationalPhone}` : null);
      setProfileEditing(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el perfil");
    } finally {
      setProfileSaving(false);
    }
  }

  async function toggleNotifications() {
    const next = !notificationsEnabled;
    try {
      await AsyncStorage.setItem(notificationsStorageKey, String(next));
      setNotificationsEnabled(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la preferencia");
    }
  }

  function handleDrawerSelect(item: DrawerItem) {
    setDrawerVisible(false);
    setError("");
    if (item === "home") {
      setActiveTab("home");
      setSelected(null);
    } else if (item === "orders") {
      setActiveTab("orders");
      setSelected(null);
    } else if (item === "addresses") {
      setSheet("location");
    } else if (item === "rate") {
      setSheet("rate");
    } else if (item === "cart") {
      setSheet("cart");
    } else if (item === "messages") {
      setInboxInitialTab("messages");
      setInboxVisible(true);
    } else {
      setSheet("settings");
    }
  }

  const markOrderNotificationsRead = useCallback(() => {
    setOrderNotifications((current) => current.map((item) => item.read ? item : { ...item, read: true }));
  }, []);

  function updateUsdAmount(value: string) {
    setUsdAmount(value);
    if (!value.trim()) return setVesAmount("");
    const amount = Number(value.replace(",", "."));
    setVesAmount(exchangeRate && Number.isFinite(amount) ? (amount * exchangeRate).toFixed(2) : "");
  }

  function updateVesAmount(value: string) {
    setVesAmount(value);
    if (!value.trim()) return setUsdAmount("");
    const amount = Number(value.replace(",", "."));
    setUsdAmount(exchangeRate && Number.isFinite(amount) ? (amount / exchangeRate).toFixed(2) : "");
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
    setSelectedCategory(category ? categoryGroupKey(category.name, category.id) : "");
    setSearch(category ? "" : index === 1 ? "café" : index === 2 ? "mercado" : "comida");
    setSelected(null);
    setActiveTab("home");
    requestAnimationFrame(() => pageScrollRef.current?.scrollTo({ y: storeSectionY, animated: true }));
  }

  function openPromotion(promotion: Promotion, index: number) {
    if (!promotion.linkUrl) {
      explorePromotion(index);
      return;
    }
    void Linking.openURL(promotion.linkUrl).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir la promoción.");
    });
  }

  function openSponsoredAd(ad: SponsoredAd) {
    if (!ad.destinationUrl) return;
    void Linking.openURL(ad.destinationUrl).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir el enlace de la marca.");
    });
  }

  if (busy) return <Loading />;
  const visibleStores = stores.filter((store) => {
    const matchesText = `${store.name} ${store.category_name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const categoryGroup = categoryTiles.find((item) => item.key === selectedCategory);
    const matchesCategory = !selectedCategory || Boolean(
      categoryGroup && store.category_name && categoryGroup.aliases.includes(normalizeCategoryName(store.category_name)),
    );
    return matchesText && matchesCategory;
  });
  const popular = nearbyEnabled
    ? visibleStores
    : [...visibleStores].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const freeDelivery = visibleStores.filter(storeHasFreeDelivery);
  const newest = [...visibleStores].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const deliveryFee = selected && storeHasFreeDelivery(selected) ? 0 : Number(selected?.delivery_fee ?? 2.99);
  const isCustomerHome = activeTab === "home" && !selected;
  const splashSponsoredAd = isCustomerHome
    ? splashTimerAd
    : undefined;
  const floatingSponsoredAd = isCustomerHome && !floatingAdDismissed
    ? sponsoredAds.find((ad) => ad.position === "floating_home")
    : undefined;
  const categorySponsoredAds = isCustomerHome
    ? sponsoredAds.filter((ad) => ad.position === "between_categories")
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: !selected ? theme.header : palette.background }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView ref={pageScrollRef} style={[styles.page, { backgroundColor: palette.background }]} contentContainerStyle={[styles.content, { paddingTop: 16, paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        {!selected && (
          <View style={{
            marginHorizontal: -20, marginTop: -16, marginBottom: 2, paddingHorizontal: 20,
            paddingTop: 7, paddingBottom: 14, backgroundColor: theme.header,
            borderBottomLeftRadius: 22, borderBottomRightRadius: 22, gap: 10,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir menú de navegación"
                onPress={() => setDrawerVisible(true)}
                style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.headerText}18` }}
              >
                <Menu size={21} color={theme.headerText} strokeWidth={2.2} />
              </Pressable>
              <CercaGoLogo style={{ width: logoWidth, height: 34, borderRadius: 8, backgroundColor: "#fff" }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver tasa BCV del día"
                  onPress={() => setSheet("rate")}
                  style={{ minHeight: 44, justifyContent: "center", borderRadius: 12, paddingHorizontal: 5 }}
                >
                  <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} fallback={exchangeRateFallback} compact compactTextColor={theme.headerText} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver pedidos y notificaciones"
                  onPress={() => { setInboxInitialTab("orders"); setInboxVisible(true); setError(""); }}
                  style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.headerText}18` }}
                >
                  <Bell size={19} color={theme.headerText} strokeWidth={2.2} />
                  {unreadOrderCount > 0 && <View style={{ position: "absolute", right: 1, top: 1, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#D92D20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.header }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unreadOrderCount > 9 ? "9+" : unreadOrderCount}</Text>
                  </View>}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir mi perfil"
                  onPress={() => setSheet("profile")}
                  style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.headerText}18` }}
                >
                  <Avatar value={profileAvatar} name={session!.user.name} size={34} />
                </Pressable>
              </View>
            </View>
            {activeTab === "home" && (
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FFFFFFAA", shadowColor: "#064E49", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.13, shadowRadius: 12, elevation: 3 }}>
                <Search size={19} color={palette.brand} strokeWidth={2.2} />
                <TextInput
                  accessibilityLabel="Buscar comercios o antojos"
                  placeholder="Busca un comercio o categoría"
                  placeholderTextColor="#A0A4AE"
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  style={{ flex: 1, minHeight: 46, color: palette.ink, fontSize: 14 }}
                />
                {search.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => { setSearch(""); setSearchFocused(false); }}><Text style={{ color: palette.muted, padding: 8 }}>×</Text></Pressable>}
              </View>
            )}
            {activeTab === "home" && searchFocused && searchTerm.length > 0 && (
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 8, gap: 2, shadowColor: "#17212B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 7 }}>
                {storeSuggestions.map((store) => (
                  <Pressable key={store.id} accessibilityRole="button" onPress={() => { setSearchFocused(false); void openStore(store); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 11 }}>
                    <Text style={{ color: palette.brand, fontSize: 17 }}>⌕</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: palette.ink, fontWeight: "800", fontSize: 13 }}>{store.name}</Text>
                      <Text style={{ color: palette.muted, fontSize: 11 }}>{store.category_name ?? "Comercio local"}</Text>
                    </View>
                    <Text style={{ color: palette.muted }}>›</Text>
                  </Pressable>
                ))}
                {categorySuggestions.map((category) => (
                  <Pressable key={category.id} accessibilityRole="button" onPress={() => { setSelectedCategory(categoryGroupKey(category.name, category.id)); setSearch(""); setSearchFocused(false); }} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 11 }}>
                    <Text style={{ color: palette.brand, fontSize: 16 }}>▦</Text>
                    <Text style={{ color: palette.ink, fontSize: 13, fontWeight: "700" }}>Ver categoría {category.name}</Text>
                  </Pressable>
                ))}
                {storeSuggestions.length === 0 && categorySuggestions.length === 0 && (
                  <Pressable accessibilityRole="button" onPress={() => setSearchFocused(false)} style={{ minHeight: 42, justifyContent: "center", paddingHorizontal: 10 }}>
                    <Text style={{ color: palette.ink, fontSize: 13 }}>Ver comercios para “{search.trim()}”</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
        {error ? <Pressable onPress={() => setError("")}><Text style={styles.error}>{error}  ×</Text></Pressable> : null}
        {activeTab === "orders" ? (
          <>
            <View style={{ gap: 5, marginTop: 6 }}>
              <Text style={{ color: palette.ink, fontSize: 21, fontWeight: "900" }}>Pedidos y chat</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>Revisa tus pedidos y conversa con cada comercio.</Text>
            </View>
            <View style={{ backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>Dirección de entrega</Text>
                  <Text numberOfLines={2} style={[styles.subtitle, { color: palette.muted }]}>
                    {addresses.find((item) => item.id === selectedAddressId)?.address_line ?? "Aún no has seleccionado una dirección"}
                  </Text>
                </View>
                <MapPin size={21} color={theme.primaryDark} strokeWidth={2.2} />
              </View>
              <Button title="Administrar mis direcciones" secondary onPress={() => setSheet("location")} />
            </View>
            {orders.length ? orders.map((order) => (
              <View key={order.id} style={{ backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, padding: 15, gap: 9 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "900" }}>{order.store_name ?? "Comercio"}</Text>
                    <Text style={[styles.subtitle, { color: palette.muted }]}>{order.delivery_address}</Text>
                  </View>
                  <Text style={{ color: palette.orange, fontSize: 11, fontWeight: "900" }}>{statusLabel(order.status)}</Text>
                </View>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>{formatDualPrice(order.total, order.exchange_rate ?? exchangeRate)}</Text>
                {Number(order.discount_amount ?? 0) > 0 && <Text style={{ color: palette.green, fontSize: 12, fontWeight: "800" }}>Cupón {order.coupon_code}: −{formatDualPrice(order.discount_amount!, order.exchange_rate ?? exchangeRate)}</Text>}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Pressable onPress={() => setActiveChatOrder(order)} style={{ backgroundColor: palette.orange, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>Abrir chat</Text>
                  </Pressable>
                  {order.status === "delivered" && !order.has_review && <Pressable onPress={() => setReviewOrder(order)}><Text style={{ color: palette.green, fontSize: 12, fontWeight: "900" }}>Calificar</Text></Pressable>}
                </View>
              </View>
            )) : (
              <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 22, alignItems: "center", gap: 8 }}>
                <ShoppingBag size={32} color={theme.primaryDark} strokeWidth={1.8} />
                <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "900" }}>Aún no tienes pedidos</Text>
                <Text style={[styles.subtitle, { textAlign: "center", color: palette.muted }]}>Cuando hagas tu primer pedido, aquí podrás revisar su estado y abrir el chat.</Text>
                <Button title="Explorar comercios" onPress={() => setActiveTab("home")} />
              </View>
            )}
          </>
        ) : selected ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => { setSelected(null); setError(""); }} style={{ backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>‹  Volver</Text>
              </Pressable>
              <Text style={{ color: palette.muted, fontWeight: "700" }}>MENÚ DEL COMERCIO</Text>
            </View>
            <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#E7E8E7" }}>
              <ImageBackground source={{ uri: selected.image_url ?? defaultPromotions[0].mediaUrl }} style={{ height: 210, justifyContent: "space-between", padding: 18 }}>
                {storeHasFreeDelivery(selected) && <Text style={{ color: "#fff", alignSelf: "flex-start", backgroundColor: palette.green, overflow: "hidden", borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11, fontSize: 11, fontWeight: "900" }}>DELIVERY GRATIS</Text>}
                <View style={{ backgroundColor: "#151515A8", padding: 14, borderRadius: 16 }}>
                  <Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>{selected.name}</Text>
                  <Text style={{ color: "#fff", marginTop: 5 }}>{Number(selected.rating ?? 0) > 0 ? `★ ${Number(selected.rating).toFixed(1)}  ·  ` : ""}◷ {selected.estimated_delivery_minutes ?? 30}–{(selected.estimated_delivery_minutes ?? 30) + 10} min  ·  {selected.address}</Text>
                </View>
              </ImageBackground>
            </View>
            <Text style={[styles.section, { color: palette.ink }]}>Lo que más te va a gustar</Text>
            {productsLoading && <Loading />}
            {products.map((product) => (
              <View key={product.id} style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 10, shadowColor: "#151927", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: palette.ink, fontWeight: "900", fontSize: 15 }}>{product.name}</Text>
                    <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.subtitle, { color: palette.muted }]}>{product.description || (product.in_stock ? "Preparado con cariño" : "Sin stock por ahora")}</Text>
                    <Text numberOfLines={2} style={{ color: palette.ink, fontWeight: "900", fontSize: 13, lineHeight: 18 }}>{formatDualPrice(product.price, exchangeRate)}</Text>
                  </View>
                  {product.image_url ? <Image source={{ uri: product.image_url }} style={{ width: 82, height: 82, borderRadius: 13, backgroundColor: "#F0F1F3", flexShrink: 0 }} resizeMode="cover" /> : (
                    <View style={{ width: 82, height: 82, borderRadius: 13, backgroundColor: theme.soft, alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Text style={{ fontSize: 32 }}>🥐</Text></View>
                  )}
                </View>
                <Button
                  title={!product.in_stock ? "Agotado" : cart[product.id] ? `Añadir otro  ·  ${cart[product.id]} en tu bolsa` : "Añadir a mi pedido"}
                  disabled={!product.in_stock}
                  onPress={() => setCart((value) => ({ ...value, [product.id]: (value[product.id] ?? 0) + 1 }))}
                />
              </View>
            ))}
            {!productsLoading && !products.length && <Text style={[styles.subtitle, { color: palette.muted }]}>Este comercio aún no tiene productos publicados.</Text>}
          </>
        ) : (
          <>
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
                <Pressable key={promo.id} accessibilityRole="button" onPress={() => openPromotion(promo, index)} style={{ width: bannerWidth, height: 190 }}>
                  <PromotionBanner promotion={promo}>
                    <Text style={{ color: "#FFE3A0", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{promo.tag}</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 8, maxWidth: 280 }}>{promo.title}</Text>
                    <Text style={{ color: "#FFFFFFE8", fontSize: 13, marginTop: 5, maxWidth: 280 }}>{promo.body}</Text>
                    <View style={{ alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, marginTop: 14 }}>
                      <Text style={{ color: palette.ink, fontSize: 11, fontWeight: "900" }}>{promo.linkUrl ? "Ver promoción  →" : "Explorar ahora  →"}</Text>
                    </View>
                  </PromotionBanner>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -4 }}>
              {promotions.map((promo, index) => (
                <Pressable key={promo.id} accessibilityRole="button" accessibilityLabel={`Ver promoción ${index + 1}`} onPress={() => {
                  setBannerIndex(index);
                  bannerRef.current?.scrollTo({ x: (bannerWidth + 12) * index, animated: true });
                }}>
                  <View style={{ width: bannerIndex === index ? 20 : 6, height: 6, borderRadius: 4, backgroundColor: bannerIndex === index ? palette.orange : "#DADDE2" }} />
                </Pressable>
              ))}
            </View>

            <View onLayout={(event) => setStoreSectionY(event.nativeEvent.layout.y)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[styles.section, { color: palette.ink }]}>Categorías rápidas</Text>
              <Pressable accessibilityRole="button" onPress={() => void findNearby()}><Text style={{ color: palette.orange, fontWeight: "800", fontSize: 12 }}>{nearbyEnabled ? "Cerca de ti ✓" : "Ver cercanos"}</Text></Pressable>
            </View>
            {nearbyCoordinates && <Text style={{ color: palette.muted, fontSize: 11 }}>Distancias desde {nearbyCoordinates.latitude.toFixed(3)}, {nearbyCoordinates.longitude.toFixed(3)}.</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingHorizontal: 2 }}>
              {categoryTiles.map((category) => (
                <CategoryItem
                  key={category.key || "all"}
                  category={category}
                  selected={selectedCategory === category.key}
                  onPress={() => setSelectedCategory(category.key)}
                />
              ))}
            </ScrollView>
            {categorySponsoredAds.map((ad) => (
              <SponsoredAdCard key={ad.id} ad={ad} variant="banner" onPress={() => openSponsoredAd(ad)} />
            ))}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <View><Text style={[styles.section, { color: palette.ink }]}>Comercios cercanos</Text><Text style={[styles.subtitle, { color: palette.muted }]}>Los favoritos de tus vecinos</Text></View>
              <Text style={{ color: palette.orange, fontSize: 12, fontWeight: "800" }}>{visibleStores.length} lugares</Text>
            </View>
            <View style={{ gap: 9 }}>
              {popular.length
                ? popular.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} cardWidth={storeCardWidth} onPress={() => void openStore(store)} />)
                : <View style={{ minHeight: 88, justifyContent: "center", gap: 6, paddingHorizontal: 14 }}>
                  <Text style={{ color: palette.ink, fontSize: 13, fontWeight: "800" }}>No hay comercios en esta categoría todavía.</Text>
                  <Pressable accessibilityRole="button" onPress={() => setSelectedCategory("")}><Text style={{ color: palette.orange, fontSize: 12, fontWeight: "800" }}>Ver todas las categorías</Text></Pressable>
                </View>}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <View><Text style={[styles.section, { color: palette.ink }]}>Envío gratis</Text><Text style={[styles.subtitle, { color: palette.muted }]}>La moto va por nuestra cuenta</Text></View>
              <Text style={{ color: palette.green, fontWeight: "800", fontSize: 12 }}>Sin costo</Text>
            </View>
            <View style={{ gap: 9 }}>
              {freeDelivery.length
                ? freeDelivery.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} cardWidth={storeCardWidth} onPress={() => void openStore(store)} />)
                : <Text style={[styles.subtitle, { padding: 16, color: palette.muted }]}>Las promociones de envío gratis aparecerán aquí.</Text>}
            </View>

            <View style={{ marginTop: 8 }}><Text style={[styles.section, { color: palette.ink }]}>Nuevos comercios</Text><Text style={[styles.subtitle, { color: palette.muted }]}>Descubre quién llegó al barrio</Text></View>
            <View style={{ gap: 9 }}>
              {newest.map((store) => <StoreCard key={store.id} store={store} exchangeRate={exchangeRate} cardWidth={storeCardWidth} onPress={() => void openStore(store)} />)}
            </View>

            <View style={{ backgroundColor: theme.soft, padding: 18, borderRadius: 20, marginTop: 8 }}>
              <Text style={{ fontSize: 22 }}>💛</Text>
              <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 16, marginTop: 6 }}>Cada pedido apoya a alguien cerca</Text>
              <Text style={[styles.subtitle, { marginTop: 4, color: palette.muted }]}>Gracias por elegir los comercios de tu comunidad.</Text>
            </View>
          </>
        )}
      </ScrollView>

      {floatingSponsoredAd && !sheet && !drawerVisible && !inboxVisible && (
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 12, alignItems: "center", zIndex: 2 }}>
        <View style={{ width: "100%", maxWidth: 520 }}>
          <SponsoredAdCard
            ad={floatingSponsoredAd}
            variant="floating"
            onPress={() => openSponsoredAd(floatingSponsoredAd)}
            onDismiss={() => setFloatingAdDismissed(true)}
          />
        </View>
      </View>
      )}

      <CustomerDrawer
        visible={drawerVisible}
        name={session!.user.name}
        email={session!.user.email}
        avatar={profileAvatar}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleDrawerSelect}
        onProfile={() => { setDrawerVisible(false); setSheet("profile"); }}
        onSignOut={() => { setDrawerVisible(false); void signOut(); }}
      />

      <CustomerInboxSheet
        visible={inboxVisible}
        initialTab={inboxInitialTab}
        notifications={orderNotifications}
        promotions={promotions}
        orders={orders}
        onClose={() => setInboxVisible(false)}
        onMarkRead={markOrderNotificationsRead}
        onOpenOrder={(order) => {
          setInboxVisible(false);
          setSelected(null);
          setActiveTab("orders");
          setActiveChatOrder(order);
        }}
        onOpenPromotion={(promotion) => {
          setInboxVisible(false);
          openPromotion(promotion, promotions.findIndex((item) => item.id === promotion.id));
        }}
      />

      <Modal
        visible={Boolean(splashSponsoredAd)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (splashCloseAllowed && splashSponsoredAd) {
            setDismissedSplashAdIds((current) => [...current, splashSponsoredAd.id]);
          }
        }}
      >
        {splashSponsoredAd && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "#101820E8" }}>
            <View style={{ width: "100%", maxWidth: 520, height: "76%", maxHeight: 620, overflow: "hidden", borderRadius: 24, backgroundColor: theme.surface }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Publicidad patrocinada de ${splashSponsoredAd.brandName}`}
                onPress={() => openSponsoredAd(splashSponsoredAd)}
                style={{ flex: 1, justifyContent: "flex-end" }}
              >
                <ExternalAdMedia
                  ad={splashSponsoredAd}
                  onPress={() => openSponsoredAd(splashSponsoredAd)}
                  style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
                />
                <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#091A204D" }} />
                <View style={{ padding: 20, paddingRight: 60, backgroundColor: "#091A2099" }}>
                  <Text style={{ color: "#FFFFFFD9", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }}>PATROCINADO</Text>
                  <Text style={{ color: "#fff", fontSize: 23, fontWeight: "900", marginTop: 5 }}>{splashSponsoredAd.brandName}</Text>
                </View>
              </Pressable>
              {splashCloseAllowed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar anuncio patrocinado"
                  onPress={() => setDismissedSplashAdIds((current) => [...current, splashSponsoredAd.id])}
                  style={{ position: "absolute", right: 12, top: 12, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#101820D9", borderWidth: 1, borderColor: "#FFFFFF99" }}
                >
                  <Text style={{ color: "#fff", fontSize: 25, fontWeight: "700", lineHeight: 29 }}>×</Text>
                </Pressable>
              ) : (
                <View accessibilityLabel={`Podrás cerrar el anuncio en ${splashCloseCountdown} segundos`} style={{ position: "absolute", right: 12, top: 12, minHeight: 40, paddingHorizontal: 11, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#101820D9", borderWidth: 1, borderColor: "#FFFFFF99" }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{splashCloseCountdown}s</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
          <Pressable onPress={() => setSheet(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ width: "100%", maxWidth: 560, maxHeight: "82%", alignSelf: "center", backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, gap: 12 }}>
            <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: "#D9DCE2", alignSelf: "center", marginBottom: 4 }} />
            {sheet === "profile" && (
              <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
                <View style={{ alignItems: "center", gap: 6, paddingVertical: 8 }}>
                  <Avatar value={profileAvatar} name={session!.user.name} size={76} style={{ borderWidth: 5, borderColor: theme.soft }} />
                  <Text style={[styles.title, { textAlign: "center", color: palette.ink }]}>Mi perfil</Text>
                  <Text style={[styles.subtitle, { color: palette.muted }]}>Tu cuenta CercaGo</Text>
                </View>

                <View style={{ backgroundColor: theme.background, borderRadius: 16, padding: 14, gap: 11 }}>
                  <Text style={{ color: theme.ink, fontWeight: "900", fontSize: 15 }}>Foto y avatar</Text>
                  <ProfilePhotoPicker onSelect={(value) => void saveProfileAvatar(value)} />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {illustratedAvatars.map((avatar) => (
                      <Pressable key={avatar.id} accessibilityRole="button" accessibilityLabel={`Elegir avatar ${avatar.label}`} onPress={() => void saveProfileAvatar(avatar.id)} style={{
                        width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center",
                        backgroundColor: profileAvatar === avatar.id ? theme.soft : theme.surface,
                        borderWidth: profileAvatar === avatar.id ? 2 : 1, borderColor: profileAvatar === avatar.id ? theme.primary : theme.border,
                      }}>
                        <Avatar value={avatar.id} name={session!.user.name} size={36} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ backgroundColor: theme.background, borderRadius: 16, padding: 14, gap: 11 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 15 }}>Información de contacto</Text>
                    <Pressable accessibilityRole="button" onPress={() => {
                      if (profileEditing) {
                        setProfileName(session!.user.name);
                        setProfileEmail(session!.user.email);
                        setProfilePhone(session!.user.phone ?? "");
                      }
                      setProfileEditing((value) => !value);
                    }}>
                      <Text style={{ color: palette.brand, fontSize: 12, fontWeight: "900" }}>{profileEditing ? "Cancelar" : "Editar"}</Text>
                    </Pressable>
                  </View>
                  {profileEditing ? (
                    <>
                      <Field label="Nombre" value={profileName} onChangeText={setProfileName} placeholder="Tu nombre" />
                      <Field label="Correo electrónico" value={profileEmail} onChangeText={setProfileEmail} placeholder="tu@email.com" keyboardType="email-address" />
                      <Field label="Teléfono (+58)" value={profilePhone} onChangeText={(value) => setProfilePhone(value.replace(/[^\d+]/g, "").slice(0, 13))} placeholder="412 000 0000" keyboardType="phone-pad" />
                      <Button title={profileSaving ? "Guardando…" : "Guardar cambios"} onPress={() => void saveProfile()} disabled={profileSaving} />
                    </>
                  ) : (
                    <>
                      <View style={{ gap: 4 }}>
                        <Text style={[styles.label, { color: palette.ink }]}>Nombre</Text>
                        <Text style={{ color: palette.ink, fontWeight: "700" }}>{session!.user.name}</Text>
                      </View>
                      <View style={{ gap: 4 }}>
                        <Text style={[styles.label, { color: palette.ink }]}>Correo electrónico</Text>
                        <Text style={{ color: palette.ink }}>{session!.user.email}</Text>
                      </View>
                      <View style={{ gap: 4 }}>
                        <Text style={[styles.label, { color: palette.ink }]}>Teléfono</Text>
                        <Text style={{ color: session!.user.phone ? palette.ink : palette.muted }}>{session!.user.phone || "Agrega un teléfono de contacto"}</Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={{ backgroundColor: theme.background, borderRadius: 16, padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 15 }}>Mis direcciones</Text>
                      <Text style={[styles.subtitle, { color: palette.muted }]}>{addresses.length ? `${addresses.length} guardada${addresses.length === 1 ? "" : "s"}` : "Agrega una dirección para tus pedidos"}</Text>
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => setSheet("location")} style={{ padding: 9, borderRadius: 11, backgroundColor: "#E1F2F0" }}>
                      <Text style={{ color: "#0D8179", fontSize: 12, fontWeight: "900" }}>Administrar</Text>
                    </Pressable>
                  </View>
                  {addresses.slice(0, 2).map((saved) => (
                    <View key={saved.id} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 11, gap: 3 }}>
                      <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "800" }}>{saved.label}{saved.is_default ? " · Predeterminada" : ""}</Text>
                      <Text numberOfLines={2} style={{ color: palette.muted, fontSize: 12 }}>{saved.address_line}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.background, borderRadius: 16, padding: 14, gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 14 }}>Avisos de pedidos</Text>
                    <Text style={[styles.subtitle, { color: palette.muted }]}>Preferencia guardada en este dispositivo</Text>
                  </View>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: notificationsEnabled }}
                    accessibilityLabel="Avisos de pedidos"
                    onPress={() => void toggleNotifications()}
                    style={{ width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: "center", backgroundColor: notificationsEnabled ? palette.brand : "#D0D5DD" }}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: notificationsEnabled ? "flex-end" : "flex-start" }} />
                  </Pressable>
                </View>
                <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 16 }}>La preferencia se guarda aquí; para recibir avisos push hace falta habilitar un servicio de notificaciones.</Text>
                <Button title="Cerrar sesión" secondary onPress={() => void signOut()} />
              </ScrollView>
            )}
            {sheet === "rate" && <>
              <Text style={[styles.title, { color: palette.ink }]}>Tasa BCV del día</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>Referencia oficial para tus compras en bolívares.</Text>
              <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} fallback={exchangeRateFallback} />
              <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "900", marginTop: 4 }}>Calculadora USD ↔ Bs.</Text>
              <TextInput
                accessibilityLabel="Monto en dólares"
                placeholder="Dólares (USD)"
                placeholderTextColor={theme.muted}
                value={usdAmount}
                onChangeText={updateUsdAmount}
                keyboardType="decimal-pad"
                style={{ minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.background }}
              />
              <TextInput
                accessibilityLabel="Monto en bolívares"
                placeholder="Bolívares (Bs.)"
                placeholderTextColor={theme.muted}
                value={vesAmount}
                onChangeText={updateVesAmount}
                keyboardType="decimal-pad"
                style={{ minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.background }}
              />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {[5, 10, 20, 50].map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => updateUsdAmount(String(amount))} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: theme.soft }}>
                  <Text style={{ color: theme.primaryDark, fontWeight: "900", fontSize: 12 }}>${amount}</Text>
                </Pressable>)}
              </View>
              <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18 }}>
                {exchangeRate ? `Conversión calculada con la tasa oficial BCV de ${Number(exchangeRate).toLocaleString("es-VE")} Bs. por USD.` : "La tasa oficial todavía no está disponible; no se mostrará una conversión estimada."}
              </Text>
              <Button title="Listo" onPress={() => setSheet(null)} />
            </>}
            {sheet === "settings" && (
              <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                <Text style={[styles.title, { color: theme.ink }]}>Ajustes</Text>
                <Text style={[styles.subtitle, { color: theme.muted }]}>Personaliza el aspecto de CercaGo. Los cambios se guardan en este dispositivo.</Text>
                <Text style={{ color: theme.ink, fontSize: 15, fontWeight: "900", marginTop: 6 }}>Apariencia</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "800" }}>Modo oscuro</Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>Fondo #121212 y tarjetas #1E1E1E</Text>
                  </View>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel="Modo oscuro"
                    accessibilityState={{ checked: darkMode }}
                    onPress={() => void setDarkMode(!darkMode).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo guardar el modo oscuro."))}
                    style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: "center", backgroundColor: darkMode ? theme.primary : "#C7CDD4" }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", alignSelf: darkMode ? "flex-end" : "flex-start" }} />
                  </Pressable>
                </View>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Paleta base</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                  {themeOptions.map((option) => (
                    <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: theme.id === option.id }} onPress={() => {
                      void setTheme(option.id).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo guardar el tema."));
                    }} style={{
                      minWidth: "30%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8,
                      paddingVertical: 10, paddingHorizontal: 9, borderRadius: 13,
                      borderWidth: theme.id === option.id ? 2 : 1,
                      borderColor: theme.id === option.id ? theme.primary : theme.border,
                      backgroundColor: theme.surface,
                    }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: option.swatch }} />
                      <Text style={{ color: theme.ink, fontSize: 11, fontWeight: "800", flexShrink: 1 }}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "900", marginTop: 6 }}>Color de acento</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {colorOptions.map((color) => (
                    <Pressable key={`accent-${color}`} accessibilityRole="button" accessibilityLabel={`Color de acento ${color}`} accessibilityState={{ selected: accentColor.toLowerCase() === color.toLowerCase() }} onPress={() => {
                      void setAccentColor(color).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo guardar el color de acento."));
                    }} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: accentColor.toLowerCase() === color.toLowerCase() ? 2 : 1, borderColor: accentColor.toLowerCase() === color.toLowerCase() ? theme.ink : theme.border }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color }} />
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "900", marginTop: 6 }}>Color de la barra superior</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {colorOptions.map((color) => (
                    <Pressable key={`header-${color}`} accessibilityRole="button" accessibilityLabel={`Color de barra superior ${color}`} accessibilityState={{ selected: headerColor.toLowerCase() === color.toLowerCase() }} onPress={() => {
                      void setHeaderColor(color).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo guardar el color de la barra."));
                    }} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: headerColor.toLowerCase() === color.toLowerCase() ? 2 : 1, borderColor: headerColor.toLowerCase() === color.toLowerCase() ? theme.ink : theme.border }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color }} />
                    </Pressable>
                  ))}
                </View>
                <Button title="Cerrar" secondary onPress={() => setSheet(null)} />
              </ScrollView>
            )}
            {sheet === "location" && (
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.title, { color: palette.ink }]}>Mis direcciones</Text>
                <Text style={[styles.subtitle, { color: palette.muted }]}>Administra tus direcciones y elige dónde recibir.</Text>
                {addresses.map((saved) => (
                  <View key={saved.id} style={{ padding: 12, borderRadius: 15, backgroundColor: selectedAddressId === saved.id ? theme.soft : theme.background, gap: 8 }}>
                    <Pressable onPress={() => { setSelectedAddressId(saved.id); setAddress(""); setCity(""); setSheet(null); }} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ flex: 1, color: palette.ink, fontWeight: "700" }}>⌂  {saved.label}{saved.is_default ? " · Predeterminada" : ""} · {saved.address_line}</Text>
                      {selectedAddressId === saved.id && <Text style={{ color: palette.orange }}>✓</Text>}
                    </Pressable>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      {!saved.is_default && <Pressable onPress={() => void setDefaultAddress(saved)}><Text style={{ color: palette.green, fontSize: 12, fontWeight: "800" }}>Hacer predeterminada</Text></Pressable>}
                      <Pressable onPress={() => {
                        setEditingAddressId(saved.id);
                        setAddressLabel(saved.label);
                        setAddress(saved.address_line);
                        setCity("");
                        setAddressCoordinates(saved.latitude != null && saved.longitude != null
                          ? { latitude: Number(saved.latitude), longitude: Number(saved.longitude) }
                          : null);
                      }}><Text style={{ color: palette.orange, fontSize: 12, fontWeight: "800" }}>Editar</Text></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${saved.label}`} onPress={() => setDeleteAddressCandidate(saved)}><Trash2 size={17} color="#B42318" /></Pressable>
                    </View>
                  </View>
                ))}
                <TextInput placeholder="Etiqueta (Casa, trabajo…)" placeholderTextColor={theme.muted} value={addressLabel} onChangeText={setAddressLabel} style={{ minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.surface }} />
                <TextInput placeholder="Calle o avenida" placeholderTextColor={theme.muted} value={address} onChangeText={(value) => { setAddress(value); setAddressCoordinates(null); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.surface }} />
                <TextInput placeholder="Ciudad" placeholderTextColor={theme.muted} value={city} onChangeText={(value) => { setCity(value); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.surface }} />
                <Button title={addressCoordinates ? "Cambiar ubicación en el mapa" : "Agregar ubicación con mapa y GPS"} secondary onPress={() => {
                  setSheet(null);
                  setLocationPickerVisible(true);
                }} />
                {addressCoordinates && <Text style={{ color: palette.green, fontSize: 11 }}>Coordenadas guardadas: {addressCoordinates.latitude.toFixed(5)}, {addressCoordinates.longitude.toFixed(5)}</Text>}
                {address.trim() && <Button title={editingAddressId ? "Guardar cambios" : "Agregar dirección"} secondary onPress={() => void saveAddress()} />}
                <Button title="Listo" onPress={() => setSheet(null)} />
              </ScrollView>
            )}
            {sheet === "cart" && <>
              <Text style={[styles.title, { color: palette.ink }]}>Tu pedido</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>{selected?.name ?? "Tu bolsa CercaGo"}</Text>
              {itemCount === 0 ? (
                <Text style={[styles.subtitle, { paddingVertical: 20, textAlign: "center", color: palette.muted }]}>Tu bolsa está esperando algo delicioso.</Text>
              ) : products.filter((product) => cart[product.id]).map((product) => (
                <View key={product.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{product.name}</Text><Text style={[styles.subtitle, { color: palette.muted }]}>{formatDualPrice(product.price, exchangeRate)}</Text></View>
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
                <Text style={[styles.section, { color: palette.ink }]}>Dirección de entrega</Text>
                {addresses.map((saved) => (
                  <Pressable key={saved.id} onPress={() => { setSelectedAddressId(saved.id); setAddress(""); }} style={{ padding: 12, borderRadius: 13, backgroundColor: selectedAddressId === saved.id ? theme.soft : theme.background }}>
                    <Text style={{ color: palette.ink, fontWeight: "700" }}>{selectedAddressId === saved.id ? "✓  " : ""}{saved.label}: {saved.address_line}</Text>
                  </Pressable>
                ))}
                <TextInput placeholder="Usar otra dirección" placeholderTextColor={theme.muted} value={address} onChangeText={(value) => { setAddress(value); setSelectedAddressId(""); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.surface }} />
                <View style={{ gap: 8, paddingTop: 4 }}>
                  <Text style={{ color: palette.ink, fontWeight: "900", fontSize: 13 }}>Tengo un cupón de descuento</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      accessibilityLabel="Código de cupón"
                      placeholder="Escribe tu código"
                      placeholderTextColor={theme.muted}
                      value={couponCode}
                      onChangeText={(value) => { setCouponCode(value.toUpperCase()); setAppliedCoupon(null); setError(""); }}
                      autoCapitalize="characters"
                      style={{ flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, color: theme.ink, backgroundColor: theme.surface }}
                    />
                    <Pressable accessibilityRole="button" disabled={couponApplying} onPress={() => void applyCoupon()} style={{ minWidth: 76, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.primary }}>
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{couponApplying ? "…" : "Aplicar"}</Text>
                    </Pressable>
                  </View>
                  {availableCoupons.map((coupon) => <Pressable key={coupon.id} accessibilityRole="button" onPress={() => { setCouponCode(coupon.code); setAppliedCoupon(null); }} style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.soft }}>
                    <Text style={{ color: theme.primaryDark, fontSize: 11, fontWeight: "800" }}>{coupon.code} · {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `${coupon.discount_value} USD`}</Text>
                  </Pressable>)}
                  {appliedCoupon && <Text style={{ color: palette.green, fontWeight: "800", fontSize: 12 }}>Cupón {appliedCoupon.code} aplicado: −{formatDualPrice(appliedCoupon.discountAmount, exchangeRate)}</Text>}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                  <View style={{ gap: 3 }}>
                    <Text style={{ color: palette.muted }}>Subtotal: {formatDualPrice(cartTotal, exchangeRate)}</Text>
                    {appliedCoupon && <Text style={{ color: palette.green, fontWeight: "800" }}>Descuento: −{formatDualPrice(appliedCoupon.discountAmount, exchangeRate)}</Text>}
                    <Text style={{ color: palette.muted }}>Envío: {selected && storeHasFreeDelivery(selected) ? "gratis" : formatDualPrice(deliveryFee, exchangeRate)}</Text>
                    <Text style={{ color: palette.ink, fontWeight: "900" }}>Total</Text>
                  </View>
                  <Text style={{ color: palette.ink, fontWeight: "900" }}>{formatDualPrice(cartTotal - Number(appliedCoupon?.discountAmount ?? 0) + deliveryFee, exchangeRate)}</Text>
                </View>
                <Button title="Administrar direcciones" secondary onPress={() => setSheet("location")} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button title="Confirmar pedido" onPress={() => void placeOrder()} />
              </>}
            </>}
            {sheet === "notice" && <>
              <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: theme.soft, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8 }}>
                <Text style={{ fontSize: 28 }}>✦</Text>
              </View>
              <Text style={[styles.title, { textAlign: "center", marginTop: 6, color: palette.ink }]}>{notice.title || "¡Todo cerca de ti!"}</Text>
              <Text style={[styles.subtitle, { textAlign: "center", marginVertical: 4, color: palette.muted }]}>{notice.body || "Las novedades de tus pedidos aparecerán aquí."}</Text>
              {orders.slice(0, 3).map((order) => (
                <View key={order.id} style={{ padding: 13, backgroundColor: theme.background, borderRadius: 14, gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "800" }}>{order.store_name ?? "Tu pedido"}</Text><Text style={[styles.subtitle, { color: palette.muted }]}>{order.delivery_address}</Text></View>
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
          <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, gap: 12 }}>
            <Text style={[styles.title, { color: palette.ink }]}>Eliminar dirección</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>¿Quieres eliminar {deleteAddressCandidate?.label}?</Text>
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
          <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: theme.surface, borderRadius: 24, padding: 22, gap: 12 }}>
            <Text style={[styles.title, { color: palette.ink }]}>¿Cómo estuvo tu pedido?</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>Califica a {reviewOrder?.store_name ?? "la tienda"} para ayudar a otros vecinos.</Text>
            <Text style={{ color: palette.ink, fontWeight: "800" }}>Comercio</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setStoreRating(value)}><Text style={{ fontSize: 32, color: value <= storeRating ? "#F5A623" : "#D0D5DD" }}>★</Text></Pressable>)}
            </View>
            <TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Comentario para el comercio (opcional)" placeholderTextColor={theme.muted} multiline style={{ minHeight: 76, borderWidth: 1, borderColor: theme.border, borderRadius: 13, padding: 12, textAlignVertical: "top", backgroundColor: theme.surface, color: theme.ink }} />
            {reviewOrder?.driver_id && <>
              <Text style={{ color: palette.ink, fontWeight: "800" }}>Repartidor (opcional)</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setDriverRating(value)}><Text style={{ fontSize: 28, color: value <= driverRating ? "#F5A623" : "#D0D5DD" }}>★</Text></Pressable>)}
              </View>
              <TextInput value={driverComment} onChangeText={setDriverComment} placeholder="Comentario para el repartidor (opcional)" placeholderTextColor={theme.muted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: theme.border, borderRadius: 13, padding: 12, textAlignVertical: "top", backgroundColor: theme.surface, color: theme.ink }} />
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
        initialAddress={{ street: address, city }}
        onClose={() => {
          setLocationPickerVisible(false);
          setSheet("location");
        }}
        onSelect={(coordinates, addressLabel, addressDetails) => {
          setAddressCoordinates(coordinates);
          if (addressDetails) {
            setAddress(addressDetails.street);
            setCity(addressDetails.city);
          } else if (addressLabel) {
            setAddress(addressLabel);
          }
          setSelectedAddressId("");
        }}
      />
    </View>
    </SafeAreaView>
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
