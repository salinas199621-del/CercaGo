import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { pool } from "./db";
import { allowRoles, authenticate, jwtSecret } from "./middleware/auth";
import { asyncHandler } from "./middleware/asyncHandler";
import { refreshExchangeRate } from "./exchangeRate";
import type { AuthRequest } from "./types";

const router = Router();
const googleOAuthClient = new OAuth2Client();
const passwordSchema = z.string().min(10).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "La contraseña no puede superar 72 bytes");
const promotionSchema = z.array(z.object({
  id: z.string().trim().min(1).max(100),
  tag: z.string().trim().max(60),
  title: z.string().trim().max(100),
  body: z.string().trim().max(200),
  mediaType: z.enum(["image", "video"]),
  mediaUrl: z.string().url().refine((value) => value.startsWith("https://"), "El medio debe usar HTTPS"),
  linkUrl: z.string().url().refine((value) => value.startsWith("https://"), "El enlace debe usar HTTPS").optional(),
  tint: z.string().regex(/^#[\da-f]{6}$/i),
})).max(20);
let reverseGeocodeQueue = Promise.resolve();
let lastReverseGeocodeAt = 0;
const reverseGeocodeCache = new Map<string, { street: string; city: string }>();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^\+58\d{10}$/, "El teléfono debe tener formato +58 seguido de 10 dígitos"),
  password: passwordSchema,
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
    expiresIn: (process.env.JWT_EXPIRES_IN || "30d") as NonNullable<jwt.SignOptions["expiresIn"]>,
  });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("58") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  return national.length === 10 ? `+58${national}` : null;
}

function resetCodeHash(userId: string, code: string) {
  return createHmac("sha256", jwtSecret()).update(`${userId}:${code}`).digest();
}

function passwordResetDeliveryConfigured(isEmail: boolean) {
  if (isEmail) {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
  }
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

async function deliverPasswordResetCode(destination: string, code: string, isEmail: boolean) {
  if (isEmail) {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    const port = Number(process.env.SMTP_PORT || 587);
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !Number.isInteger(port)) {
      throw new Error("El envío de correo para recuperación no está configurado.");
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: SMTP_FROM,
      to: destination,
      subject: "Código para recuperar tu cuenta CercaGo",
      text: `Tu código de recuperación CercaGo es ${code}. Vence en 10 minutos. Si no solicitaste este código, ignora este mensaje.`,
    });
    return;
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    throw new Error("El envío de SMS para recuperación no está configurado.");
  }
  const form = new URLSearchParams({
    To: destination,
    From: TWILIO_FROM,
    Body: `Tu código de recuperación CercaGo es ${code}. Vence en 10 minutos.`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`El proveedor de SMS respondió HTTP ${response.status}`);
}

function userIdentifier(identifier: string) {
  if (identifier.includes("@")) return { isEmail: true, value: identifier.trim().toLowerCase() };
  return { isEmail: false, value: normalizePhone(identifier) };
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
      [input.name, input.email, input.phone, passwordHash, input.role],
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
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "El correo o teléfono ya está registrado" });
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const input = z.object({ identifier: z.string().trim().min(1).max(255), password: z.string().min(1) }).parse(req.body);
  const { isEmail, value } = userIdentifier(input.identifier);
  const result = await pool.query(
    "SELECT id, name, email, phone, role, password_hash, active FROM users WHERE ($1::text IS NOT NULL AND email = LOWER($1)) OR ($2::text IS NOT NULL AND phone = $2)",
    [isEmail ? value : null, isEmail ? null : value],
  );
  const user = result.rows[0];
  if (!user || !user.active || !user.password_hash || !(await bcrypt.compare(input.password, user.password_hash))) {
    return res.status(401).json({ error: "Correo/teléfono o contraseña incorrectos" });
  }
  const { password_hash: _passwordHash, active: _active, ...safeUser } = user;
  return res.json({ user: safeUser, token: tokenFor(user) });
}));

router.post("/auth/password/change", authenticate, asyncHandler(async (req, res) => {
  const input = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "La contraseña no puede superar 72 bytes",
    ),
  }).parse(req.body);
  const userId = actor(req as AuthRequest).id;
  const { rows } = await pool.query<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE id = $1 AND active = TRUE",
    [userId],
  );
  const passwordHash = rows[0]?.password_hash;
  if (!passwordHash || !(await bcrypt.compare(input.currentPassword, passwordHash))) {
    return res.status(401).json({ error: "La contraseña actual es incorrecta" });
  }
  const nextHash = await bcrypt.hash(input.newPassword, 12);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [nextHash, userId]);
  return res.json({ message: "Contraseña actualizada correctamente" });
}));

