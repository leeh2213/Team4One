import { Prisma } from "@prisma/client";
import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Invalid request",
        issues: error.issues,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return reply.code(404).send({ message: "Resource not found" });
      }

      if (error.code === "P2002") {
        return reply.code(409).send({ message: "Resource already exists" });
      }
    }

    const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ message: error.message });
    }

    requestLog(error);
    return reply.code(500).send({ message: "Internal server error" });
  });
}

function requestLog(error: Error) {
  // Keep internal details out of responses while preserving server logs.
  console.error(error);
}
