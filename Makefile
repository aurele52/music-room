.PHONY: install db db-down api web mobile build check migrate status test

install:
	pnpm install --frozen-lockfile
	pnpm db:generate
	python3 scripts/generate-audio.py

db:
	docker compose up -d db

db-down:
	docker compose down

api:
	pnpm dev:api

web:
	pnpm dev:web

mobile:
	pnpm dev:mobile

migrate:
	pnpm db:migrate

status:
	pnpm db:status

build:
	pnpm build

check:
	pnpm check

test:
	bash scripts/validate-all.sh

.PHONY: dev mail mail-down lint

dev:
	pnpm dev

mail:
	docker compose up -d mailpit

mail-down:
	docker compose stop mailpit

lint:
	pnpm --filter music-room-mobile lint
