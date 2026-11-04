import "dotenv/config";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "./db";
import router from "./routes";
import { errorHandler, notFound } from "./middleware/errors";
import { jwtSecret } from "./middleware/auth";
import { refreshExchangeRate } from "./exchangeRate";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio");
jwtSecret();

const app = express();
const server = http.createServer(app);
app.set("trust proxy", 1);
const allowedOrigins = [...new Set([
  "https://cercago.onrender.com",
  "https://salinas199621-del.github.io",
  ...(process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim()),
])];
function isLocalDevelopmentOrigin(origin: string) {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isPrivateNetworkHost = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    return url.protocol === "http:" &&
      ["5173", "8081"].includes(url.port) &&
      (isLocalHost || isPrivateNetworkHost);
  } catch {
    return false;
  }
}
function allowClientOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${origin} is not allowed by CORS`));
}
const io = new Server(server, { cors: { origin: allowClientOrigin, methods: ["GET", "POST", "PATCH", "DELETE"] } });

app.set("io", io);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "font-src": ["'self'", "https:", "data:"],
      "frame-src": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "object-src": ["'none'"],
      "script-src": ["'self'", "https://unpkg.com"],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'", "https:", "'unsafe-inline'"],
      "connect-src": ["'self'", "https:", "wss:"],
    },
  },
}));
app.use(cors({ origin: allowClientOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth/password-reset/request", rateLimit({ windowMs: 15 * 60_000, limit: 3, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use("/api/location/reverse", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/health", async (_req, res) => {
  try {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
  } catch (error) {
    console.error("API health check failed", error);
    res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});
app.use("/api", router);
app.get("/download", (_req, res) => {
  res.redirect(302, "https://github.com/salinas199621-del/CercaGo/releases/latest/download/CercaGo.apk");
});
app.use(express.static(resolve(__dirname, "../public")));
app.use(notFound);
app.use(errorHandler);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string") return next(new Error("Autenticación requerida"));
    const payload = jwt.verify(token, jwtSecret());
    if (typeof payload === "string" || !payload.sub || !payload.role) return next(new Error("Token inválido"));
    const user = await pool.query("SELECT id, role, active FROM users WHERE id = $1", [payload.sub]);
    if (!user.rows[0]?.active || user.rows[0].role !== payload.role) return next(new Error("Usuario no disponible"));
    socket.data.user = { id: user.rows[0].id as string, role: user.rows[0].role as string };
    return next();
  } catch (error) {
    return next(error instanceof Error ? error : new Error("Token inválido"));
  }
});

io.on("connection", async (socket) => {
  const user = socket.data.user as { id: string; role: string };
  socket.join(`user:${user.id}`);
  if (["customer", "store", "driver"].includes(user.role)) socket.join(`customer:${user.id}`);
  if (user.role === "driver") socket.join(`driver:${user.id}`);
  if (user.role === "store") {
    const store = await pool.query("SELECT id FROM stores WHERE owner_id = $1", [user.id]);
    if (store.rows[0]) socket.join(`store:${store.rows[0].id}`);
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT o.id FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE o.customer_id = $1 OR s.owner_id = $1`,
    [user.id],
  );
  for (const order of rows) socket.join(`order:${order.id}`);
});

const port = Number(process.env.PORT || 4000);
async function startServer() {
  const driverIdentityMigration = await readFile(
    resolve(__dirname, "../sql/migrations/008_driver_identity.sql"),
    "utf8",
  );
  await pool.query(driverIdentityMigration);
  server.listen(port, () => console.log(`CercaGo API escuchando en el puerto ${port}`));
}
void startServer().catch((error: unknown) => {
  console.error("No se pudo aplicar la migración de identidad de repartidores ni iniciar CercaGo", error);
  process.exit(1);
});
const exchangeRateRefreshTimer = setInterval(() => {
  void refreshExchangeRate((rate) => io.emit("exchange-rate:updated", rate))
    .catch((error) => console.error("No se pudo actualizar la tasa oficial del BCV", error));
}, 60 * 60 * 1000);
exchangeRateRefreshTimer.unref();
void refreshExchangeRate((rate) => io.emit("exchange-rate:updated", rate))
  .catch((error) => console.error("No se pudo cargar la tasa oficial inicial del BCV", error));

async function shutdown() {
  clearInterval(exchangeRateRefreshTimer);
  server.close();
  io.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
