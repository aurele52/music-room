import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { checkGoogleLink } from '../dist/services/googleLinkPolicy.js';

test('Google - règles de liaison', async (t) => {
  await t.test('Même email autorisé', () => {
    assert.equal(
      checkGoogleLink('alice@example.com', 'alice@example.com', false, false),
      'ok'
    );
  });

  await t.test('Majuscules acceptées', () => {
    assert.equal(
      checkGoogleLink('Alice@Example.com', 'alice@example.com', false, false),
      'ok'
    );
  });

  await t.test('Email différent refusé', () => {
    assert.equal(
      checkGoogleLink('alice@example.com', 'bob@example.com', false, false),
      'email-mismatch'
    );
  });

  await t.test('Compte déjà lié refusé', () => {
    assert.equal(
      checkGoogleLink('alice@example.com', 'alice@example.com', true, false),
      'already-linked'
    );
  });

  await t.test('Identité Google déjà utilisée refusée', () => {
    assert.equal(
      checkGoogleLink('alice@example.com', 'alice@example.com', false, true),
      'google-in-use'
    );
  });
});

test('Google - contraintes PostgreSQL', async (t) => {
  const url = process.env.DATABASE_URL;

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    t.skip('Test PostgreSQL réservé à musicroom_test');
    return;
  }

  const db = new PrismaClient();
  const suffix = randomUUID();
  const ids = [];

  try {
    const first = await db.user.create({
      data: {
        email: `google-a-${suffix}@example.test`,
        name: 'Google Test A',
        emailVerifiedAt: new Date()
      }
    });
    ids.push(first.id);

    const second = await db.user.create({
      data: {
        email: `google-b-${suffix}@example.test`,
        name: 'Google Test B',
        emailVerifiedAt: new Date()
      }
    });
    ids.push(second.id);

    await t.test('Un Google sub ne peut être lié à deux utilisateurs', async () => {
      const sub = `test-google-${suffix}`;

      const results = await Promise.allSettled([
        db.googleAccount.create({
          data: { googleSub: sub, userId: first.id }
        }),
        db.googleAccount.create({
          data: { googleSub: sub, userId: second.id }
        })
      ]);

      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);

      const rejected = results.find(r => r.status === 'rejected');
      assert.equal(rejected.reason.code, 'P2002');
    });

    await db.googleAccount.deleteMany({
      where: { userId: { in: ids } }
    });

    await t.test('Un utilisateur ne peut lier deux comptes Google', async () => {
      const results = await Promise.allSettled([
        db.googleAccount.create({
          data: {
            googleSub: `test-google-a-${suffix}`,
            userId: first.id
          }
        }),
        db.googleAccount.create({
          data: {
            googleSub: `test-google-b-${suffix}`,
            userId: first.id
          }
        })
      ]);

      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);

      const rejected = results.find(r => r.status === 'rejected');
      assert.equal(rejected.reason.code, 'P2002');
    });
  } finally {
    await db.googleAccount.deleteMany({
      where: { userId: { in: ids } }
    });

    await db.user.deleteMany({
      where: { id: { in: ids } }
    });

    await db.$disconnect();
  }
});
