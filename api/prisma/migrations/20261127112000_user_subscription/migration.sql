CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM');

ALTER TABLE "User"
ADD COLUMN "subscription" "SubscriptionPlan"
NOT NULL DEFAULT 'FREE';
