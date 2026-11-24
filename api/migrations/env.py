from alembic import context
from implicity_api.db import database_url
from implicity_api.models import METADATA
from sqlalchemy import engine_from_config, pool

config = context.config
target_metadata = tuple(METADATA.values())


def run_migrations_offline() -> None:
    config.set_main_option("sqlalchemy.url", database_url().replace("%", "%%"))
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return

    config.set_main_option("sqlalchemy.url", database_url().replace("%", "%%"))
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as migration_connection:
        context.configure(
            connection=migration_connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
