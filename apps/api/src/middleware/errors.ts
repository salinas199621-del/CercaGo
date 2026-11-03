import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  return res.status(404).json({ error: "Recurso no encontrado" });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(error);
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: error.issues });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
}
