install:
	[ -f ./server/.env ] || cp ./server/.env-example ./server/.env
	[ -f ./client/.env ] || cp ./client/.env-example ./client/.env
	[ -f ./serverless/.env ] || cp ./serverless/.env-example ./serverless/.env
	docker-compose build

launch:
	docker-compose up

test-server:
	docker-compose exec server npm run test

generate-migration:
	docker-compose exec server sequelize migration:generate --name=$(NAME)
	cp ./server/dist/db/migrations/* ./server/src/db/migrations

build-server:
	docker-compose exec server npm run build-ts
	
db-migrate-all:
	cp ./server/src/db/migrations/* ./server/dist/db/migrations/
	docker-compose exec server npm run migrate:all
