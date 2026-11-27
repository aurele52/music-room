import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl || new URL(databaseUrl).pathname !== '/musicroom') {
  throw new Error('Seed autorisé uniquement sur la base musicroom')
}

const password = process.env.SEED_PASSWORD || 'MusicRoom2026!'

const users = [
  {
    name: 'Alice Martin',
    email: 'alice.seed@example.test',
    visibility: 'PUBLIC',
    favoriteGenres: ['Rock', 'Indie', 'Pop'],
    favoriteArtists: ['Muse', 'Arctic Monkeys']
  },
  {
    name: 'Lucas Bernard',
    email: 'lucas.seed@example.test',
    visibility: 'PUBLIC',
    favoriteGenres: ['Techno', 'House', 'Electro'],
    favoriteArtists: ['Daft Punk', 'Justice']
  },
  {
    name: 'Emma Dubois',
    email: 'emma.seed@example.test',
    visibility: 'FRIENDS',
    favoriteGenres: ['Jazz', 'Soul', 'Funk'],
    favoriteArtists: ['Amy Winehouse', 'Jamiroquai']
  },
  {
    name: 'Hugo Petit',
    email: 'hugo.seed@example.test',
    visibility: 'PRIVATE',
    favoriteGenres: ['Metal', 'Rock'],
    favoriteArtists: ['Metallica', 'Gojira']
  },
  {
    name: 'Chloé Laurent',
    email: 'chloe.seed@example.test',
    visibility: 'PUBLIC',
    favoriteGenres: ['Rap', 'Hip-Hop', 'R&B'],
    favoriteArtists: ['Orelsan', 'Kendrick Lamar']
  }
]

try {
  const passwordHash = await bcrypt.hash(password, 12)

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (existing) {
      console.log(`EXISTE : ${user.name} (${user.email})`)
      continue
    }

    await prisma.user.create({
      data: {
        ...user,
        passwordHash,
        emailVerifiedAt: new Date()
      }
    })

    console.log(`CRÉÉ : ${user.name} (${user.email})`)
  }

  console.log('Seed terminé')
} finally {
  await prisma.$disconnect()
}
