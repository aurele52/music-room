import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test("Préférences musicales - API", async (t) => {
  const url = process.env.DATABASE_URL;

  if (!url || new URL(url).pathname !== "/musicroom_test") {
    throw new Error("musicroom_test obligatoire");
  }

  process.loadEnvFile(".env");

  const secret = process.env.JWT_SECRET;
  assert.ok(secret);

  const prisma = new PrismaClient();
  const ids = [];
  const suffix = randomUUID();

  async function request(method, token, body) {
    const response = await fetch(`${base}/api/profile/me/music`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  function makeToken(user) {
    return jwt.sign({ sub: user.id, ver: user.tokenVersion }, secret, {
      expiresIn: "1h",
      issuer: "music-room",
      audience: "music-room-api",
    });
  }

  try {
    const alice = await prisma.user.create({
      data: {
        email: `music-a-${suffix}@example.test`,
        name: "Alice Music",
        emailVerifiedAt: new Date(),
      },
    });
    ids.push(alice.id);

    const bob = await prisma.user.create({
      data: {
        email: `music-b-${suffix}@example.test`,
        name: "Bob Music",
        emailVerifiedAt: new Date(),
      },
    });
    ids.push(bob.id);

    const aliceToken = makeToken(alice);
    const bobToken = makeToken(bob);

    await t.test("Lecture sans JWT refusée", async () => {
      const result = await request("GET", null);
      assert.equal(result.status, 401);
    });

    await t.test("Modification sans JWT refusée", async () => {
      const result = await request("PUT", null, {
        favoriteGenres: ["Rock"],
        favoriteArtists: ["Muse"],
      });
      assert.equal(result.status, 401);
    });

    await t.test("Listes vides par défaut", async () => {
      const result = await request("GET", aliceToken);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.preferences, {
        favoriteGenres: [],
        favoriteArtists: [],
      });
    });

    await t.test("Sauvegarde des goûts musicaux", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: ["Rock", "Jazz"],
        favoriteArtists: ["Muse", "Daft Punk"],
      });

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.preferences.favoriteGenres, [
        "Rock",
        "Jazz",
      ]);
      assert.deepEqual(result.body.preferences.favoriteArtists, [
        "Muse",
        "Daft Punk",
      ]);
    });

    await t.test("Doublons et espaces nettoyés", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: [" Rock ", "rock", "Jazz"],
        favoriteArtists: ["  Daft  Punk  ", "daft punk"],
      });

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.preferences.favoriteGenres, [
        "Rock",
        "Jazz",
      ]);
      assert.deepEqual(result.body.preferences.favoriteArtists, ["Daft Punk"]);
    });

    await t.test("Préférences persistées", async () => {
      const result = await request("GET", aliceToken);

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.preferences.favoriteGenres, [
        "Rock",
        "Jazz",
      ]);
    });

    await t.test("Autre compte indépendant", async () => {
      const result = await request("GET", bobToken);

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.preferences.favoriteGenres, []);
      assert.deepEqual(result.body.preferences.favoriteArtists, []);
    });

    await t.test("Plus de 15 éléments refusés", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: Array.from(
          { length: 16 },
          (_, index) => `Genre ${index}`,
        ),
        favoriteArtists: [],
      });

      assert.equal(result.status, 400);
    });

    await t.test("Élément non textuel refusé", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: ["Rock", 42],
        favoriteArtists: [],
      });

      assert.equal(result.status, 400);
    });

    await t.test("Élément trop long refusé", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: ["A".repeat(41)],
        favoriteArtists: [],
      });

      assert.equal(result.status, 400);
    });

    await t.test("Requête incomplète refusée sans perte", async () => {
      const result = await request("PUT", aliceToken, {
        favoriteGenres: ["Electro"],
      });

      assert.equal(result.status, 400);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: alice.id },
      });

      assert.deepEqual(stored.favoriteGenres, ["Rock", "Jazz"]);
      assert.deepEqual(stored.favoriteArtists, ["Daft Punk"]);
    });
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    await prisma.$disconnect();
  }
});
