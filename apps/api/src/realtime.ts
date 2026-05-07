import type { RealtimeEvent } from "@team4one/shared";
import type { FastifyInstance } from "fastify";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { hashToken } from "./auth.js";
import { config } from "./config.js";

type JoinAck = (result: { ok: boolean; message?: string }) => void;

function readToken(socket: Socket) {
  const authToken = socket.handshake.auth.token;
  const header = socket.handshake.headers.authorization;
  const rawToken = typeof authToken === "string" ? authToken : header;

  return rawToken?.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;
}

export function createRealtimeServer(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: { origin: true },
  });

  io.on("connection", (socket) => {
    socket.on("space:join", async (spaceId: string, ack?: JoinAck) => {
      const token = readToken(socket);
      if (!token) {
        ack?.({ ok: false, message: "Unauthorized" });
        return;
      }

      if (token === config.DEV_BRAIN_TOKEN) {
        await socket.join(`space:${spaceId}`);
        ack?.({ ok: true });
        return;
      }

      const agent = await app.prisma.agentIdentity.findFirst({
        where: { tokenHash: hashToken(token), active: true },
        include: { membership: true },
      });
      if (!agent || agent.membership.spaceId !== spaceId) {
        const space = await app.prisma.projectSpace.findFirst({
          where: { id: spaceId, viewerTokenHash: hashToken(token) },
        });
        if (!space) {
          ack?.({ ok: false, message: "Forbidden" });
          return;
        }
      }

      await socket.join(`space:${spaceId}`);
      ack?.({ ok: true });
    });
  });

  app.addHook("onClose", (_instance, done) => {
    io.close(() => done());
  });

  return {
    io,
    publish(event: RealtimeEvent) {
      io.to(`space:${event.spaceId}`).emit(event.type, event);
    },
  };
}
