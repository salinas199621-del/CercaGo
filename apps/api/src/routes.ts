import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "./db";
import { allowRoles, authenticate, jwtSecret } from "./middleware/auth";
import { asyncHandler } from "./middleware/asyncHandler";
import type { AuthRequest } from "./types";

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional(),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "La contraseña no puede superar 72 bytes"),
  role: z.enum(["customer", "store", "driver"]).default("customer"),
  store: z.object({
    name: z.string().trim().min(2).max(160),
    address: z.string().trim().min(5),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid().optional(),
  }).optional(),
});

function actor(req: AuthRequest) {
  if (!req.user) throw Object.assign(new Error("Autenticación requerida"), { status: 401 });
  return req.user;
}

async function getStoreIdForOwner(userId: string) {
  const result = await pool.query<{ id: string }>("SELECT id FROM stores WHERE owner_id = $1", [userId]);
  return result.rows[0]?.id as string | undefined;
}

function tokenFor(user: { id: string; role: string; name: string }) {
  return jwt.sign({ role: user.role, name: user.name }, jwtSecret(), {
    subject: user.id,
    expiresIn: (process.env.JWT_EXPIRES_IN || "1d") as NonNullable<jwt.SignOptions["expiresIn"]>,
  });
}

router.post("/auth/register", asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  if (input.role === "store" && !input.store) return res.status(400).json({ error: "Los comercios requieren nombre y dirección del negocio" });
  if (input.role !== "store" && input.store) return res.status(400).json({ error: "El perfil de comercio solo aplica a ese rol" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const userResult = await client.query(
      `INSERT INTO users(name, email, phone, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4, $5)
       RETURNING id, name, email, phone, role`,
      [input.name, input.email, input.phone ?? null, passwordHash, input.role],
    );
    const user = userResult.rows[0];
    if (input.store) {
      await client.query(
        `INSERT INTO stores(owner_id, category_id, name, description, address, commission_rate)
         VALUES ($1, $2, $3, $4, $5,
           COALESCE((SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'default_commission_rate'), 10))`,
        [user.id, input.store.categoryId ?? null, input.store.name, input.store.description ?? null, input.store.address],
      );
    }
    await client.query("COMMIT");
    return res.status(201).json({ user, token: tokenFor(user) });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "El correo ya está registrado" });
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const result = await pool.query(
    "SELECT id, name, email, phone, role, password_hash, active FROM users WHERE email = LOWER($1)",
    [input.email],
  );
  const user = result.rows[0];
  if (!user || !user.active || !(await bcrypt.compare(input.password, user.password_hash))) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }
  const { password_hash: _passwordHash, active: _active, ...safeUser } = user;
  return res.json({ user: safeUser, token: tokenFor(user) });
}));

router.get("/auth/me", authenticate, (req, res) => res.json({ user: actor(req as AuthRequest) }));

router.get("/categories", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name, icon_url FROM categories WHERE active = TRUE ORDER BY name");
  return res.json(rows);
}));

router.get("/stores", asyncHandler(async (req, res) => {
  const query = z.object({
    categoryId: z.string().uuid().optional(),
    search: z.string().trim().max(120).optional(),
  }).parse(req.query);
  const categoryId = query.categoryId ?? null;
  const search = query.search ?? "";
  const coordinates = z.object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }).parse({
    latitude: req.query.latitude,
    longitude: req.query.longitude,
  });
  if ((coordinates.latitude === undefined) !== (coordinates.longitude === undefined)) {
    return res.status(400).json({ error: "Debes enviar latitud y longitud juntas" });
  }
  const { rows } = await pool.query(
    `SELECT s.id, s.category_id, s.name, s.description, s.address, s.latitude, s.longitude, s.image_url,
            s.rating, s.delivery_fee, s.estimated_delivery_minutes, s.created_at,
            c.name AS category_name,
            CASE WHEN $3::float8 IS NULL THEN NULL ELSE 6371 * acos(LEAST(1.0,
              sin(radians($3::float8)) * sin(radians(s.latitude::float8)) +
              cos(radians($3::float8)) * cos(radians(s.latitude::float8)) *
              cos(radians(s.longitude::float8 - $4::float8))
            )) END AS distance_km
     FROM stores s LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.active = TRUE AND s.approved = TRUE
       AND ($1::uuid IS NULL OR s.category_id = $1)
       AND ($2 = '' OR s.name ILIKE '%' || $2 || '%' OR COALESCE(s.description, '') ILIKE '%' || $2 || '%')
     ORDER BY distance_km NULLS LAST, s.name LIMIT 100`,
    [categoryId, search, coordinates.latitude ?? null, coordinates.longitude ?? null],
  );
  return res.json(rows);
}));

