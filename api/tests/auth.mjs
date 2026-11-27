import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseUrl = process.env.TEST_API_URL
if (baseUrl !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}
const email = `test-${randomUUID()}@example.com`;
const password = 'TestPassword123!';
const newPassword = 'NewPassword456!';

async function request(path, method = 'GET', body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function mailToken(purpose) {
  for (let i = 0; i < 30; i++) {
    const content = await readFile(
      process.env.TEST_OUTBOX_FILE || '.dev-mails.jsonl',
      'utf8'
    ).catch(() => '');

    const mails = content.split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    const mail = mails.reverse().find(
      (item) => item.email === email && item.purpose === purpose
    );

    if (mail) {
      const url = new URL(mail.link);
      return url.searchParams.get(purpose === 'verify' ? 'verify' : 'reset');
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Lien ${purpose} introuvable`);
}

test('Authentification API V0.6', async (t) => {
  let jwtToken = '';

  await t.test('API disponible', async () => {
    const response = await request('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.database, 'ok');
  });

  await t.test('Profil protégé', async () => {
    assert.equal((await request('/api/auth/me')).status, 401);
  });

  await t.test('Inscription', async () => {
    const result = await request('/api/auth/register', 'POST', {
      email,
      password,
      name: 'Utilisateur Test'
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.token, undefined);
  });

  await t.test('Inscription en double refusée', async () => {
    const result = await request('/api/auth/register', 'POST', {
      email,
      password,
      name: 'Utilisateur Test'
    });

    assert.equal(result.status, 409);
  });

  await t.test('Connexion avant validation refusée', async () => {
    const result = await request('/api/auth/login', 'POST', {
      email,
      password
    });

    assert.equal(result.status, 403);
  });

  const verificationToken = await mailToken('verify');

  await t.test('Validation email', async () => {
    const result = await request('/api/auth/verify-email', 'POST', {
      token: verificationToken
    });

    assert.equal(result.status, 200);
  });

  await t.test('Lien email non réutilisable', async () => {
    const result = await request('/api/auth/verify-email', 'POST', {
      token: verificationToken
    });

    assert.equal(result.status, 400);
  });

  await t.test('Connexion', async () => {
    const result = await request('/api/auth/login', 'POST', {
      email,
      password
    });

    assert.equal(result.status, 200);
    jwtToken = result.body.token;
    assert.equal(typeof jwtToken, 'string');
  });

  await t.test('Profil avec JWT', async () => {
    const result = await request(
      '/api/auth/me', 'GET', undefined, jwtToken
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.user.email, email);
  });

  await t.test('Demande de nouveau mot de passe', async () => {
    const result = await request('/api/auth/forgot-password', 'POST', {
      email
    });
    assert.equal(result.status, 200);
  });

  const resetToken = await mailToken('reset');

  await t.test('Réinitialisation', async () => {
    const result = await request('/api/auth/reset-password', 'POST', {
      token: resetToken,
      password: newPassword
    });
    assert.equal(result.status, 200);
  });

  await t.test('Ancien JWT révoqué après réinitialisation', async () => {
    const result = await request(
      '/api/auth/me',
      'GET',
      undefined,
      jwtToken
    );

    assert.equal(result.status, 401);
  });

  await t.test('Lien de réinitialisation non réutilisable', async () => {
    const result = await request('/api/auth/reset-password', 'POST', {
      token: resetToken,
      password: newPassword
    });
    assert.equal(result.status, 400);
  });

  await t.test('Ancien mot de passe refusé', async () => {
    const result = await request('/api/auth/login', 'POST', {
      email,
      password
    });
    assert.equal(result.status, 401);
  });

  await t.test('Nouveau mot de passe accepté', async () => {
    const result = await request('/api/auth/login', 'POST', {
      email,
      password: newPassword
    });
    assert.equal(result.status, 200);

    const profile = await request(
      '/api/auth/me',
      'GET',
      undefined,
      result.body.token
    );

    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.email, email);
  });
});