router.post("/auth/password-reset/request", asyncHandler(async (req, res) => {
  const input = z.object({ identifier: z.string().trim().min(1).max(255) }).parse(req.body);
  const { isEmail, value } = userIdentifier(input.identifier);
  if (!value) return res.status(202).json({ message: "Si la cuenta existe, enviaremos un código de recuperación." });
  if (!passwordResetDeliveryConfigured(isEmail)) {
    return res.status(503).json({ error: `La recuperación por ${isEmail ? "correo" : "SMS"} no está configurada.` });
  }
  const { rows } = await pool.query(
    `SELECT id, email, phone FROM users WHERE active = TRUE AND ${isEmail ? "email = LOWER($1)" : "phone = $1"} LIMIT 1`,
    [value],
  );
  const user = rows[0] as { id: string; email: string; phone: string | null } | undefined;
  if (!user) return res.status(202).json({ message: "Si la cuenta existe, enviaremos un código de recuperación." });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pool.query(
    `INSERT INTO password_reset_codes(user_id, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = NOW()`,
    [user.id, resetCodeHash(user.id, code)],
  );
  try {
    const destination = isEmail ? user.email : user.phone;
    if (!destination) throw new Error("La cuenta no tiene un medio de recuperación registrado.");
    await deliverPasswordResetCode(destination, code, isEmail);
  } catch (error) {
    await pool.query("DELETE FROM password_reset_codes WHERE user_id = $1", [user.id]);
    console.error("No se pudo entregar el código de recuperación", error);
    return res.status(503).json({ error: "No se pudo enviar el código. Intenta de nuevo más tarde." });
  }
  return res.status(202).json({ message: "Si la cuenta existe, enviaremos un código de recuperación." });
}));

router.post("/auth/password-reset/confirm", asyncHandler(async (req, res) => {
  const input = z.object({
    identifier: z.string().trim().min(1).max(255),
    code: z.string().regex(/^\d{6}$/),
    password: passwordSchema,
  }).parse(req.body);
  const { isEmail, value } = userIdentifier(input.identifier);
  if (!value) return res.status(400).json({ error: "El código no es válido o venció." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `SELECT id FROM users WHERE active = TRUE AND ${isEmail ? "email = LOWER($1)" : "phone = $1"} LIMIT 1 FOR UPDATE`,
      [value],
    );
    const user = userResult.rows[0] as { id: string } | undefined;
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El código no es válido o venció." });
    }
    const resetResult = await client.query(
      "SELECT code_hash, expires_at, attempts FROM password_reset_codes WHERE user_id = $1 FOR UPDATE",
      [user.id],
    );
    const reset = resetResult.rows[0] as { code_hash: Buffer; expires_at: Date; attempts: number } | undefined;
    if (!reset || reset.attempts >= 5 || new Date(reset.expires_at).getTime() <= Date.now()) {
      await client.query("DELETE FROM password_reset_codes WHERE user_id = $1", [user.id]);
      await client.query("COMMIT");
      return res.status(400).json({ error: "El código no es válido o venció." });
    }
    const expected = resetCodeHash(user.id, input.code);
    const received = Buffer.isBuffer(reset.code_hash) ? reset.code_hash : Buffer.from(String(reset.code_hash), "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      await client.query("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE user_id = $1", [user.id]);
      await client.query("COMMIT");
      return res.status(400).json({ error: "El código no es válido o venció." });
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await client.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, user.id]);
    await client.query("DELETE FROM password_reset_codes WHERE user_id = $1", [user.id]);
    await client.query("COMMIT");
    return res.json({ message: "Contraseña actualizada." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/auth/google", asyncHandler(async (req, res) => {
  const input = z.object({ credential: z.string().min(1).max(8192) }).parse(req.body);
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: "El acceso con Google aún no está configurado." });

  let googleUser;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: input.credential, audience: clientId });
    googleUser = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "La credencial de Google es inválida o venció." });
  }
  if (!googleUser?.sub || !googleUser.email || googleUser.email_verified !== true) {
    return res.status(401).json({ error: "Google no proporcionó un correo verificado." });
  }

  const email = googleUser.email.toLowerCase();
  const name = (googleUser.name || email.split("@")[0]).trim().slice(0, 120);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
    const linkedResult = await client.query(
      "SELECT id, name, email, phone, role, active, google_sub FROM users WHERE google_sub = $1 FOR UPDATE",
      [googleUser.sub],
    );
    const emailResult = await client.query(
      "SELECT id, name, email, phone, role, active, google_sub FROM users WHERE email = $1 FOR UPDATE",
      [email],
    );
    let user = linkedResult.rows[0] as {
      id: string; name: string; email: string; phone: string | null;
      role: string; active: boolean; google_sub: string | null;
    } | undefined;
    const emailUser = emailResult.rows[0] as typeof user;

    if (user && emailUser && user.id !== emailUser.id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Ese correo y esa cuenta de Google pertenecen a perfiles distintos." });
    }
    if (!user && emailUser) {
      user = emailUser;
      if (user.role !== "customer") {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Google está disponible para cuentas de cliente. Usa el acceso habitual de tu perfil." });
      }
      if (user.google_sub && user.google_sub !== googleUser.sub) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Esta cuenta ya está vinculada a otro perfil de Google." });
      }
      if (!user.google_sub) {
        await client.query("UPDATE users SET google_sub = $1, updated_at = NOW() WHERE id = $2", [googleUser.sub, user.id]);
        user.google_sub = googleUser.sub;
      }
    }

    if (user && !user.active) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Esta cuenta está desactivada." });
    }
    if (user && user.role !== "customer") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Google está disponible para cuentas de cliente. Usa el acceso habitual de tu perfil." });
    }
    if (!user) {
      const created = await client.query(
        `INSERT INTO users(name, email, password_hash, google_sub, role)
         VALUES ($1, $2, NULL, $3, 'customer')
         RETURNING id, name, email, phone, role, active, google_sub`,
        [name, email, googleUser.sub],
      );
      user = created.rows[0] as typeof user;
    }

    if (!user) throw new Error("No se pudo crear o recuperar el perfil de Google.");
    await client.query("COMMIT");
    const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
    return res.json({ user: safeUser, token: tokenFor(safeUser) });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "Esta cuenta de Google ya está vinculada a otro perfil." });
    }
    throw error;
  } finally {
    client.release();
  }
}));

