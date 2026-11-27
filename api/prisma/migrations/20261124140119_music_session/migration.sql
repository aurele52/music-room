-- CreateEnum
CREATE TYPE "MusicSessionState" AS ENUM ('PAUSED', 'PLAYING', 'STOPPED');

-- CreateTable
CREATE TABLE "MusicSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourcePlaylistTitle" TEXT NOT NULL,
    "state" "MusicSessionState" NOT NULL DEFAULT 'PAUSED',
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "MusicSessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicSession_eventId_key" ON "MusicSession"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicSessionItem_sessionId_position_key" ON "MusicSessionItem"("sessionId", "position");

-- AddForeignKey
ALTER TABLE "MusicSession" ADD CONSTRAINT "MusicSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSessionItem" ADD CONSTRAINT "MusicSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MusicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
