-- AlterTable
ALTER TABLE "User" ADD COLUMN     "favoriteArtists" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "favoriteGenres" TEXT[] DEFAULT ARRAY[]::TEXT[];