router.get("/auth/me", authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email, phone, role FROM users WHERE id = $1",
    [actor(req as AuthRequest).id],
  );
  return res.json({ user: rows[0] });
}));

router.patch("/auth/me", authenticate, asyncHandler(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().regex(/^\+58\d{10}$/).nullable(),
  }).parse(req.body);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = $1, email = LOWER($2), phone = $3, updated_at = NOW()
       WHERE id = $4 RETURNING id, name, email, phone, role`,
      [input.name, input.email, input.phone, actor(req as AuthRequest).id],
    );
    return res.json({ user: rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "El correo o teléfono ya está registrado" });
    }
    throw error;
  }
}));

router.get("/categories", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name, icon_url FROM categories WHERE active = TRUE ORDER BY name");
  return res.json(rows);
}));

router.get("/exchange-rate", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT value #>> '{}' FROM app_settings WHERE key = 'exchange_rate') AS rate,
       (SELECT value #>> '{}' FROM app_settings WHERE key = 'exchange_rate_source') AS source,
       (SELECT value #>> '{}' FROM app_settings WHERE key = 'exchange_rate_value_date') AS "valueDate",
       (SELECT updated_at FROM app_settings WHERE key = 'exchange_rate') AS "updatedAt"`,
  );
  const rate = Number(rows[0]?.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rows[0]?.source !== "BCV" || !rows[0]?.valueDate) {
    return res.status(503).json({ error: "La tasa BCV aún no está disponible. Intenta de nuevo en unos segundos." });
  }
  return res.json({ ...rows[0], rate });
}));

router.get("/promotions", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'promotions'");
  return res.json({ promotions: rows[0]?.value ?? null });
}));

