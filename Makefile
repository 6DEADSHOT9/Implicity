.PHONY: install lint lint-python lint-typescript test test-python test-typescript contracts-generate contracts-check

PNPM = npx --yes pnpm@12.23.0

install:
	uv sync --all-packages --locked
	$(PNPM) install --frozen-lockfile

lint: contracts-check lint-python lint-typescript

lint-python:
	uv run ruff check api engine/python

lint-typescript:
	$(PNPM) lint

test: contracts-check test-python test-typescript

contracts-generate:
	uv run --locked python scripts/generate-contracts.py

contracts-check:
	uv run --locked python scripts/generate-contracts.py --check

test-python:
	uv run pytest

test-typescript:
	$(PNPM) test
