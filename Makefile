.PHONY: install lint lint-python lint-typescript test test-python test-typescript up-development up-production down compose-smoke

PNPM = npx --yes pnpm@12.23.0

install:
	uv sync --all-packages --locked
	$(PNPM) install --frozen-lockfile

lint: lint-python lint-typescript

lint-python:
	uv run ruff check api engine/python

lint-typescript:
	$(PNPM) lint

test: test-python test-typescript

test-python:
	uv run pytest

test-typescript:
	$(PNPM) test

up-development:
	docker compose --profile development up --build -d --wait --wait-timeout 1800

up-production:
	docker compose --profile production up --build -d --wait --wait-timeout 1800

down:
	docker compose --profile development --profile production down --remove-orphans

compose-smoke:
	./scripts/compose-smoke.sh