router.get("/location/reverse", asyncHandler(async (req, res) => {
  const { latitude, longitude } = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }).parse(req.query);
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached) return res.json(cached);

  const previousRequest = reverseGeocodeQueue;
  let releaseRequest: () => void = () => undefined;
  reverseGeocodeQueue = new Promise((resolve) => { releaseRequest = resolve; });
  await previousRequest;
  try {
    const queuedCache = reverseGeocodeCache.get(cacheKey);
    if (queuedCache) return res.json(queuedCache);
    const wait = Math.max(0, 1100 - (Date.now() - lastReverseGeocodeAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastReverseGeocodeAt = Date.now();
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept-Language": "es", "User-Agent": "CercaGo/1.0.8 (delivery address picker)" },
      });
      if (!response.ok) throw Object.assign(new Error(`OpenStreetMap respondió HTTP ${response.status}`), { status: 503 });
      const result = await response.json() as { address?: Record<string, unknown> };
      const address = result.address;
      const street = [address?.road, address?.pedestrian, address?.footway, address?.residential]
        .find((value) => typeof value === "string" && value.trim()) as string | undefined;
      const city = [address?.city, address?.town, address?.village, address?.municipality]
        .find((value) => typeof value === "string" && value.trim()) as string | undefined;
      const resolved = {
        street: [street?.trim(), typeof address?.house_number === "string" ? address.house_number : undefined].filter(Boolean).join(" "),
        city: city?.trim() ?? "",
      };
      reverseGeocodeCache.set(cacheKey, resolved);
      if (reverseGeocodeCache.size > 500) {
        const oldestCacheKey = reverseGeocodeCache.keys().next().value;
        if (oldestCacheKey !== undefined) reverseGeocodeCache.delete(oldestCacheKey);
      }
      return res.json(resolved);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    releaseRequest();
  }
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
            s.rating, s.delivery_fee, s.free_delivery, s.has_own_delivery,
            s.estimated_delivery_minutes, s.created_at,
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
    `SELECT p.id, p.store_id, p.name, p.description, p.price, p.image_url, p.in_stock, p.stock_quantity
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
    stockQuantity: z.number().int().min(0).default(1),
    inStock: z.boolean().optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO products(store_id, name, description, price, image_url, stock_quantity, in_stock)
     VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [storeId, input.name, input.description ?? null, input.price, input.imageUrl ?? null,
      input.stockQuantity, input.inStock ?? input.stockQuantity > 0],
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
    stockQuantity: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(req.body);
  const storeId = await getStoreIdForOwner(user.id);
  const columnNames: Record<string, string> = {
    name: "name",
    description: "description",
    price: "price",
    imageUrl: "image_url",
    inStock: "in_stock",
    stockQuantity: "stock_quantity",
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
    hasOwnDelivery: z.boolean().optional(),
    freeDelivery: z.boolean().optional(),
    paymentBank: z.string().trim().max(100).nullable().optional(),
    paymentDocument: z.string().trim().max(32).nullable().optional(),
    paymentPhone: z.string().trim().max(32).nullable().optional(),
  }).parse(req.body);
  const columns = {
    name: "name", description: "description", address: "address", imageUrl: "image_url",
    latitude: "latitude", longitude: "longitude", hasOwnDelivery: "has_own_delivery",
    freeDelivery: "free_delivery", paymentBank: "payment_bank",
    paymentDocument: "payment_document", paymentPhone: "payment_phone",
  } as const;
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
    isDefault: z.boolean().optional(),
  }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentDefault = await client.query("SELECT 1 FROM addresses WHERE user_id = $1 AND is_default = TRUE", [user.id]);
    const isDefault = input.isDefault ?? !currentDefault.rowCount;
    if (isDefault) await client.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [user.id]);
    const { rows } = await client.query(
      `INSERT INTO addresses(user_id, label, address_line, latitude, longitude, instructions, is_default)
       VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, input.label, input.addressLine, input.latitude ?? null, input.longitude ?? null, input.instructions ?? null, isDefault],
    );
    await client.query("COMMIT");
    return res.status(201).json(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}));

router.get("/addresses", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, label, address_line, latitude, longitude, instructions, is_default FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [actor(req as AuthRequest).id],
  );
  return res.json(rows);
}));

router.patch("/addresses/:addressId", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    label: z.string().trim().min(1).max(60).optional(),
    addressLine: z.string().trim().min(5).optional(),
    instructions: z.string().max(1000).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    isDefault: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (input.isDefault) await client.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [user.id]);
    const columns = {
      label: "label", addressLine: "address_line", instructions: "instructions",
      latitude: "latitude", longitude: "longitude", isDefault: "is_default",
    } as const;
    const fields = Object.entries(input).filter(([, value]) => value !== undefined);
    const setters = fields.map(([key], index) => `${columns[key as keyof typeof columns]} = $${index + 1}`);
    const { rows } = await client.query(
      `UPDATE addresses SET ${setters.join(", ")} WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2} RETURNING *`,
      [...fields.map(([, value]) => value), req.params.addressId, user.id],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Dirección no encontrada" });
    }
    await client.query("COMMIT");
    return res.json(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}));

