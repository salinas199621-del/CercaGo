import type { Category, Order, Product, Role, Store } from "./types";

const storeId = "demo-store-cafe";
const secondStoreId = "demo-store-market";
const driverId = "demo-driver";
let demoRole: Role | null = null;
let nextOrderId = 3;

const stores: Store[] = [
  { id: storeId, category_id: "demo-cat-food", name: "Café de la Esquina", address: "Av. Central 123", category_name: "Restaurantes", distance_km: 0.8, rating: 4.9, delivery_fee: 0, estimated_delivery_minutes: 20, image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-28T10:00:00.000Z" },
  { id: secondStoreId, category_id: "demo-cat-market", name: "Mercadito CercaGo", address: "Calle Norte 45", category_name: "Supermercados", distance_km: 1.4, rating: 4.7, delivery_fee: 2.99, estimated_delivery_minutes: 30, image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85", created_at: "2026-10-25T10:00:00.000Z" },
  { id: "demo-store-pizza", category_id: "demo-cat-food", name: "Pizza Barrio", address: "Plaza del Sol 8", category_name: "Restaurantes", distance_km: 2.1, rating: 4.8, delivery_fee: 0, estimated_delivery_minutes: 25, image_url: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85", created_at: "2026-11-01T10:00:00.000Z" },
];

const categories: Category[] = [
  { id: "demo-cat-food", name: "Restaurantes" },
  { id: "demo-cat-market", name: "Supermercados" },
  { id: "demo-cat-pharmacy", name: "Farmacias" },
  { id: "demo-cat-shops", name: "Tiendas" },
  { id: "demo-cat-coffee", name: "Cafeterías" },
];

const products: Product[] = [
  { id: "demo-product-latte", store_id: storeId, name: "Latte de la casa", description: "Espresso doble con leche cremosa", price: 4.5, in_stock: true },
  { id: "demo-product-toast", store_id: storeId, name: "Tostada de aguacate", description: "Pan artesanal, aguacate y tomate", price: 8.25, in_stock: true },
  { id: "demo-product-croissant", store_id: storeId, name: "Croissant de mantequilla", description: "Horneado esta mañana", price: 3.75, in_stock: true },
  { id: "demo-product-juice", store_id: storeId, name: "Jugo de naranja", description: "Natural, recién exprimido", price: 3.5, in_stock: false },
  { id: "demo-product-fruit", store_id: secondStoreId, name: "Canasta de frutas", description: "Selección fresca del día", price: 12.9, in_stock: true },
];

const orders: Array<Order & { customer_id: string; driver_id?: string | null }> = [
  {
    id: "demo-order-placed", customer_id: "demo-customer", store_id: storeId, store_name: "Café de la Esquina",
    store_address: "Av. Central 123", status: "placed", delivery_address: "Calle Los Pinos 27",
    delivery_id: "demo-delivery-placed", total: 16.04,
    items: [{ id: "demo-item-1", productName: "Latte de la casa", quantity: 1 }, { id: "demo-item-2", productName: "Tostada de aguacate", quantity: 1 }],
  },
  {
    id: "demo-order-ready", customer_id: "demo-customer", store_id: secondStoreId, store_name: "Mercadito CercaGo",
    store_address: "Calle Norte 45", status: "ready", delivery_address: "Av. Las Flores 310",
    delivery_id: "demo-delivery-ready", total: 15.89,
    items: [{ id: "demo-item-3", productName: "Canasta de frutas", quantity: 1 }],
  },
];

function bodyOf(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== "string") return {};
  return JSON.parse(init.body) as Record<string, unknown>;
}

function pathId(path: string) {
  return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
}

function deliveryPathId(path: string) {
  return decodeURIComponent(path.split("/").filter(Boolean)[1] ?? "");
}

function respond<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function setDemoRole(role: Role | null) {
  demoRole = role;
}

export function isDemoMode() {
  return demoRole !== null;
}

export async function demoApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const [pathname, queryString = ""] = path.split("?");
  const query = new URLSearchParams(queryString);
  const body = bodyOf(init);

  if (method === "GET" && pathname === "/categories") return respond(categories) as T;
  if (method === "GET" && pathname === "/stores") {
    const categoryId = query.get("categoryId");
    const search = (query.get("search") ?? "").toLowerCase();
    return respond(stores.filter((store) =>
      (!categoryId || store.category_id === categoryId) &&
      (!search || `${store.name} ${store.category_name}`.toLowerCase().includes(search)),
    )) as T;
  }
  if (method === "GET" && pathname === "/addresses") {
    return respond([{ id: "demo-address-home", label: "Casa", address_line: "Calle Los Pinos 27" }]) as T;
  }
  if (method === "POST" && pathname === "/addresses") {
    return respond({ id: "demo-address-new", label: body.label ?? "Casa", address_line: body.addressLine }) as T;
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
      const product = products.find((candidate) => candidate.id === item.productId && candidate.in_stock);
      if (!product) throw new Error("Uno o más productos no están disponibles");
      return { id: `demo-item-${Date.now()}-${index}`, productName: product.name, quantity: item.quantity, total: Number(product.price) * item.quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const created: Order & { customer_id: string; driver_id?: string | null } = {
      id: `demo-order-${nextOrderId++}`, customer_id: "demo-customer", store_id: selectedStore.id,
      store_name: selectedStore.name, store_address: selectedStore.address, status: "placed",
      delivery_address: String(body.deliveryAddress ?? "Calle Los Pinos 27"),
      delivery_id: `demo-delivery-${nextOrderId}`, total: subtotal + 2.99,
      items: items.map((item, index) => ({ id: `demo-item-${index}`, productName: item.productName, quantity: item.quantity })),
    };
    orders.unshift(created);
    return respond(created) as T;
  }
  if (method === "GET" && pathname === "/stores/me") {
    return respond({ ...stores[0], description: "Café de especialidad y pan recién horneado." }) as T;
  }
  if (method === "PATCH" && pathname === "/stores/me") {
    Object.assign(stores[0], {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address ? { address: body.address } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
    return respond(stores[0]) as T;
  }
  if (method === "GET" && pathname === "/products/mine") {
    return respond(products.filter((product) => product.store_id === storeId)) as T;
  }
  if (method === "GET" && /^\/stores\/[^/]+\/products$/.test(pathname)) {
    const id = pathname.split("/")[2];
    return respond(products.filter((product) => product.store_id === id)) as T;
  }
  if (method === "POST" && pathname === "/products") {
    const product: Product = {
      id: `demo-product-${Date.now()}`, store_id: storeId, name: String(body.name),
      description: String(body.description ?? ""), price: Number(body.price), in_stock: true,
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
      return respond(product) as T;
    }
  }
  if (method === "GET" && pathname === "/deliveries/available") {
    return respond(orders.filter((order) => order.status === "ready" && !order.driver_id).map((order) => ({
      ...order,
      delivery_id: order.delivery_id,
      store_latitude: 18.4861,
      store_longitude: -69.9312,
    }))) as T;
  }
  if (method === "POST" && /^\/drivers\/location$/.test(pathname)) return undefined as T;
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
    order.status = String(body.status);
    return respond(order) as T;
  }
  throw new Error(`Esta acción todavía no está disponible en la demo (${method} ${pathname})`);
}
