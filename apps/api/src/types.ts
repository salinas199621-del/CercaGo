import type { Request } from "express";

export type Role = "admin" | "store" | "driver" | "customer";
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}
export interface AuthRequest extends Request {
  user?: AuthUser;
}