router.delete("/addresses/:addressId", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default",
      [req.params.addressId, user.id],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Dirección no encontrada" });
    }
    if (rows[0].is_default) {
      await client.query(
        `UPDATE addresses SET is_default = TRUE WHERE id = (
           SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
         )`,
        [user.id],
      );
    }
    await client.query("COMMIT");
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
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
    const store = await client.query(
      "SELECT id, delivery_fee, free_delivery, has_own_delivery FROM stores WHERE id = $1 AND active = TRUE AND approved = TRUE FOR SHARE",
      [input.storeId],
    );
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
      `SELECT id, name, price::text AS price, stock_quantity FROM products
       WHERE store_id = $1 AND active = TRUE AND in_stock = TRUE AND id = ANY($2::uuid[]) FOR UPDATE`,
      [input.storeId, productIds],
    );
    if (products.rowCount !== new Set(productIds).size) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Uno o más productos no están disponibles en este comercio" });
    }
    const byId = new Map(products.rows.map((product) => [product.id, product]));
    const items = input.items.map((item) => ({ ...item, product: byId.get(item.productId)! }));
    if (items.some((item) => Number(item.product.stock_quantity) < item.quantity)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La cantidad solicitada supera el stock disponible" });
    }
    const subtotalCents = items.reduce((sum, item) => sum + Math.round(Number(item.product.price) * 100) * item.quantity, 0);
    const deliveryFeeCents = store.rows[0].free_delivery ? 0 : Math.round(Number(store.rows[0].delivery_fee) * 100);
    const rateResult = await client.query(
      `SELECT r.value #>> '{}' AS rate
       FROM app_settings r
       JOIN app_settings source ON source.key = 'exchange_rate_source' AND source.value #>> '{}' = 'BCV'
       JOIN app_settings value_date ON value_date.key = 'exchange_rate_value_date'
       WHERE r.key = 'exchange_rate'`,
    );
    const exchangeRate = Number(rateResult.rows[0]?.rate);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      await client.query("ROLLBACK");
      return res.status(503).json({ error: "La tasa oficial del BCV todavía no está disponible. Intenta más tarde." });
    }
    const created = await client.query(
      `INSERT INTO orders(customer_id, store_id, address_id, delivery_address, delivery_latitude,
                          delivery_longitude, subtotal, delivery_fee, total, exchange_rate, notes)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [user.id, input.storeId, input.addressId ?? null, deliveryAddress, deliveryLatitude, deliveryLongitude,
        (subtotalCents / 100).toFixed(2), (deliveryFeeCents / 100).toFixed(2),
        ((subtotalCents + deliveryFeeCents) / 100).toFixed(2), exchangeRate, input.notes ?? null],
    );
    order = created.rows[0];
    for (const item of items) {
      const unitCents = Math.round(Number(item.product.price) * 100);
      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1, in_stock = (stock_quantity - $1) > 0, updated_at = NOW() WHERE id = $2",
        [item.quantity, item.productId],
      );
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
  const paymentFields = ["customer", "store"].includes(user.role)
    ? "s.payment_bank, s.payment_document, s.payment_phone,"
    : "NULL::varchar AS payment_bank, NULL::varchar AS payment_document, NULL::varchar AS payment_phone,";
  const { rows } = await pool.query(
    `SELECT o.*, s.name AS store_name, s.address AS store_address, s.latitude AS store_latitude,
            s.longitude AS store_longitude, s.has_own_delivery, s.free_delivery,
            ${paymentFields}
            d.id AS delivery_id, d.driver_id, d.status AS delivery_status,
            (r.id IS NOT NULL) AS has_review,
            COALESCE((SELECT json_agg(json_build_object('id', oi.id, 'productName', oi.product_name,
                    'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total))
                      FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items
     FROM orders o JOIN stores s ON s.id = o.store_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN reviews r ON r.order_id = o.id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT 100`,
    parameters,
  );
  return res.json(rows);
}));

async function canAccessOrder(orderId: string, userId: string) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE o.id = $1 AND (o.customer_id = $2 OR s.owner_id = $2)`,
    [orderId, userId],
  );
  return Boolean(rowCount);
}

router.get("/orders/:orderId/messages", authenticate, asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  if (!await canAccessOrder(req.params.orderId, user.id)) return res.status(404).json({ error: "Pedido no encontrado" });
  const { rows } = await pool.query(
    `SELECT m.id, m.order_id, m.sender_id, m.message, m.attachment_url, m.payment_reference,
            m.created_at, u.name AS sender_name, u.role AS sender_role
     FROM order_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.order_id = $1 ORDER BY m.created_at ASC LIMIT 200`,
    [req.params.orderId],
  );
  return res.json(rows);
}));

router.post("/orders/:orderId/messages", authenticate, asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    message: z.string().trim().max(2000).optional(),
    attachmentUrl: z.string().max(760_000).refine(
      (value) => /^https?:\/\//i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
      "Adjunta una foto JPEG, PNG o WebP válida, o un enlace HTTP/HTTPS",
    ).optional(),
    paymentReference: z.string().trim().max(120).optional(),
  }).refine((value) => Boolean(value.message || value.attachmentUrl || value.paymentReference)).parse(req.body);
  if (!await canAccessOrder(req.params.orderId, user.id)) return res.status(404).json({ error: "Pedido no encontrado" });
  if (user.role === "customer" && (input.paymentReference || input.attachmentUrl)) {
    const status = await pool.query("SELECT status FROM orders WHERE id = $1 AND customer_id = $2", [req.params.orderId, user.id]);
    if (!["accepted", "preparing", "ready", "picked_up", "delivered"].includes(status.rows[0]?.status)) {
      return res.status(409).json({ error: "Espera la confirmación del comercio antes de transferir y enviar el comprobante" });
    }
  }
  if (user.role === "store" && ["Pago recibido", "Pago recibido y verificado"].includes(input.message ?? "")) {
    const proof = await pool.query(
      `SELECT 1 FROM order_messages
       WHERE order_id = $1 AND sender_id = (SELECT customer_id FROM orders WHERE id = $1)
         AND (payment_reference IS NOT NULL OR attachment_url IS NOT NULL)
       LIMIT 1`,
      [req.params.orderId],
    );
    if (!proof.rowCount) return res.status(409).json({ error: "El cliente debe enviar el comprobante o la referencia antes de verificar el pago" });
  }
  const { rows } = await pool.query(
    `INSERT INTO order_messages(order_id, sender_id, message, attachment_url, payment_reference)
     VALUES($1, $2, $3, $4, $5)
     RETURNING id, order_id, sender_id, message, attachment_url, payment_reference, created_at`,
    [req.params.orderId, user.id, input.message ?? "", input.attachmentUrl ?? null, input.paymentReference ?? null],
  );
  const message = { ...rows[0], sender_name: user.name, sender_role: user.role };
  const participants = await pool.query(
    `SELECT o.customer_id, s.owner_id
     FROM orders o JOIN stores s ON s.id = o.store_id
     WHERE o.id = $1`,
    [req.params.orderId],
  );
  const io = req.app.get("io");
  if (participants.rows[0]) {
    io?.to(`user:${participants.rows[0].customer_id}`)
      .to(`user:${participants.rows[0].owner_id}`)
      .emit("order:message", message);
  }
  return res.status(201).json(message);
}));

