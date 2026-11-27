#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "===== MUSIC ROOM - TESTS ISOLES ====="

# Lire l'URL actuelle et ne changer que le nom de la base.
# Aucune donnée de connexion ne sera affichée.
TEST_DATABASE_URL="$(
python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

path = Path("api/.env")

if not path.exists():
    raise SystemExit("ERREUR : api/.env absent")

values = []

for line in path.read_text().splitlines():
    line = line.strip()
    if line.startswith("DATABASE_URL="):
        value = line.split("=", 1)[1].strip().strip('"').strip("'")
        values.append(value)

if len(values) != 1:
    raise SystemExit("ERREUR : DATABASE_URL introuvable ou duplique")

url = urlsplit(values[0])

if url.scheme not in ("postgresql", "postgres"):
    raise SystemExit("ERREUR : PostgreSQL attendu")

if url.hostname not in ("127.0.0.1", "localhost"):
    raise SystemExit("ERREUR : base distante interdite pour ce script")

if url.path != "/musicroom":
    raise SystemExit("ERREUR : base source differente de musicroom")

if url.port != 5433:
    raise SystemExit("ERREUR : port PostgreSQL inattendu")

test_url = urlunsplit((
    url.scheme,
    url.netloc,
    "/musicroom_test",
    url.query,
    url.fragment
))

print(test_url)
PY
)"

export DATABASE_URL="$TEST_DATABASE_URL"
export NODE_ENV=development
export PORT=3199
export TEST_API_URL="http://127.0.0.1:${PORT}"


echo "BASE CIBLE : musicroom_test"
echo "BASE PRINCIPALE : protegee"

echo
echo "===== POSTGRESQL ====="

docker compose up -d db >/dev/null

EXISTS="$(
    docker compose exec -T db \
        psql -U musicroom -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname = 'musicroom_test';"
)"

if [ "$EXISTS" = "1" ]; then
    echo "Base musicroom_test deja presente"
else
    docker compose exec -T db \
        createdb -U musicroom musicroom_test
    echo "Base musicroom_test creee"
fi

echo
echo "===== MIGRATIONS TEST ====="

(
    cd api
    pnpm exec prisma migrate deploy
) > /tmp/music-room-test-migrations.log 2>&1 || {
    tail -n 25 /tmp/music-room-test-migrations.log
    exit 1
}

echo "Migrations appliquees"

echo
echo "===== COMPILATION ====="

pnpm check > /tmp/music-room-test-check.log 2>&1 || {
    tail -n 30 /tmp/music-room-test-check.log
    exit 1
}
echo "TypeScript OK"

pnpm build > /tmp/music-room-test-build.log 2>&1 || {
    tail -n 30 /tmp/music-room-test-build.log
    exit 1
}
echo "Build OK"

echo
echo "===== VERIFICATION PORT 3199 ====="

if ss -ltn | grep -q ':3199 '; then
    echo "ERREUR : port 3199 deja utilise"
    echo "Le port reserve aux tests est deja utilise"
    exit 1
fi

API_PID=""

cleanup() {
    if [ -n "$API_PID" ]; then
        kill "$API_PID" 2>/dev/null || true
        wait "$API_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo
echo "===== DEMARRAGE API TEST ====="

(
    cd api
    exec node dist/index.js
) > /tmp/music-room-test-api.log 2>&1 &

API_PID=$!

READY=0

for i in $(seq 1 30); do
    if curl -fsS --max-time 2 \
        http://127.0.0.1:3199/api/health \
        > /dev/null 2>&1; then
        READY=1
        break
    fi

    if ! kill -0 "$API_PID" 2>/dev/null; then
        break
    fi

    sleep 1
done

if [ "$READY" -ne 1 ]; then
    echo "ERREUR : API inaccessible"
    tail -n 25 /tmp/music-room-test-api.log
    exit 1
fi

echo "API TEST OK"

echo
echo "===== TESTS AUTOMATISES ====="

(
    cd api
    pnpm test
)

echo
echo "===== TEST CLIENT MOBILE / SOCKET.IO REEL ====="
(
    cd api
    pnpm exec tsx --test tests/mobile-realtime-integration.test.ts
)

echo
echo "===== VALIDATION TERMINEE ====="
echo "Les tests ont utilise musicroom_test"
