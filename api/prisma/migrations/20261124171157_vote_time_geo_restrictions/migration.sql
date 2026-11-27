-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "voteLatitude" DOUBLE PRECISION,
ADD COLUMN     "voteLongitude" DOUBLE PRECISION,
ADD COLUMN     "voteRadiusMeters" INTEGER,
ADD COLUMN     "voteWindowEnd" TIMESTAMP(3),
ADD COLUMN     "voteWindowStart" TIMESTAMP(3);
