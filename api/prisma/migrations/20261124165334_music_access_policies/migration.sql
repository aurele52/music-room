-- CreateEnum
CREATE TYPE "MusicAccessPolicy" AS ENUM ('PUBLIC', 'INVITED_ONLY');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "editPolicy" "MusicAccessPolicy" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "votePolicy" "MusicAccessPolicy" NOT NULL DEFAULT 'PUBLIC';
