.PHONY: install lint lint-python lint-typescript test test-python test-typescript contracts-generate contracts-check contracts-runtime-check registry-generate registry-check token-styles-check

PNPM = npx --yes pnpm@12.23.0
NODE = node

install:
	uv sync --all-packages --locked
	$(PNPM) install --frozen-lockfile
	$(PNPM) --filter @implicity/web install:browsers

lint: contracts-check token-styles-check lint-python lint-typescript

lint-python:
	uv run ruff check api engine/python contracts/python scripts

lint-typescript: contracts-check
	$(PNPM) lint

test: contracts-check contracts-runtime-check token-styles-check test-python test-typescript

contracts-generate:
	uv run --locked python scripts/generate-contracts.py
	$(PNPM) exec $(NODE) web/scripts/generate-registry-schemas.mjs

contracts-check:
	uv run --locked python scripts/generate-contracts.py --check
	$(PNPM) exec $(NODE) web/scripts/generate-registry-schemas.mjs --check

registry-generate:
	$(PNPM) exec $(NODE) web/scripts/generate-registry-schemas.mjs

registry-check:
	$(PNPM) exec $(NODE) web/scripts/generate-registry-schemas.mjs --check

token-styles-check:
	$(PNPM) exec node web/scripts/check-token-styles.mjs

contracts-runtime-check:
	uv run --locked python scripts/check-contracts-runtime.py

test-python:
	uv run pytest

test-typescript: lint-typescript
	$(PNPM) test
