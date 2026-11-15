import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@monarch/shared";
import { SERVER_URL } from "./config";

export type MonarchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: MonarchSocket | null = null;

export function getSocket(): MonarchSocket {
  if (!socket) socket = io(SERVER_URL, { transports: ["websocket"] });
  return socket;
}
