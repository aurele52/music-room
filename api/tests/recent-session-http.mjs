import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test("Sessions recentes - routes HTTP", async (t) => {
  // Ce test ne peut jamais créer d'utilisateur dans la base principale.
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || new URL(databaseUrl).pathname !== "/musicroom_test") {
    t.skip("Base musicroom_test obligatoire");
    return;
  }

  // Charge JWT_SECRET sans remplacer DATABASE_URL déjà exporté.
  process.loadEnvFile(".env");

  const secret = process.env.JWT_SECRET;

  assert.ok(secret, "JWT_SECRET manquant");

  const prisma = new PrismaClient();

  const user = await prisma.user.create({
    data: {
      email: `session-${randomUUID()}@example.test`,
      name: "Session Test",
      emailVerifiedAt: new Date(),
    },
  });

  const now = Math.floor(Date.now() / 1000);

  function makeToken(ageSeconds, version = 0) {
    return jwt.sign(
      {
        sub: user.id,
        ver: version,
        iat: now - ageSeconds,
      },
      secret,
      {
        expiresIn: "1h",
        issuer: "music-room",
        audience: "music-room-api",
      },
    );
  }

  async function request(path, method, token, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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

  const recent = makeToken(60);
  const old = makeToken(15 * 60);

  try {
    await t.test("Session ancienne : profil toujours accessible", async () => {
      const result = await request("/api/auth/me", "GET", old);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.id, user.id);
    });

    await t.test("Session ancienne : liaison Google refusée", async () => {
      const result = await request("/api/auth/google/link", "POST", old, {
        credential: "invalid",
      });

      assert.equal(result.status, 403);
      assert.equal(result.body.code, "REAUTH_REQUIRED");
    });

    await t.test("Session ancienne : dissociation Google refusée", async () => {
      const result = await request("/api/auth/google/link", "DELETE", old, {
        password: "invalid",
      });

      assert.equal(result.status, 403);
      assert.equal(result.body.code, "REAUTH_REQUIRED");
    });

    await t.test("Session récente : passage au contrôle Google", async () => {
      const result = await request("/api/auth/google/link", "POST", recent, {
        credential: "invalid",
      });

      // 400 : le JWT Music Room est accepté,
      // mais le jeton Google est invalide.
      assert.equal(result.status, 400);
    });

    await t.test("Changement de version : ancien JWT révoqué", async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      const result = await request("/api/auth/me", "GET", recent);

      assert.equal(result.status, 401);
    });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
