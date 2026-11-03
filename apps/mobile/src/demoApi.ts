import type { Address, Category, Order, OrderMessage, Product, Role, Store } from "./types";

const storeId = "demo-store-cafe";
const secondStoreId = "demo-store-market";
const pharmacyId = "demo-store-pharmacy";
const partsId = "demo-store-parts";
const driverId = "demo-driver";
let demoRole: Role | null = null;
let nextOrderId = 3;
const exchangeRate: number | null = null;

const stores: Store[] = [
  { id: storeId, category_id: "demo-cat-food", name: "Café de la Esquina", address: "Av. Central 123", category_name: "Comidas", latitude: 10.4806, longitude: -66.9036, rating: 4.9, delivery_fee: 2.99, free_delivery: true, has_own_delivery: false, estimated_delivery_minutes: 20, image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-28T10:00:00.000Z" },
  { id: secondStoreId, category_id: "demo-cat-market", name: "Mercadito CercaGo", address: "Calle Norte 45", category_name: "Bodegas", latitude: 10.4912, longitude: -66.8792, rating: 4.7, delivery_fee: 2.99, free_delivery: false, has_own_delivery: true, estimated_delivery_minutes: 30, image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-25T10:00:00.000Z" },
  { id: "demo-store-pizza", category_id: "demo-cat-food", name: "Pizza Barrio", address: "Plaza del Sol 8", category_name: "Comidas", latitude: 10.4952, longitude: -66.8757, rating: 4.8, delivery_fee: 0, free_delivery: false, has_own_delivery: false, estimated_delivery_minutes: 25, image_url: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85", created_at: "2026-11-01T10:00:00.000Z" },
  { id: pharmacyId, category_id: "demo-cat-pharmacy", name: "Farmacia Salud Cerca", address: "Av. Bolívar 81", category_name: "Farmacias", latitude: 10.4918, longitude: -66.8722, rating: 4.8, delivery_fee: 1.5, free_delivery: false, has_own_delivery: true, estimated_delivery_minutes: 25, image_url: "https://images.unsplash.com/photo-1604235011572-b45d1b052b79?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-30T10:00:00.000Z" },
  { id: partsId, category_id: "demo-cat-parts", name: "Repuestos El Motor", address: "Calle Taller 12", category_name: "Repuestos", latitude: 10.4783, longitude: -66.8872, rating: 4.6, delivery_fee: 3, free_delivery: false, has_own_delivery: false, estimated_delivery_minutes: 40, image_url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-29T10:00:00.000Z" },
];

const categories: Category[] = [
  { id: "demo-cat-food", name: "Comidas" },
  { id: "demo-cat-market", name: "Bodegas" },
  { id: "demo-cat-pharmacy", name: "Farmacias" },
  { id: "demo-cat-parts", name: "Repuestos" },
];

function productsFor(store: Store, catalog: Array<[string, string, number, string]>) {
  return catalog.map(([name, description, price, image_url], index): Product => ({
    id: `${store.id}-product-${index + 1}`,
    store_id: store.id,
    name,
    description,
    price,
    image_url,
    in_stock: true,
    stock_quantity: 10 + index,
  }));
}

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
const products: Product[] = [
  ...productsFor(stores[0], [
    ["Arepa reina pepiada", "Pollo, aguacate y salsa de la casa.", 5.5, image("photo-1628797954631-6f7a460ab5af")],
    ["Cachapa con queso", "Maíz dulce con queso de mano.", 7, image("photo-1604908176997-125f25cc6f3d")],
    ["Hamburguesa clásica", "Carne, queso, vegetales y papas.", 8.9, image("photo-1568901346375-23c9450c58cd")],
    ["Pabellón criollo", "Carne mechada, caraotas, arroz y tajadas.", 9.5, image("photo-1512621776951-a57141f2eefd")],
    ["Jugo de parchita", "Natural y preparado al momento.", 2.5, image("photo-1622597467836-f3285f2131b8")],
    ["Torta tres leches", "Porción individual.", 4, image("photo-1578985545062-69928b1d9587")],
  ]),
  ...productsFor(stores[1], [
    ["Harina de maíz", "Paquete de harina precocida, 1 kg.", 2.3, image("photo-1601593768798-3f443a96d7b6")],
    ["Leche UHT", "Leche entera, 1 litro.", 1.8, image("photo-1563636619-e9143da7973b")],
    ["Huevos (docena)", "Huevos frescos seleccionados.", 3.6, image("photo-1506976785307-8732e854ad03")],
    ["Arroz blanco", "Arroz de grano largo, 1 kg.", 1.6, image("photo-1586201375761-83865001e31c")],
    ["Aceite vegetal", "Aceite comestible, 900 ml.", 3.2, image("photo-1474979266404-7eaacbcd87c5")],
    ["Cambur por kilo", "Fruta fresca de producción local.", 1.4, image("photo-1571771894821-ce9b6c11b08e")],
  ]),
  ...productsFor(stores[2], [
    ["Pizza margarita", "Salsa de tomate, mozzarella y albahaca.", 8, image("photo-1579751626657-72bc17010498")],
    ["Pizza pepperoni", "Mozzarella y pepperoni.", 10, image("photo-1579751626657-72bc17010498")],
    ["Pizza cuatro quesos", "Mezcla de quesos seleccionados.", 11, image("photo-1579751626657-72bc17010498")],
    ["Lasaña de carne", "Lasaña horneada con salsa boloñesa.", 9, image("photo-1579751626657-72bc17010498")],
    ["Pan de ajo", "Porción de pan tostado con ajo.", 3, image("photo-1579751626657-72bc17010498")],
    ["Refresco", "Bebida fría, 500 ml.", 1.8, image("photo-1622597467836-f3285f2131b8")],
  ]),
  ...productsFor(stores[3], [
    ["Acetaminofén 500 mg", "Caja de 10 tabletas.", 2.4, image("photo-1584308666744-24d5c474f2ae")],
    ["Suero oral", "Solución de rehidratación oral, 500 ml.", 1.9, image("photo-1603398938378-e54eab446dde")],
    ["Alcohol antiséptico", "Uso externo, 250 ml.", 2.1, image("photo-1608248543803-ba4f8c70ae0b")],
    ["Mascarillas", "Paquete de 10 unidades.", 2.8, image("photo-1584634731339-252c581abfc5")],
    ["Vitamina C", "Tabletas efervescentes, 10 unidades.", 3.5, image("photo-1550572017-edd951b55104")],
    ["Protector solar FPS 50", "Protección de amplio espectro, 100 ml.", 12, image("photo-1556229010-6c3f2c9ca5f8")],
  ]),
  ...productsFor(stores[4], [
    ["Aceite de motor 20W-50", "Lubricante mineral, envase de 1 litro.", 8.5, image("photo-1635784063381-184d56f9c9b9")],
    ["Filtro de aceite", "Compatible con modelos seleccionados.", 6, image("photo-1486262715619-67b85e0b08d3")],
    ["Bujía estándar", "Verifica compatibilidad con tu vehículo.", 4.25, image("photo-1486262715619-67b85e0b08d3")],
    ["Refrigerante", "Para sistema de enfriamiento, 1 litro.", 5.75, image("photo-1619642751034-765dfdf7c58e")],
    ["Kit de herramientas", "Juego compacto para mantenimiento.", 15, image("photo-1581147036324-c1c89c2c8b5c")],
    ["Limpiaparabrisas", "Par universal de 16 pulgadas.", 9, image("photo-1486262715619-67b85e0b08d3")],
  ]),
];

const addresses: Address[] = [
  { id: "demo-address-home", label: "Casa", address_line: "Calle Los Pinos 27", latitude: 10.4806, longitude: -66.9036, is_default: true },
  { id: "demo-address-work", label: "Trabajo", address_line: "Av. Principal, Torre 2", latitude: 10.4912, longitude: -66.8792, is_default: false },
];

const orders: Array<Order & { customer_id: string; driver_id?: string | null }> = [
  {
    id: "demo-order-placed", customer_id: "demo-customer", store_id: storeId, store_name: "Café de la Esquina",
    store_address: "Av. Central 123", status: "placed", delivery_address: "Calle Los Pinos 27",
    delivery_id: "demo-delivery-placed", subtotal: 8, delivery_fee: 0, total: 8, has_review: false,
    payment_bank: "Banco de Venezuela", payment_document: "J-12345678-9", payment_phone: "0412-1234567",
    items: [{ id: "demo-item-1", productName: "Arepa reina pepiada", quantity: 1, unitPrice: 5.5, lineTotal: 5.5 }, { id: "demo-item-2", productName: "Jugo de parchita", quantity: 1, unitPrice: 2.5, lineTotal: 2.5 }],
  },
  {
    id: "demo-order-ready", customer_id: "demo-customer", store_id: secondStoreId, store_name: "Mercadito CercaGo",
    store_address: "Calle Norte 45", status: "ready", delivery_address: "Av. Las Flores 310",
    delivery_id: "demo-delivery-ready", subtotal: 12.9, delivery_fee: 2.99, total: 15.89, has_own_delivery: true, has_review: false,
    items: [{ id: "demo-item-3", productName: "Canasta de frutas", quantity: 1 }],
  },
];
const demoMessagesKey = "cercago-demo-order-messages";
let messages: Record<string, OrderMessage[]> = {};
let messagesLoaded = false;

function loadMessages() {
  if (messagesLoaded) return;
  messagesLoaded = true;
  if (typeof localStorage === "undefined") return;
  try {
    const saved = localStorage.getItem(demoMessagesKey);
    if (saved) messages = JSON.parse(saved) as Record<string, OrderMessage[]>;
  } catch (error) {
    console.error("No se pudieron cargar los mensajes locales de demo", error);
  }
}

function persistMessages() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(demoMessagesKey, JSON.stringify(messages));
  } catch (error) {
    console.error("No se pudieron guardar los mensajes locales de demo", error);
  }
}

export function getDemoMessagesStorageKey() {
  return demoMessagesKey;
}

export function readDemoMessages(orderId: string, reload = false): OrderMessage[] {
  if (reload) {
    messages = {};
    messagesLoaded = false;
  }
  loadMessages();
  return respond(messages[orderId] ?? []);
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== "string") return {};
  return JSON.parse(init.body) as Record<string, unknown>;
}
function pathId(path: string) { return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? ""); }
function deliveryPathId(path: string) { return decodeURIComponent(path.split("/").filter(Boolean)[1] ?? ""); }
function respond<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function setDemoRole(role: Role | null) { demoRole = role; }
export function isDemoMode() { return demoRole !== null; }

