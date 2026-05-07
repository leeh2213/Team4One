import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

describe("audit log", () => {
  it("appends immutable audit entries", async () => {
    const { prisma, audit, cleanup } = await createTestApp();

    try {
      await prisma.projectSpace.create({
        data: { id: "space-1", name: "Apollo" },
      });

      const entry = await audit.append({
        spaceId: "space-1",
        actorType: "MEMBER",
        actorId: "member-1",
        action: "space.created",
        entityType: "ProjectSpace",
        entityId: "space-1",
        payload: { name: "Apollo" },
      });

      expect(entry.id).toBeTruthy();
      expect(await prisma.auditLog.count()).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
