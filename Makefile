.PHONY: install lint lint-python lint-typescript test test-python test-typescript contracts-generate contracts-check contracts-runtime-check up-development up-production down compose-smoke

PNPM = npx --yes pnpm@12.23.0

install:
	uv sync --all-packages --locked
	$(PNPM) install --frozen-lockfile

lint: contracts-check lint-python lint-typescript

lint-python:
	uv run ruff check api engine/python contracts/python scripts

lint-typescript: contracts-check
	$(PNPM) lint

test: contracts-check contracts-runtime-check test-python test-typescript

contracts-generate:
	uv run --locked python scripts/generate-contracts.py

contracts-check:
	uv run --locked python scripts/generate-contracts.py --check

contracts-runtime-check:
	uv run --locked python scripts/check-contracts-runtime.py

test-python:
	uv run pytest

test-typescript: lint-typescript
	$(PNPM) test

up-development:
	docker compose --profile development up --build -d --wait --wait-timeout 1800

up-production:
	docker compose --profile production up --build -d --wait --wait-timeout 1800

down:
	docker compose --profile development --profile production down --remove-orphans

compose-smoke:
	./scripts/compose-smoke.sh
