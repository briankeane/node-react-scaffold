install:
	[ -f ./server/.env ] || cp ./server/.env-example ./server/.env
	[ -f ./client/.env ] || cp ./client/.env-example ./client/.env
	docker compose build

launch:
	docker compose up

test-server:
	docker compose exec server npm run test

test-client:
	docker compose exec client npm run test

test-all: test-server test-client

lint-server:
	docker compose exec server npm run lint

lint-client:
	docker compose exec client npm run lint

lint-all: lint-server lint-client

generate-migration:
	docker compose exec server sequelize migration:generate --name=$(NAME)
	cp ./server/dist/db/migrations/* ./server/src/db/migrations

build-server:
	docker compose exec server npm run build-ts

db-migrate-all:
	cp ./server/src/db/migrations/* ./server/dist/db/migrations/
	docker compose exec server npm run migrate:all
