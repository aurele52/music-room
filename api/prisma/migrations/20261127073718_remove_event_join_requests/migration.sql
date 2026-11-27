-- Suppression des demandes de participation hors sujet.
-- Les invitations et les droits existants sont conserves.

BEGIN;

DROP TABLE "EventJoinRequest";
DROP TYPE "EventJoinRequestStatus";

COMMIT;
