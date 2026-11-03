import type { Socket } from "socket.io-client";

export let socket: Socket | null = null;
export function setSocket(value: Socket | null) { socket = value; }
