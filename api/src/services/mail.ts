import { createHash, randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { prisma } from '../db.js';

export type TokenPurpose = 'verify' | 'reset';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false
});

export async function sendAuthLink(
  userId: string,
  email: string,
  purpose: TokenPurpose
): Promise<void> {
  const token = randomBytes(32).toString('hex');

  await prisma.$transaction(async (tx) => {
    await tx.authToken.deleteMany({
      where: { userId, purpose }
    });

    await tx.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
  });

  const webUrl = process.env.WEB_URL || 'http://localhost:3101';
  const parameter = purpose === 'verify' ? 'verify' : 'reset';
  const link = `${webUrl}/?${parameter}=${token}`;

  const subject = purpose === 'verify'
    ? 'Music Room - Vérifie ton adresse email'
    : 'Music Room - Réinitialise ton mot de passe';

  const message = purpose === 'verify'
    ? 'Valide ton adresse email'
    : 'Choisis un nouveau mot de passe';

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Music Room <noreply@musicroom.test>',
    to: email,
    subject,
    text: `${message} : ${link}\n\nCe lien expire dans 30 minutes.`
  });

  // Conserver la boîte de test uniquement en développement.
  if (process.env.NODE_ENV === 'development' &&
      process.env.MAIL_OUTBOX_FILE) {
    await appendFile(
      process.env.MAIL_OUTBOX_FILE,
      JSON.stringify({ email, purpose, link }) + '\n',
      { mode: 0o600 }
    );
  }
}
