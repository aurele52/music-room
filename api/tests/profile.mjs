import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test("Profil utilisateur - API", async (t) => {
  const url = process.env.DATABASE_URL;

  if (!url || new URL(url).pathname !== "/musicroom_test") {
    throw new Error("Les tests de profil exigent musicroom_test");
  }

  process.loadEnvFile(".env");

  const secret = process.env.JWT_SECRET;
  assert.ok(secret, "JWT_SECRET manquant");

  const prisma = new PrismaClient();

  let user;

  async function request(path, method, token, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
          }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  try {
    user = await prisma.user.create({
      data: {
        email: `profile-${randomUUID()}@example.test`,
        name: "Nom initial",
        emailVerifiedAt: new Date(),
      },
    });

    const token = jwt.sign({ sub: user.id, ver: user.tokenVersion }, secret, {
      expiresIn: "1h",
      issuer: "music-room",
      audience: "music-room-api",
    });

    await t.test("Modification sans JWT refusée", async () => {
      const result = await request("/api/profile/me", "PATCH", null, {
        name: "Intrus",
      });

      assert.equal(result.status, 401);
    });

    await t.test("Nom trop court refusé", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {
        name: "A",
      });

      assert.equal(result.status, 400);
    });

    await t.test("Nom trop long refusé", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {
        name: "A".repeat(51),
      });

      assert.equal(result.status, 400);
    });

    await t.test("Nom absent refusé", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {});

      assert.equal(result.status, 400);
    });

    await t.test("Caractère de contrôle refusé", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {
        name: "Alice\nBob",
      });

      assert.equal(result.status, 400);
    });

    await t.test("Modification du nom acceptée", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {
        name: "  Alice Music  ",
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.user.name, "Alice Music");
      assert.equal(result.body.user.id, user.id);
      assert.equal(result.body.user.passwordHash, undefined);
    });

    await t.test("Modification persistée en base", async () => {
      const result = await request("/api/auth/me", "GET", token);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.name, "Alice Music");
    });

    await t.test("Modification sensible ignorée", async () => {
      const result = await request("/api/profile/me", "PATCH", token, {
        name: "Alice Deux",
        tokenVersion: 100,
      });

      assert.equal(result.status, 200);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });

      assert.equal(stored.name, "Alice Deux");
      assert.equal(stored.tokenVersion, 0);
    });
  } finally {
    if (user) {
      await prisma.user.delete({
        where: { id: user.id },
      });
    }

    await prisma.$disconnect();
  }
});
