import type { Prisma } from '@prisma/client'

// Verrou pessimiste partagé par les votes, les playlists
// et les mises à jour de licences.
//
// Toujours acquérir ce verrou AVANT de lire les permissions
// utilisées pour autoriser une écriture.
export async function lockEventMusic(
  tx: Prisma.TransactionClient,
  eventId: string
): Promise<void> {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Event"
    WHERE "id" = ${eventId}
    FOR UPDATE
  `
}
