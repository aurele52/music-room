BEGIN;

ALTER TABLE "EventPlaylist"
    ADD COLUMN "visibility" "EventVisibility"
        NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN "editPolicy" "MusicAccessPolicy"
        NOT NULL DEFAULT 'PUBLIC';

UPDATE "EventPlaylist" AS playlist
SET
    "visibility" = event."visibility",
    "editPolicy" = event."editPolicy"
FROM "Event" AS event
WHERE playlist."eventId" = event."id";

COMMIT;
