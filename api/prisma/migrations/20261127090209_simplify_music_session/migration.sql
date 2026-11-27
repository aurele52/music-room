BEGIN;

ALTER TABLE "MusicSession"
    DROP COLUMN "ranked",
    DROP COLUMN "sourcePlaylistTitle";

COMMIT;
