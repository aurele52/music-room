-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE';