router.post("/orders/:orderId/review", authenticate, allowRoles("customer"), asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const input = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).default(""),
    driverRating: z.number().int().min(1).max(5).optional(),
    driverComment: z.string().trim().max(2000).default(""),
  }).parse(req.body);
  if (input.driverComment && !input.driverRating) {
    return res.status(400).json({ error: "Califica al repartidor para enviar un comentario sobre su servicio" });
  }
  const order = await pool.query(
    `SELECT o.store_id, o.status, d.driver_id
     FROM orders o LEFT JOIN deliveries d ON d.order_id = o.id
     WHERE o.id = $1 AND o.customer_id = $2`,
    [req.params.orderId, user.id],
  );
  if (!order.rows[0]) return res.status(404).json({ error: "Pedido no encontrado" });
  if (order.rows[0].status !== "delivered") return res.status(409).json({ error: "Solo puedes reseñar pedidos entregados" });
  if (input.driverRating && !order.rows[0].driver_id) {
    return res.status(400).json({ error: "Este pedido no tiene un repartidor asignado" });
  }
  const { rows } = await pool.query(
    `INSERT INTO reviews(order_id, store_id, user_id, driver_id, rating, comment, driver_rating, driver_comment)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(order_id) DO NOTHING RETURNING *`,
    [req.params.orderId, order.rows[0].store_id, user.id, order.rows[0].driver_id, input.rating, input.comment,
      input.driverRating ?? null, input.driverComment],
  );
  if (!rows[0]) return res.status(409).json({ error: "Este pedido ya fue reseñado" });
  await pool.query(
    "UPDATE stores SET rating = (SELECT AVG(rating)::numeric(2,1) FROM reviews WHERE store_id = $1) WHERE id = $1",
    [order.rows[0].store_id],
  );
  return res.status(201).json(rows[0]);
}));

