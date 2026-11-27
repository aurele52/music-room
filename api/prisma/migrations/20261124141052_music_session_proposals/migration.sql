-- CreateEnum
CREATE TYPE "MusicProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MusicSessionProposal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "status" "MusicProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "MusicSessionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicSessionProposal_sessionId_status_createdAt_idx" ON "MusicSessionProposal"("sessionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MusicSessionProposal_proposedById_idx" ON "MusicSessionProposal"("proposedById");

-- AddForeignKey
ALTER TABLE "MusicSessionProposal" ADD CONSTRAINT "MusicSessionProposal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MusicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSessionProposal" ADD CONSTRAINT "MusicSessionProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
