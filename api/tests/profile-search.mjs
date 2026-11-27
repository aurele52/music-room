import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test("Recherche de profils - permissions", async (t) => {
  const url = process.env.DATABASE_URL;

  if (!url || new URL(url).pathname !== "/musicroom_test") {
    throw new Error("Base musicroom_test obligatoire");
  }

  process.loadEnvFile(".env");

  const secret = process.env.JWT_SECRET;
  assert.ok(secret);

  const prisma = new PrismaClient();
  const ids = [];
  const suffix = randomUUID().slice(0, 8);

  async function createUser(name, visibility) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        visibility,
        emailVerifiedAt: new Date(),
      },
    });

    ids.push(user.id);
    return user;
  }

  function token(user) {
    return jwt.sign({ sub: user.id, ver: user.tokenVersion }, secret, {
      expiresIn: "1h",
      issuer: "music-room",
      audience: "music-room-api",
    });
  }

  async function request(path, authToken) {
    const response = await fetch(`${base}${path}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  try {
    const alice = await createUser(`Alice ${suffix}`, "PUBLIC");
    const albert = await createUser(`Albert ${suffix}`, "PUBLIC");
    const alicia = await createUser(`Alicia ${suffix}`, "PRIVATE");
    const alain = await createUser(`Alain ${suffix}`, "FRIENDS");

    const viewer = await createUser(`Observateur ${suffix}`, "PRIVATE");

    const authToken = token(viewer);

    await t.test("Recherche sans JWT refusée", async () => {
      const result = await request("/api/profile/search?q=Ali", null);
      assert.equal(result.status, 401);
    });

    await t.test("Recherche trop courte refusée", async () => {
      const result = await request("/api/profile/search?q=A", authToken);
      assert.equal(result.status, 400);
    });

    await t.test("Recherche absente refusée", async () => {
      const result = await request("/api/profile/search", authToken);
      assert.equal(result.status, 400);
    });

    await t.test("Recherche trop longue refusée", async () => {
      const result = await request(
        `/api/profile/search?q=${"a".repeat(51)}`,
        authToken,
      );
      assert.equal(result.status, 400);
    });

    await t.test("Recherche insensible aux majuscules", async () => {
      const result = await request(
        `/api/profile/search?q=${suffix.toUpperCase()}`,
        authToken,
      );

      assert.equal(result.status, 200);

      const found = result.body.users.map((user) => user.id);

      assert.ok(found.includes(alice.id));
      assert.ok(found.includes(albert.id));
      assert.ok(!found.includes(alicia.id));
      assert.ok(!found.includes(alain.id));
    });

    await t.test("Profil privé absent des résultats", async () => {
      const result = await request("/api/profile/search?q=Alicia", authToken);

      assert.equal(result.status, 200);
      assert.ok(!result.body.users.some((user) => user.id === alicia.id));
    });

    await t.test("Profil FRIENDS absent des résultats", async () => {
      const result = await request("/api/profile/search?q=Alain", authToken);

      assert.equal(result.status, 200);
      assert.ok(!result.body.users.some((user) => user.id === alain.id));
    });

    await t.test("Résultats sans informations sensibles", async () => {
      const result = await request(
        `/api/profile/search?q=${suffix}`,
        authToken,
      );

      assert.equal(result.status, 200);

      for (const user of result.body.users) {
        assert.equal(user.visibility, "PUBLIC");
        assert.equal(user.email, undefined);
        assert.equal(user.passwordHash, undefined);
        assert.equal(user.tokenVersion, undefined);
        assert.equal(user.favoriteGenres, undefined);
        assert.equal(user.favoriteArtists, undefined);
      }
    });

    await t.test("Son propre profil exclu", async () => {
      const result = await request(
        `/api/profile/search?q=Observateur`,
        token(viewer),
      );

      assert.equal(result.status, 200);
      assert.ok(!result.body.users.some((user) => user.id === viewer.id));
    });

    await t.test("Consultation du profil public", async () => {
      const result = await request(`/api/profile/${alice.id}`, authToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.id, alice.id);
      assert.equal(result.body.user.email, undefined);
    });

    await t.test("Consultation privée toujours refusée", async () => {
      const result = await request(`/api/profile/${alicia.id}`, authToken);

      assert.equal(result.status, 404);
    });

    await t.test("Aucun résultat sur un nom inconnu", async () => {
      const result = await request(
        `/api/profile/search?q=${randomUUID()}`,
        authToken,
      );

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.users, []);
    });
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });

    await prisma.$disconnect();
  }
});
