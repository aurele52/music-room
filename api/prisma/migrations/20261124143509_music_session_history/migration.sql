-- CreateTable
CREATE TABLE "MusicSessionHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromIndex" INTEGER,
    "toIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicSessionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicSessionHistory_sessionId_createdAt_idx" ON "MusicSessionHistory"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "MusicSessionHistory_actorId_idx" ON "MusicSessionHistory"("actorId");

-- AddForeignKey
ALTER TABLE "MusicSessionHistory" ADD CONSTRAINT "MusicSessionHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MusicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSessionHistory" ADD CONSTRAINT "MusicSessionHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