router.patch("/orders/:orderId/status", authenticate, asyncHandler(async (req, res) => {
  const user = actor(req as AuthRequest);
  const { status } = z.object({ status: z.enum(["accepted", "preparing", "ready", "picked_up", "delivered", "cancelled"]) }).parse(req.body);
  if (!["store", "admin"].includes(user.role)) return res.status(403).json({ error: "Permisos insuficientes" });
  const storeId = user.role === "store" ? await getStoreIdForOwner(user.id) : null;
  const client = await pool.connect();
  let updated;
  let isOwnDelivery = false;
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT o.*, d.id AS delivery_id, s.latitude AS store_latitude, s.longitude AS store_longitude,
              s.has_own_delivery
       FROM orders o JOIN deliveries d ON d.order_id = o.id JOIN stores s ON s.id = o.store_id
       WHERE o.id = $1 AND ($2::uuid IS NULL OR o.store_id = $2) FOR UPDATE OF o, d`,
      [req.params.orderId, storeId],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    isOwnDelivery = Boolean(current.rows[0].has_own_delivery);
    const allowed: Record<string, string[]> = {
      placed: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: current.rows[0].has_own_delivery ? ["picked_up", "cancelled"] : [],
      picked_up: current.rows[0].has_own_delivery ? ["delivered"] : [],
    };
    if (!allowed[current.rows[0].status]?.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `No se puede cambiar de ${current.rows[0].status} a ${status}` });
    }
    if (status === "preparing") {
      const proof = await client.query(
        `SELECT 1 FROM order_messages
         WHERE order_id = $1 AND sender_id = (SELECT customer_id FROM orders WHERE id = $1)
           AND (payment_reference IS NOT NULL OR attachment_url IS NOT NULL)
         LIMIT 1`,
        [req.params.orderId],
      );
      if (!proof.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "El cliente debe enviar la captura del comprobante o el número de referencia antes de preparar el pedido" });
      }
    }
    if (status === "ready" && !current.rows[0].has_own_delivery &&
      (current.rows[0].store_latitude == null || current.rows[0].store_longitude == null)) {
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
    if (status === "picked_up" || status === "delivered") {
      await client.query(
        `UPDATE deliveries SET status = $1,
         picked_up_at = CASE WHEN $1 = 'picked_up' THEN NOW() ELSE picked_up_at END,
         delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
         WHERE order_id = $2`,
        [status, req.params.orderId],
      );
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
  if (status === "ready" && !isOwnDelivery) {
    const drivers = await pool.query(
      `SELECT dl.user_id FROM driver_locations dl
       JOIN stores s ON s.id = $1
       WHERE s.has_own_delivery = FALSE AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
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
            o.total, o.exchange_rate, o.created_at, s.name AS store_name, s.address AS store_address, s.latitude AS store_latitude,
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
       AND s.has_own_delivery = FALSE
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

router.get("/admin/promotions", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'promotions'");
  return res.json({ promotions: rows[0]?.value ?? null });
}));

router.put("/admin/promotions", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const promotions = promotionSchema.parse(req.body.promotions);
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES('promotions', $1::jsonb, NOW())
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(promotions)],
  );
  return res.json({ promotions });
}));

