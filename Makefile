# XSSPLOIT — developer shortcuts (Personal Edition)

.PHONY: setup dev build test clean payloads migrate docker-up docker-down

setup: ## Install all JS + Python dependencies
	pnpm install
	cd packages/python-services && pip install -r requirements.txt

dev: ## Run API + dashboard + callback in watch mode (turbo)
	pnpm dev

build: ## Build all packages
	pnpm build

test: ## Run all unit tests
	pnpm test

migrate: ## Create/migrate the SQLite database
	pnpm db:migrate

payloads: ## Download & index the payload library
	pnpm payloads:collect
	pnpm payloads:index

docker-up: ## Build & run the full local stack
	docker compose up --build -d

docker-down: ## Stop the stack
	docker compose down

clean: ## Remove build artifacts
	pnpm clean
