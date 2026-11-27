#!/usr/bin/env bash

set -uo pipefail

cd "$(dirname "$0")/.."

RESULT=0

run_test() {
    local name="$1"
    local log="$2"

    shift 2

    echo
    echo "===== $name ====="

    if "$@" > "$log" 2>&1; then
        echo "OK"

        sed -r 's/\x1B\[[0-9;]*[mK]//g' "$log" |
            grep -E \
            'Test Files|Tests |TypeScript OK|Build OK|ℹ tests|ℹ pass|ℹ fail|VALIDATION TERMINEE' |
            tail -n 15 || true
    else
        echo "ECHEC"
        tail -n 60 "$log"
        RESULT=1
    fi
}

echo "===== MUSIC ROOM - VALIDATION COMPLETE ====="

run_test \
    "TYPESCRIPT GLOBAL" \
    /tmp/music-room-check.log \
    pnpm check

run_test \
    "TESTS WEB" \
    /tmp/music-room-web-tests.log \
    pnpm --filter music-room-web test:unit

run_test \
    "TYPESCRIPT TESTS MOBILE" \
    /tmp/music-room-mobile-check.log \
    pnpm --filter music-room-mobile check:tests

run_test \
    "TESTS MOBILE" \
    /tmp/music-room-mobile-tests.log \
    pnpm --filter music-room-mobile test

run_test \
    "BACKEND ET INTEGRATION ISOLES" \
    /tmp/music-room-full-tests.log \
    bash scripts/test-isolated.sh

echo
echo "===== BASE PRINCIPALE ====="

if ! docker compose exec -T db \
    psql -U musicroom -d musicroom -tAc \
    'SELECT COUNT(*) FROM "User";'
then
    RESULT=1
fi

echo
echo "===== GIT ====="

if ! git diff --check; then
    RESULT=1
fi

echo
echo "===== BILAN ====="

if [ "$RESULT" -eq 0 ]; then
    echo "VALIDATION COMPLETE OK"
else
    echo "VALIDATION COMPLETE ECHEC"
fi

exit "$RESULT"
