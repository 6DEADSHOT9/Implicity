# SQLite first, behind SQLAlchemy

Everything that is not a behaviour event lives in one SQLite file, accessed only through SQLAlchemy with Alembic migrations and no SQLite-only features. With PostHog holding events the local data is small, and SQLite removes a database container from a local install. Postgres is the planned destination for any hosted or multi-user version, and this discipline keeps that a configuration change.