router.get("/stores/:storeId/products", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.store_id, p.name, p.description, p.price, p.image_url, p.in_stock
     FROM products p JOIN stores s ON s.id = p.store_id
     WHERE p.store_id = $1 AND p.active = TRUE AND s.active = TRUE AND s.approved = TRUE
     ORDER BY p.name`,
    [req.params.storeId],
  );
  return res.json(rows);
}));

router.get("/stores/me", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM stores WHERE owner_id = $1", [actor(req as AuthRequest).id]);
  if (!rows[0]) return res.status(404).json({ error: "Comercio no encontrado" });
  return res.json(rows[0]);
}));

router.get("/products/mine", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const storeId = await getStoreIdForOwner(actor(req as AuthRequest).id);
  if (!storeId) return res.status(404).json({ error: "No existe un comercio asociado" });
  const { rows } = await pool.query("SELECT * FROM products WHERE store_id = $1 AND active = TRUE ORDER BY name", [storeId]);
  return res.json(rows);
}));

router.post("/products", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const storeId = await getStoreIdForOwner(user.id);
  if (!storeId) return res.status(404).json({ error: "No existe un comercio asociado" });
  const input = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).optional(),
    price: z.number().nonnegative(),
    imageUrl: z.string().url().optional(),
    inStock: z.boolean().default(true),
  }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO products(store_id, name, description, price, image_url, in_stock)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    [storeId, input.name, input.description ?? null, input.price, input.imageUrl ?? null, input.inStock],
  );
  return res.status(201).json(rows[0]);
}));

router.patch("/products/:productId", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    price: z.number().nonnegative().optional(),
    imageUrl: z.string().url().nullable().optional(),
    inStock: z.boolean().optional(),
    active: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(req.body);
  const storeId = await getStoreIdForOwner(user.id);
  const columnNames: Record<string, string> = {
    name: "name",
    description: "description",
    price: "price",
    imageUrl: "image_url",
    inStock: "in_stock",
    active: "active",
  };
  const fields = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [columnNames[key], value] as [string, unknown]);
  const setters = fields.map(([column], index) => `${column} = $${index + 1}`);
  const values = fields.map(([, value]) => value);
  const { rows } = await pool.query(
    `UPDATE products SET ${setters.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length + 1} AND store_id = $${values.length + 2} RETURNING *`,
    [...values, req.params.productId, storeId],
  );
  if (!rows[0]) return res.status(404).json({ error: "Producto no encontrado" });
  return res.json(rows[0]);
}));

router.delete("/products/:productId", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const storeId = await getStoreIdForOwner(actor(req as AuthRequest).id);
  const result = await pool.query("UPDATE products SET active = FALSE WHERE id = $1 AND store_id = $2", [req.params.productId, storeId]);
  if (!result.rowCount) return res.status(404).json({ error: "Producto no encontrado" });
  return res.status(204).send();
}));

router.patch("/stores/me", authenticate, allowRoles("store"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    address: z.string().trim().min(5).optional(),
    imageUrl: z.string().url().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }).parse(req.body);
  const columns = { name: "name", description: "description", address: "address", imageUrl: "image_url", latitude: "latitude", longitude: "longitude" } as const;
  const fields = Object.entries(input).filter(([, value]) => value !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No se recibieron cambios" });
  const setters = fields.map(([key], i) => `${columns[key as keyof typeof columns]} = $${i + 1}`);
  const values = fields.map(([, value]) => value);
  const { rows } = await pool.query(
    `UPDATE stores SET ${setters.join(", ")} WHERE owner_id = $${values.length + 1} RETURNING *`,
    [...values, user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Comercio no encontrado" });
  return res.json(rows[0]);
}));

router.post("/addresses", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    label: z.string().max(60).default("Casa"),
    addressLine: z.string().trim().min(5),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    instructions: z.string().max(1000).optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO addresses(user_id, label, address_line, latitude, longitude, instructions)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    [user.id, input.label, input.addressLine, input.latitude ?? null, input.longitude ?? null, input.instructions ?? null],
  );
  return res.status(201).json(rows[0]);
}));

router.get("/addresses", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, label, address_line, latitude, longitude, instructions FROM addresses WHERE user_id = $1 ORDER BY created_at DESC",
    [actor(req as AuthRequest).id],
  );
  return res.json(rows);
}));

router.post("/orders", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    storeId: z.string().uuid(),
    addressId: z.string().uuid().optional(),
    deliveryAddress: z.string().trim().min(5).optional(),
    deliveryLatitude: z.number().min(-90).max(90).optional(),
    deliveryLongitude: z.number().min(-180).max(180).optional(),
    notes: z.string().max(1000).optional(),
    items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
  }).parse(req.body);
  const client = await pool.connect();
  let order: Record<string, unknown>;
  try {
    await client.query("BEGIN");
    const store = await client.query("SELECT id FROM stores WHERE id = $1 AND active = TRUE AND approved = TRUE FOR SHARE", [input.storeId]);
    if (!store.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Comercio no disponible" });
    }
    let deliveryAddress = input.deliveryAddress;
    let deliveryLatitude = input.deliveryLatitude ?? null;
    let deliveryLongitude = input.deliveryLongitude ?? null;
    if (input.addressId) {
      const address = await client.query(
        "SELECT address_line, latitude, longitude FROM addresses WHERE id = $1 AND user_id = $2",
        [input.addressId, user.id],
      );
      if (!address.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Dirección no válida" });
      }
      deliveryAddress = address.rows[0].address_line;
      deliveryLatitude = address.rows[0].latitude;
      deliveryLongitude = address.rows[0].longitude;
    }
    if (!deliveryAddress) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Indica una dirección de entrega" });
    }

    const productIds = input.items.map((item) => item.productId);
    const products = await client.query(
      `SELECT id, name, price::text AS price FROM products
       WHERE store_id = $1 AND active = TRUE AND in_stock = TRUE AND id = ANY($2::uuid[]) FOR SHARE`,
      [input.storeId, productIds],
    );
    if (products.rowCount !== new Set(productIds).size) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Uno o más productos no están disponibles en este comercio" });
    }
    const byId = new Map(products.rows.map((product) => [product.id, product]));
    const items = input.items.map((item) => ({ ...item, product: byId.get(item.productId)! }));
    const subtotalCents = items.reduce((sum, item) => sum + Math.round(Number(item.product.price) * 100) * item.quantity, 0);
    const deliveryFeeCents = 299;
    const created = await client.query(
      `INSERT INTO orders(customer_id, store_id, address_id, delivery_address, delivery_latitude,
                          delivery_longitude, subtotal, delivery_fee, total, notes)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [user.id, input.storeId, input.addressId ?? null, deliveryAddress, deliveryLatitude, deliveryLongitude,
        (subtotalCents / 100).toFixed(2), (deliveryFeeCents / 100).toFixed(2),
        ((subtotalCents + deliveryFeeCents) / 100).toFixed(2), input.notes ?? null],
    );
    order = created.rows[0];
    for (const item of items) {
      const unitCents = Math.round(Number(item.product.price) * 100);
      await client.query(
        `INSERT INTO order_items(order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [order.id, item.productId, item.product.name, (unitCents / 100).toFixed(2), item.quantity, (unitCents * item.quantity / 100).toFixed(2)],
      );
    }
    await client.query("INSERT INTO deliveries(order_id) VALUES($1)", [order.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const io = req.app.get("io");
  io?.to(`store:${input.storeId}`).emit("order:new", order);
  return res.status(201).json(order);
}));

router.get("/orders", authenticate, asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  let where: string;
  let parameters: unknown[];
  if (user.role === "customer") {
    where = "o.customer_id = $1";
    parameters = [user.id];
  } else if (user.role === "store") {
    where = "o.store_id = (SELECT id FROM stores WHERE owner_id = $1)";
    parameters = [user.id];
  } else if (user.role === "driver") {
    where = "EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = o.id AND d.driver_id = $1)";
    parameters = [user.id];
  } else {
    where = "TRUE";
    parameters = [];
  }
  const { rows } = await pool.query(
    `SELECT o.*, s.name AS store_name, s.address AS store_address, s.latitude AS store_latitude,
            s.longitude AS store_longitude, d.id AS delivery_id, d.driver_id, d.status AS delivery_status,
            COALESCE((SELECT json_agg(json_build_object('id', oi.id, 'productName', oi.product_name,
                    'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total))
                      FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items
     FROM orders o JOIN stores s ON s.id = o.store_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT 100`,
    parameters,
  );
  return res.json(rows);
}));

router.patch("/orders/:orderId/status", authenticate, asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const { status } = z.object({ status: z.enum(["accepted", "preparing", "ready", "cancelled"]) }).parse(req.body);
  if (!["store", "admin"].includes(user.role)) return res.status(403).json({ error: "Permisos insuficientes" });
  const storeId = user.role === "store" ? await getStoreIdForOwner(user.id) : null;
  const client = await pool.connect();
  let updated;
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT o.*, d.id AS delivery_id, s.latitude AS store_latitude, s.longitude AS store_longitude
       FROM orders o JOIN deliveries d ON d.order_id = o.id JOIN stores s ON s.id = o.store_id
       WHERE o.id = $1 AND ($2::uuid IS NULL OR o.store_id = $2) FOR UPDATE OF o, d`,
      [req.params.orderId, storeId],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    const allowed: Record<string, string[]> = {
      placed: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
    };
    if (!allowed[current.rows[0].status]?.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `No se puede cambiar de ${current.rows[0].status} a ${status}` });
    }
    if (status === "ready" && (current.rows[0].store_latitude == null || current.rows[0].store_longitude == null)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Configura la ubicación del comercio antes de marcar pedidos como listos" });
    }
    const result = await client.query(
      "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, req.params.orderId],
    );
    updated = result.rows[0];
    if (status === "ready") {
      await client.query("UPDATE deliveries SET status = 'pending' WHERE order_id = $1", [req.params.orderId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const io = req.app.get("io");
  io?.to(`customer:${updated.customer_id}`).emit("order:status", updated);
  if (status === "ready") {
    const drivers = await pool.query(
      `SELECT dl.user_id FROM driver_locations dl
       JOIN stores s ON s.id = $1
       WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         AND 6371 * acos(LEAST(1.0,
           sin(radians(dl.latitude::float8)) * sin(radians(s.latitude::float8)) +
           cos(radians(dl.latitude::float8)) * cos(radians(s.latitude::float8)) *
           cos(radians(s.longitude::float8 - dl.longitude::float8))
         )) <= COALESCE((SELECT (value #>> '{}')::float8 FROM app_settings WHERE key = 'delivery_zone_radius_km'), 15)`,
      [updated.store_id],
    );
    for (const driver of drivers.rows) io?.to(`driver:${driver.user_id}`).emit("delivery:available", updated);
  }
  return res.json(updated);
}));

router.post("/drivers/location", authenticate, allowRoles("driver"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const { latitude, longitude } = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).parse(req.body);
  await pool.query(
    `INSERT INTO driver_locations(user_id, latitude, longitude, updated_at)
     VALUES($1, $2, $3, NOW())
     ON CONFLICT(user_id) DO UPDATE SET latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude, updated_at = NOW()`,
    [user.id, latitude, longitude],
  );
  return res.status(204).send();
}));

router.get("/deliveries/available", authenticate, allowRoles("driver"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const location = await pool.query("SELECT user_id FROM driver_locations WHERE user_id = $1", [user.id]);
  if (!location.rowCount) return res.status(409).json({ error: "Activa la ubicación para consultar pedidos en tu zona" });
  const { rows } = await pool.query(
    `SELECT o.id, o.store_id, o.delivery_address, o.delivery_latitude, o.delivery_longitude,
            o.total, o.created_at, s.name AS store_name, s.address AS store_address, s.latitude AS store_latitude,
            s.longitude AS store_longitude, d.id AS delivery_id,
            6371 * acos(LEAST(1.0,
              sin(radians(dl.latitude::float8)) * sin(radians(s.latitude::float8)) +
              cos(radians(dl.latitude::float8)) * cos(radians(s.latitude::float8)) *
              cos(radians(s.longitude::float8 - dl.longitude::float8))
            )) AS distance_km
     FROM orders o JOIN stores s ON s.id = o.store_id
     JOIN deliveries d ON d.order_id = o.id
     JOIN driver_locations dl ON dl.user_id = $1
     WHERE o.status = 'ready' AND d.status = 'pending' AND d.driver_id IS NULL
       AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       AND 6371 * acos(LEAST(1.0,
         sin(radians(dl.latitude::float8)) * sin(radians(s.latitude::float8)) +
         cos(radians(dl.latitude::float8)) * cos(radians(s.latitude::float8)) *
         cos(radians(s.longitude::float8 - dl.longitude::float8))
       )) <= COALESCE((SELECT (value #>> '{}')::float8 FROM app_settings WHERE key = 'delivery_zone_radius_km'), 15)
     ORDER BY distance_km, o.created_at LIMIT 50`,
    [user.id],
  );
  return res.json(rows);
}));

router.post("/deliveries/:deliveryId/accept", authenticate, allowRoles("driver"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN");
    result = await client.query(
      `UPDATE deliveries SET driver_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2 AND driver_id IS NULL AND status = 'pending'
         AND order_id IN (SELECT id FROM orders WHERE status = 'ready')
       RETURNING id, order_id`,
      [user.id, req.params.deliveryId],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Este pedido ya fue asignado o no está listo" });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [result.rows[0].order_id]);
  const order = rows[0];
  req.app.get("io")?.to(`customer:${order.customer_id}`).emit("delivery:assigned", order);
  return res.json({ deliveryId: result.rows[0].id, order });
}));

router.patch("/deliveries/:deliveryId/status", authenticate, allowRoles("driver"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const { status } = z.object({ status: z.enum(["picked_up", "delivered"]) }).parse(req.body);
  const client = await pool.connect();
  let delivery;
  let order;
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT d.id, d.order_id, o.status AS order_status, o.customer_id
       FROM deliveries d JOIN orders o ON o.id = d.order_id
       WHERE d.id = $1 AND d.driver_id = $2 FOR UPDATE OF d, o`,
      [req.params.deliveryId, user.id],
    );
    if (!found.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    const current = found.rows[0];
    const valid = status === "picked_up" ? current.order_status === "ready" : current.order_status === "picked_up";
    if (!valid) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La transición de entrega no es válida" });
    }
    const deliveryResult = await client.query(
      `UPDATE deliveries SET status = $1,
       picked_up_at = CASE WHEN $1 = 'picked_up' THEN NOW() ELSE picked_up_at END,
       delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
       WHERE id = $2 RETURNING *`,
      [status, current.id],
    );
    const orderStatus = status === "picked_up" ? "picked_up" : "delivered";
    const orderResult = await client.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [orderStatus, current.order_id]);
    delivery = deliveryResult.rows[0];
    order = orderResult.rows[0];
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  req.app.get("io")?.to(`customer:${order.customer_id}`).emit("order:status", order);
  req.app.get("io")?.to(`store:${order.store_id}`).emit("order:status", order);
  return res.json({ delivery, order });
}));

router.get("/admin/metrics", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const [users, stores, orders, sales] = await Promise.all([
    pool.query("SELECT role, COUNT(*)::int AS count FROM users GROUP BY role"),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE approved)::int AS approved FROM stores"),
    pool.query("SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status"),
    pool.query("SELECT COALESCE(SUM(total), 0)::numeric(14,2) AS gross_sales, COUNT(*)::int AS order_count FROM orders WHERE status <> 'cancelled'"),
  ]);
  return res.json({ users: users.rows, stores: stores.rows[0], orders: orders.rows, sales: sales.rows[0] });
}));

router.get("/admin/settings/commission", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT value #>> '{}' AS rate FROM app_settings WHERE key = 'default_commission_rate'");
  return res.json({ rate: Number(rows[0]?.rate ?? 10) });
}));

router.get("/admin/stores", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, u.name AS owner_name, u.email AS owner_email, c.name AS category_name
     FROM stores s JOIN users u ON u.id = s.owner_id LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY s.created_at DESC LIMIT 500`,
  );
  return res.json(rows);
}));