export async function demoApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const [pathname, queryString = ""] = path.split("?");
  const query = new URLSearchParams(queryString);
  const body = bodyOf(init);

  if (method === "GET" && pathname === "/exchange-rate") return respond({ rate: exchangeRate, source: null, valueDate: null, updatedAt: null }) as T;
  if (method === "GET" && pathname === "/categories") return respond(categories) as T;
  if (method === "GET" && pathname === "/stores") {
    const categoryId = query.get("categoryId");
    const search = (query.get("search") ?? "").toLowerCase();
    const latitude = Number(query.get("latitude"));
    const longitude = Number(query.get("longitude"));
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && query.has("latitude") && query.has("longitude");
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const matchingStores = stores.filter((store) =>
      (!categoryId || store.category_id === categoryId) &&
      (!search || `${store.name} ${store.category_name}`.toLowerCase().includes(search)),
    ).map((store) => {
      if (!hasCoordinates || store.latitude == null || store.longitude == null) return store;
      const latDelta = radians(Number(store.latitude) - latitude);
      const lonDelta = radians(Number(store.longitude) - longitude);
      const distance = 2 * 6371 * Math.asin(Math.sqrt(
        Math.sin(latDelta / 2) ** 2 +
        Math.cos(radians(latitude)) * Math.cos(radians(Number(store.latitude))) *
        Math.sin(lonDelta / 2) ** 2,
      ));
      return { ...store, distance_km: distance };
    });
    if (hasCoordinates) matchingStores.sort((a, b) => Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity));
    return respond(matchingStores) as T;
  }
  if (method === "GET" && pathname === "/addresses") return respond(addresses) as T;
  if (method === "POST" && pathname === "/addresses") {
    const item: Address = {
      id: `demo-address-${Date.now()}`, label: String(body.label ?? "Casa"),
      address_line: String(body.addressLine), is_default: Boolean(body.isDefault) || addresses.length === 0,
      latitude: body.latitude == null ? null : Number(body.latitude),
      longitude: body.longitude == null ? null : Number(body.longitude),
    };
    if (item.is_default) addresses.forEach((saved) => { saved.is_default = false; });
    addresses.unshift(item);
    return respond(item) as T;
  }
  if (/^\/addresses\/[^/]+$/.test(pathname)) {
    const address = addresses.find((item) => item.id === pathId(pathname));
    if (method === "DELETE") {
      if (address) addresses.splice(addresses.indexOf(address), 1);
      if (address?.is_default && addresses[0]) addresses[0].is_default = true;
      return undefined as T;
    }
    if (method === "PATCH" && address) {
      if (body.isDefault) addresses.forEach((saved) => { saved.is_default = saved.id === address.id; });
      if (body.label !== undefined) address.label = String(body.label);
      if (body.addressLine !== undefined) address.address_line = String(body.addressLine);
      if (body.latitude !== undefined) address.latitude = body.latitude == null ? null : Number(body.latitude);
      if (body.longitude !== undefined) address.longitude = body.longitude == null ? null : Number(body.longitude);
      if (body.isDefault !== undefined) address.is_default = Boolean(body.isDefault);
      return respond(address) as T;
    }
  }
  if (method === "GET" && pathname === "/orders") {
    const visibleOrders = demoRole === "driver"
      ? orders.filter((order) => order.driver_id === driverId)
      : demoRole === "store"
        ? orders.filter((order) => order.store_id === storeId)
        : orders;
    return respond(visibleOrders) as T;
  }
  if (method === "POST" && pathname === "/orders") {
    const selectedStore = stores.find((store) => store.id === body.storeId);
    if (!selectedStore) throw new Error("Comercio no disponible");
    const requestedItems = body.items as Array<{ productId: string; quantity: number }>;
    const items = requestedItems.map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId && candidate.in_stock && (candidate.stock_quantity ?? 1) >= item.quantity);
      if (!product) throw new Error("Uno o más productos superan el stock disponible");
      product.stock_quantity = (product.stock_quantity ?? 1) - item.quantity;
      product.in_stock = product.stock_quantity > 0;
      return { id: `demo-item-${Date.now()}-${index}`, productName: product.name, quantity: item.quantity, total: Number(product.price) * item.quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const fee = selectedStore.free_delivery ? 0 : Number(selectedStore.delivery_fee ?? 2.99);
    const created: Order & { customer_id: string; driver_id?: string | null } = {
      id: `demo-order-${nextOrderId++}`, customer_id: "demo-customer", store_id: selectedStore.id,
      store_name: selectedStore.name, store_address: selectedStore.address, status: "placed",
      delivery_address: String(body.deliveryAddress ?? addresses.find((item) => item.id === body.addressId)?.address_line ?? ""),
      delivery_id: `demo-delivery-${nextOrderId}`, subtotal, delivery_fee: fee, total: subtotal + fee,
      has_own_delivery: selectedStore.has_own_delivery, has_review: false,
      payment_bank: "Banco de Venezuela", payment_document: "J-12345678-9", payment_phone: "0412-1234567",
      items: items.map((item, index) => {
        const product = products.find((candidate) => candidate.name === item.productName);
        const lineTotal = item.total;
        return { id: `demo-item-${index}`, productName: item.productName, quantity: item.quantity, unitPrice: product?.price, lineTotal };
      }),
    };
    orders.unshift(created);
    return respond(created) as T;
  }
  if (/^\/orders\/[^/]+\/messages$/.test(pathname)) {
    const id = decodeURIComponent(pathname.split("/")[2]);
    const order = orders.find((item) => item.id === id);
    loadMessages();
    messages[id] ??= [];
    if (method === "GET") return respond(messages[id]) as T;
    if (method === "POST") {
      const senderRole = demoRole ?? "customer";
      if (senderRole === "customer" && (body.paymentReference || body.attachmentUrl) && order?.status === "placed") {
        throw new Error("Espera la confirmación del comercio antes de transferir y enviar el comprobante");
      }
      if (senderRole === "store" && body.message === "Pago recibido y verificado" &&
        !messages[id].some((item) => item.sender_role === "customer" && (item.payment_reference || item.attachment_url))) {
        throw new Error("El cliente debe enviar el comprobante o la referencia antes de verificar el pago");
      }
      const message: OrderMessage = {
        id: `demo-message-${Date.now()}`, order_id: id, sender_id: `demo-${senderRole}`,
        sender_name: senderRole === "store" ? "Café de la Esquina" : "Alex Demo", sender_role: senderRole,
        message: String(body.message ?? ""), attachment_url: body.attachmentUrl ? String(body.attachmentUrl) : null,
        payment_reference: body.paymentReference ? String(body.paymentReference) : null,
        created_at: new Date().toISOString(),
      };
      messages[id].push(message);
      persistMessages();
      return respond(message) as T;
    }
  }
  if (/^\/orders\/[^/]+\/review$/.test(pathname) && method === "POST") {
    const order = orders.find((item) => item.id === decodeURIComponent(pathname.split("/")[2]));
    if (!order || order.status !== "delivered") throw new Error("Solo puedes reseñar pedidos entregados");
    if (order.has_review) throw new Error("Este pedido ya fue reseñado");
    order.has_review = true;
    return respond({ rating: body.rating, comment: body.comment ?? "" }) as T;
  }
  if (method === "GET" && pathname === "/stores/me") return respond({
    ...stores[0], description: "Café de especialidad y pan recién horneado.",
    payment_bank: "Banco de Venezuela", payment_document: "J-12345678-9", payment_phone: "0412-1234567",
  }) as T;
  if (method === "PATCH" && pathname === "/stores/me") {
    const store = stores[0];
    Object.assign(store, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address ? { address: body.address } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.hasOwnDelivery !== undefined ? { has_own_delivery: Boolean(body.hasOwnDelivery) } : {}),
      ...(body.freeDelivery !== undefined ? { free_delivery: Boolean(body.freeDelivery) } : {}),
      ...(body.paymentBank !== undefined ? { payment_bank: body.paymentBank } : {}),
      ...(body.paymentDocument !== undefined ? { payment_document: body.paymentDocument } : {}),
      ...(body.paymentPhone !== undefined ? { payment_phone: body.paymentPhone } : {}),
    });
    return respond(store) as T;
  }
  if (method === "GET" && pathname === "/products/mine") return respond(products.filter((product) => product.store_id === storeId)) as T;
  if (method === "GET" && /^\/stores\/[^/]+\/products$/.test(pathname)) {
    const id = pathname.split("/")[2];
    return respond(products.filter((product) => product.store_id === id)) as T;
  }
  if (method === "POST" && pathname === "/products") {
    const product: Product = {
      id: `demo-product-${Date.now()}`, store_id: storeId, name: String(body.name),
      description: String(body.description ?? ""), price: Number(body.price), in_stock: Number(body.stockQuantity ?? 1) > 0,
      stock_quantity: Number(body.stockQuantity ?? 1),
    };
    products.push(product);
    return respond(product) as T;
  }
  if (/^\/products\/[^/]+$/.test(pathname)) {
    const product = products.find((item) => item.id === pathId(pathname));
    if (method === "DELETE") {
      if (product) products.splice(products.indexOf(product), 1);
      return undefined as T;
    }
    if (method === "PATCH" && product) {
      if (body.name !== undefined) product.name = String(body.name);
      if (body.description !== undefined) product.description = String(body.description);
      if (body.price !== undefined) product.price = Number(body.price);
      if (body.imageUrl !== undefined) product.image_url = String(body.imageUrl);
      if (body.inStock !== undefined) product.in_stock = Boolean(body.inStock);
      if (body.stockQuantity !== undefined) {
        product.stock_quantity = Number(body.stockQuantity);
        product.in_stock = product.stock_quantity > 0;
      }
      return respond(product) as T;
    }
  }
  if (method === "GET" && pathname === "/deliveries/available") {
    return respond(orders.filter((order) => order.status === "ready" && !order.driver_id && !order.has_own_delivery).map((order) => ({
      ...order, delivery_id: order.delivery_id, store_latitude: 10.4806, store_longitude: -66.9036,
    }))) as T;
  }
  if (method === "POST" && pathname === "/drivers/location") return undefined as T;
  if (method === "POST" && /^\/deliveries\/[^/]+\/accept$/.test(pathname)) {
    const order = orders.find((item) => item.delivery_id === deliveryPathId(pathname));
    if (!order || order.driver_id) throw new Error("Este pedido ya fue asignado");
    order.driver_id = driverId;
    return respond({ deliveryId: order.delivery_id, order }) as T;
  }
  if (method === "PATCH" && /^\/deliveries\/[^/]+\/status$/.test(pathname)) {
    const order = orders.find((item) => item.delivery_id === deliveryPathId(pathname) && item.driver_id === driverId);
    if (!order) throw new Error("Entrega no encontrada");
    order.status = String(body.status);
    return respond({ delivery: { id: order.delivery_id, status: body.status }, order }) as T;
  }
  if (method === "PATCH" && /^\/orders\/[^/]+\/status$/.test(pathname)) {
    const order = orders.find((item) => item.id === pathId(pathname));
    if (!order) throw new Error("Pedido no encontrado");
    if (body.status === "preparing" && !messages[order.id]?.some((item) =>
      item.sender_role === "customer" && (item.payment_reference || item.attachment_url))) {
      throw new Error("El cliente debe enviar la captura del comprobante o el número de referencia antes de preparar el pedido");
    }
    order.status = String(body.status);
    return respond(order) as T;
  }
  throw new Error(`Esta acción todavía no está disponible en la demo (${method} ${pathname})`);
}
