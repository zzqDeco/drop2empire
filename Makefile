.PHONY: gen check-arch test build dev-backend dev-web

gen:
	bash ops/codegen.sh

check-arch:
	bash ops/check-architecture.sh

test:
	cd pkg && go test -race ./... && go vet ./...
	cd contracts/gen/game && go test -race ./... && go vet ./...
	cd services/game && go test -race ./... && go vet ./...
	cd apps/web && npm run lint && npm test && npm run build

dev-backend:
	cd services/game && go run ./cmd

dev-web:
	cd apps/web && npm run dev
