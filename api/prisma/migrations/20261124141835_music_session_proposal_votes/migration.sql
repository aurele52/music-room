-- CreateTable
CREATE TABLE "MusicSessionProposalVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicSessionProposalVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicSessionProposalVote_userId_idx" ON "MusicSessionProposalVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicSessionProposalVote_proposalId_userId_key" ON "MusicSessionProposalVote"("proposalId", "userId");

-- AddForeignKey
ALTER TABLE "MusicSessionProposalVote" ADD CONSTRAINT "MusicSessionProposalVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MusicSessionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSessionProposalVote" ADD CONSTRAINT "MusicSessionProposalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