router.patch("/admin/stores/:storeId", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const input = z.object({
    approved: z.boolean().optional(),
    active: z.boolean().optional(),
    commissionRate: z.number().min(0).max(100).optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(req.body);
  const mapping = { approved: "approved", active: "active", commissionRate: "commission_rate" } as const;
  const fields = Object.entries(input).filter(([, value]) => value !== undefined);
  const sets = fields.map(([key], index) => `${mapping[key as keyof typeof mapping]} = $${index + 1}`);
  const { rows } = await pool.query(
    `UPDATE stores SET ${sets.join(", ")} WHERE id = $${fields.length + 1} RETURNING *`,
    [...fields.map(([, value]) => value), req.params.storeId],
  );
  if (!rows[0]) return res.status(404).json({ error: "Comercio no encontrado" });
  return res.json(rows[0]);
}));

router.get("/admin/users", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name, email, phone, role, active, created_at FROM users ORDER BY created_at DESC LIMIT 1000");
  return res.json(rows);
}));

router.patch("/admin/users/:userId", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const input = z.object({ active: z.boolean() }).parse(req.body);
  const { rows } = await pool.query(
    "UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2 AND role <> 'admin' RETURNING id, name, email, role, active",
    [input.active, req.params.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado o no modificable" });
  return res.json(rows[0]);
}));

router.patch("/admin/settings/commission", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const { rate } = z.object({ rate: z.number().min(0).max(100) }).parse(req.body);
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES('default_commission_rate', $1::jsonb, NOW())
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(rate)],
  );
  return res.json({ rate });
}));

export default router;
