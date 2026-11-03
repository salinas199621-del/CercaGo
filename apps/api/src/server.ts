import "dotenv/config";
import http from "node:http";
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

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio");
jwtSecret();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim());
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ["GET", "POST", "PATCH", "DELETE"] } });

app.set("io", io);
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
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
  if (user.role === "driver") socket.join(`driver:${user.id}`);
  if (user.role === "store") {
    const store = await pool.query("SELECT id FROM stores WHERE owner_id = $1", [user.id]);
    if (store.rows[0]) socket.join(`store:${store.rows[0].id}`);
  }
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`CercaGo API escuchando en el puerto ${port}`));

async function shutdown() {
  server.close();
  io.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
