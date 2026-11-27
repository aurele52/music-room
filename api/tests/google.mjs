import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Google OAuth - protections API', async (t) => {
  await t.test('Statut Google protégé', async () => {
    const response = await fetch(`${base}/api/auth/google/status`);
    assert.equal(response.status, 401);
  });

  await t.test('Liaison Google protégée', async () => {
    const response = await fetch(`${base}/api/auth/google/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'invalid' })
    });
    assert.equal(response.status, 401);
  });

  await t.test('Dissociation Google protégée', async () => {
    const response = await fetch(`${base}/api/auth/google/link`, {
      method: 'DELETE'
    });
    assert.equal(response.status, 401);
  });

  await t.test('Jeton Google invalide refusé', async () => {
    const response = await fetch(`${base}/api/auth/google/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'invalid' })
    });
    assert.equal(response.status, 401);
  });
});
