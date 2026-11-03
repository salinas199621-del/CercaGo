import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import type { AuthRequest, Role } from "../types";

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
  return secret;
};

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Autenticación requerida" });
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, jwtSecret());
    if (typeof verified === "string" || !verified.sub) {
      return res.status(401).json({ error: "Token inválido" });
    }
    payload = verified;
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
  try {
    const result = await pool.query("SELECT id, role, name, active FROM users WHERE id = $1", [payload.sub]);
    const user = result.rows[0];
    if (!user || !user.active) return res.status(401).json({ error: "Usuario no disponible" });
    req.user = { id: user.id as string, role: user.role as Role, name: user.name as string };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function allowRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permisos insuficientes" });
    return next();
  };
}

export { jwtSecret };
