import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test("Profil - permissions de visibilité", async (t) => {
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

  async function request(path, method, token, body) {
    const response = await fetch(`${base}${path}`, {
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
        email: `alice-${suffix}@example.test`,
        name: "Alice",
        emailVerifiedAt: new Date(),
      },
    });
    ids.push(alice.id);

    const bob = await prisma.user.create({
      data: {
        email: `bob-${suffix}@example.test`,
        name: "Bob",
        emailVerifiedAt: new Date(),
      },
    });
    ids.push(bob.id);

    const aliceToken = makeToken(alice);
    const bobToken = makeToken(bob);
    const path = `/api/profile/${alice.id}`;

    await t.test("Profil privé par défaut", async () => {
      const result = await request("/api/profile/me", "GET", aliceToken);
      assert.equal(result.status, 200);
      assert.equal(result.body.user.visibility, "PRIVATE");
    });

    await t.test("Profil privé inaccessible aux autres", async () => {
      const result = await request(path, "GET", bobToken);
      assert.equal(result.status, 404);
    });

    await t.test("Propriétaire autorisé", async () => {
      const result = await request(path, "GET", aliceToken);
      assert.equal(result.status, 200);
    });

    await t.test("Modification sans JWT refusée", async () => {
      const result = await request(
        "/api/profile/me/visibility",
        "PATCH",
        null,
        { visibility: "PUBLIC" },
      );
      assert.equal(result.status, 401);
    });

    await t.test("Visibilité invalide refusée", async () => {
      const result = await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "EVERYONE" },
      );
      assert.equal(result.status, 400);
    });

    await t.test("Passage en PUBLIC", async () => {
      const result = await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "PUBLIC" },
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.user.visibility, "PUBLIC");
    });

    await t.test("Profil public accessible", async () => {
      const result = await request(path, "GET", bobToken);
      assert.equal(result.status, 200);
      assert.equal(result.body.user.name, "Alice");
      assert.equal(result.body.user.email, undefined);
      assert.equal(result.body.user.passwordHash, undefined);
      assert.equal(result.body.user.tokenVersion, undefined);
    });

    await t.test("Passage en FRIENDS", async () => {
      const result = await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "FRIENDS" },
      );
      assert.equal(result.status, 200);
    });

    await t.test("FRIENDS inaccessible avant ajout des amis", async () => {
      const result = await request(path, "GET", bobToken);
      assert.equal(result.status, 404);
    });

    await t.test("FRIENDS reste accessible au propriétaire", async () => {
      const result = await request(path, "GET", aliceToken);
      assert.equal(result.status, 200);
    });


    const informationPath = "/api/profile/me/information";

    const information = {
      publicBio: "Presentation publique",
      friendsBio: "Presentation pour les amis",
      privateNote: "Note strictement privee",
    };

    const [userLowId, userHighId] =
      [alice.id, bob.id].sort();

    const pair = {
      userLowId_userHighId: {
        userLowId,
        userHighId,
      },
    };

    await t.test("Informations vides par defaut", async () => {
      const result = await request(
        "/api/profile/me", "GET", aliceToken
      );

      assert.equal(result.status, 200);
      assert.equal(result.body.user.publicBio, "");
      assert.equal(result.body.user.friendsBio, "");
      assert.equal(result.body.user.privateNote, "");
    });

    await t.test("Informations protegees sans JWT", async () => {
      const result = await request(
        informationPath, "PUT", null, information
      );

      assert.equal(result.status, 401);
    });

    await t.test("Enregistrement des trois informations", async () => {
      const result = await request(
        informationPath, "PUT", aliceToken, information
      );

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.information, information);
    });

    await t.test("Proprietaire lit toutes ses informations", async () => {
      const result = await request(
        "/api/profile/me", "GET", aliceToken
      );

      assert.equal(result.status, 200);

      for (const [key, value] of Object.entries(information)) {
        assert.equal(result.body.user[key], value);
      }
    });

    await t.test("Informations invalides refusees sans perte", async () => {
      for (const body of [
        {},
        { ...information, publicBio: "a".repeat(501) },
        { ...information, privateNote: 123 },
        { ...information, friendsBio: "abc\u0000def" },
      ]) {
        const result = await request(
          informationPath, "PUT", aliceToken, body
        );

        assert.equal(result.status, 400);
      }

      const result = await request(
        "/api/profile/me", "GET", aliceToken
      );

      for (const [key, value] of Object.entries(information)) {
        assert.equal(result.body.user[key], value);
      }
    });

    await t.test("Modification des donnees sensibles ignoree", async () => {
      const result = await request(
        informationPath,
        "PUT",
        aliceToken,
        {
          ...information,
          id: bob.id,
          email: "intrus@example.test",
          tokenVersion: 999,
        }
      );

      assert.equal(result.status, 200);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: alice.id },
      });

      assert.equal(stored.email, alice.email);
      assert.equal(stored.tokenVersion, alice.tokenVersion);
    });

    await t.test("Chaque compte conserve ses propres informations", async () => {
      const result = await request(
        "/api/profile/me", "GET", bobToken
      );

      assert.equal(result.status, 200);
      assert.equal(result.body.user.publicBio, "");
      assert.equal(result.body.user.friendsBio, "");
      assert.equal(result.body.user.privateNote, "");
    });

    await t.test("Un inconnu ne voit que les informations publiques", async () => {
      const visibility = await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "PUBLIC" }
      );

      assert.equal(visibility.status, 200);

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.publicBio, information.publicBio);

      for (const key of [
        "friendsBio", "privateNote", "email",
        "passwordHash", "tokenVersion",
        "favoriteGenres", "favoriteArtists",
      ]) {
        assert.equal(result.body.user[key], undefined);
      }
    });

    await t.test("Une demande en attente ne donne aucun droit", async () => {
      await prisma.friendship.create({
        data: {
          userLowId,
          userHighId,
          requesterId: bob.id,
          status: "PENDING",
        },
      });

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.friendsBio, undefined);
      assert.equal(result.body.user.privateNote, undefined);
    });

    await t.test("Un ami confirme voit les informations amis", async () => {
      await prisma.friendship.update({
        where: pair,
        data: { status: "ACCEPTED" },
      });

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.publicBio, information.publicBio);
      assert.equal(result.body.user.friendsBio, information.friendsBio);
      assert.equal(result.body.user.privateNote, undefined);
      assert.equal(result.body.user.email, undefined);
    });

    await t.test("Un profil FRIENDS est accessible a un ami", async () => {
      const visibility = await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "FRIENDS" }
      );

      assert.equal(visibility.status, 200);

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.friendsBio, information.friendsBio);
      assert.equal(result.body.user.privateNote, undefined);
    });

    await t.test("Un profil PRIVATE reste inaccessible aux amis", async () => {
      await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "PRIVATE" }
      );

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 404);
    });

    await t.test("La suppression d'une amitie retire les droits", async () => {
      await request(
        "/api/profile/me/visibility",
        "PATCH",
        aliceToken,
        { visibility: "PUBLIC" }
      );

      await prisma.friendship.delete({ where: pair });

      const result = await request(path, "GET", bobToken);

      assert.equal(result.status, 200);
      assert.equal(result.body.user.friendsBio, undefined);
      assert.equal(result.body.user.privateNote, undefined);
    });

    await t.test("La recherche ne divulgue pas les informations privees", async () => {
      const result = await request(
        "/api/profile/search?q=Alice",
        "GET",
        bobToken
      );

      assert.equal(result.status, 200);

      for (const user of result.body.users) {
        assert.equal(user.privateNote, undefined);
        assert.equal(user.friendsBio, undefined);
        assert.equal(user.email, undefined);
      }
    });

    await t.test("Inconnu : HTTP 404", async () => {
      const result = await request(
        `/api/profile/${randomUUID()}`,
        "GET",
        bobToken,
      );
      assert.equal(result.status, 404);
    });
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    await prisma.$disconnect();
  }
});
