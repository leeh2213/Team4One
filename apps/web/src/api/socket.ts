import { io } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100";
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "viewer-local-token";

export function connectSpaceSocket(spaceId: string) {
  const socket = io(API_BASE_URL, { auth: { token: API_TOKEN } });
  socket.emit("space:join", spaceId);
  return socket;
}