router.get("/admin/stores", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, s.name LIKE 'DEMO · %' AS is_demo, u.name AS owner_name, u.email AS owner_email, c.name AS category_name
     FROM stores s JOIN users u ON u.id = s.owner_id LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY s.created_at DESC LIMIT 500`,
  );
  return res.json(rows);
}));

router.post("/admin/demo-stores", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const demoStores = [
    {
      slug: "mercado-esquina",
      name: "DEMO · Mercado La Esquina",
      owner: "Comercio de prueba CercaGo",
      category: "Bodegas",
      description: "Comercio de demostración con productos básicos para el hogar.",
      address: "Av. Las Delicias, Maracay, Aragua",
      latitude: 10.245,
      longitude: -67.595,
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=85",
      deliveryFee: 1.5,
      estimatedDeliveryMinutes: 25,
      products: [
        ["Harina de maíz precocida", "Paquete de 1 kg", 1.5],
        ["Arroz", "Paquete de 1 kg", 1.3],
        ["Leche entera", "Envase de 1 litro", 1.6],
        ["Huevos", "Cartón de 12 unidades", 3.2],
        ["Aceite vegetal", "Botella de 1 litro", 2.8],
      ],
    },
    {
      slug: "panaderia-aurora",
      name: "DEMO · Panadería Aurora",
      owner: "Comercio de prueba CercaGo",
      category: "Cafeterías",
      description: "Panadería de demostración con pan recién horneado y café.",
      address: "Calle Sucre, Maracay, Aragua",
      latitude: 10.2462,
      longitude: -67.5941,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=85",
      deliveryFee: 1.25,
      estimatedDeliveryMinutes: 20,
      products: [
        ["Pan campesino", "Pieza recién horneada", 2.5],
        ["Cachitos de jamón", "Paquete de 2 unidades", 2],
        ["Golfeados", "Paquete de 2 unidades", 3],
        ["Empanada de queso", "Preparada al momento", 1.5],
        ["Café con leche", "Taza de 12 oz", 1.75],
      ],
    },
    {
      slug: "frutas-valle",
      name: "DEMO · Frutas El Valle",
      owner: "Comercio de prueba CercaGo",
      category: "Supermercados",
      description: "Frutería de demostración con frutas y verduras frescas.",
      address: "Av. Bolívar, Maracay, Aragua",
      latitude: 10.2415,
      longitude: -67.589,
      imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1000&q=85",
      deliveryFee: 0,
      estimatedDeliveryMinutes: 30,
      products: [
        ["Cambur", "Por kilogramo", 1.2],
        ["Tomate", "Por kilogramo", 1.8],
        ["Aguacate", "Por unidad", 2.5],
        ["Naranja", "Por kilogramo", 1.5],
        ["Cebolla", "Por kilogramo", 1.3],
      ],
    },
  ] as const;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cercago-demo-store-seed'))");
    const categories = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM categories WHERE active = TRUE",
    );
    const categoryIds = new Map(categories.rows.map((category) => [category.name, category.id]));
    let createdStores = 0;
    let createdProducts = 0;
    let existingStores = 0;

    for (const demoStore of demoStores) {
      const existing = await client.query(
        "SELECT id FROM stores WHERE name = $1",
        [demoStore.name],
      );
      if (existing.rows[0]) {
        existingStores += 1;
        continue;
      }

      const categoryId = categoryIds.get(demoStore.category);
      if (!categoryId) throw new Error(`No existe la categoría requerida: ${demoStore.category}`);

      const ownerEmail = `demo-${demoStore.slug}-${randomBytes(4).toString("hex")}@example.invalid`;
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
      const owner = await client.query<{ id: string }>(
        `INSERT INTO users(name, email, password_hash, role)
         VALUES($1, $2, $3, 'store') RETURNING id`,
        [`${demoStore.owner} ${demoStore.slug}`, ownerEmail, passwordHash],
      );
      const store = await client.query<{ id: string }>(
        `INSERT INTO stores(owner_id, category_id, name, description, address, latitude, longitude,
           image_url, delivery_fee, estimated_delivery_minutes, commission_rate, approved, active)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           COALESCE((SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'default_commission_rate'), 10),
           TRUE, TRUE)
         RETURNING id`,
        [owner.rows[0].id, categoryId, demoStore.name, demoStore.description, demoStore.address,
          demoStore.latitude, demoStore.longitude, demoStore.imageUrl, demoStore.deliveryFee,
          demoStore.estimatedDeliveryMinutes],
      );

      for (const [name, description, price] of demoStore.products) {
        await client.query(
          `INSERT INTO products(store_id, name, description, price, image_url, stock_quantity, in_stock)
           VALUES($1, $2, $3, $4, $5, 25, TRUE)`,
          [store.rows[0].id, name, description, price, demoStore.imageUrl],
        );
        createdProducts += 1;
      }
      createdStores += 1;
    }

    await client.query("COMMIT");
    return res.status(createdStores ? 201 : 200).json({ createdStores, createdProducts, existingStores });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

router.delete("/admin/stores/:storeId", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const store = await client.query<{ id: string; owner_id: string }>(
      "SELECT id, owner_id FROM stores WHERE id = $1 FOR UPDATE",
      [req.params.storeId],
    );
    if (!store.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Comercio no encontrado" });
    }
    const history = await client.query<{ has_history: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM orders WHERE store_id = $1)
           OR EXISTS(SELECT 1 FROM reviews WHERE store_id = $1) AS has_history`,
      [req.params.storeId],
    );
    if (history.rows[0].has_history) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "No se puede eliminar un comercio con pedidos o reseñas. Paúsalo para conservar su historial." });
    }
    await client.query("DELETE FROM stores WHERE id = $1", [req.params.storeId]);
    await client.query(
      "UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = $1 AND role = 'store'",
      [store.rows[0].owner_id],
    );
    await client.query("COMMIT");
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

router.post("/admin/settings/exchange-rate/refresh", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const currentRate = await refreshExchangeRate((rate) => req.app.get("io")?.emit("exchange-rate:updated", rate));
  return res.json(currentRate);
}));

export default router;
