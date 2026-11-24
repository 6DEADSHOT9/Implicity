.PHONY: install lint lint-python lint-typescript test test-python test-typescript

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
