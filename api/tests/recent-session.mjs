import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecentSession } from '../dist/services/session.js';

test('Sécurité - authentification récente', async (t) => {
  const now = 2_000_000_000;

  await t.test('Connexion immédiate acceptée', () => {
    assert.equal(isRecentSession(now, now), true);
  });

  await t.test('Connexion de 5 minutes acceptée', () => {
    assert.equal(isRecentSession(now - 300, now), true);
  });

  await t.test('Connexion de 10 minutes acceptée', () => {
    assert.equal(isRecentSession(now - 600, now), true);
  });

  await t.test('Connexion de 10 minutes et 1 seconde refusée', () => {
    assert.equal(isRecentSession(now - 601, now), false);
  });

  await t.test('Connexion de 30 minutes refusée', () => {
    assert.equal(isRecentSession(now - 1800, now), false);
  });

  await t.test('Date future refusée', () => {
    assert.equal(isRecentSession(now + 60, now), false);
  });

  await t.test('Date manquante refusée', () => {
    assert.equal(isRecentSession(undefined, now), false);
  });

  await t.test('Date non numérique refusée', () => {
    assert.equal(isRecentSession('2000000000', now), false);
  });
});
