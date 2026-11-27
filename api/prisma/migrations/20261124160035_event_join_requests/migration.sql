-- CreateEnum
CREATE TYPE "EventJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "EventJoinRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "EventJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventJoinRequest_eventId_status_createdAt_idx" ON "EventJoinRequest"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EventJoinRequest_userId_status_idx" ON "EventJoinRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventJoinRequest_eventId_userId_key" ON "EventJoinRequest"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "EventJoinRequest" ADD CONSTRAINT "EventJoinRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJoinRequest" ADD CONSTRAINT "EventJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
