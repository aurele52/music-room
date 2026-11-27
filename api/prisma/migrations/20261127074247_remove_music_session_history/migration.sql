-- Suppression de l'historique des commandes musicales.
-- Les sessions, morceaux, propositions et votes sont conserves.

BEGIN;

DROP TABLE "MusicSessionHistory";

COMMIT;
