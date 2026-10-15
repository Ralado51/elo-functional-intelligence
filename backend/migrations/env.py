import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from app.models import Base

config = context.config
target_metadata = Base.metadata

def run_migrations_offline():
    url = os.environ.get("ELO_DATABASE_URL")
    if not url:
        raise RuntimeError("Set ELO_DATABASE_URL to run migrations")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    url = os.environ.get("ELO_DATABASE_URL")
    if not url:
        raise RuntimeError("Set ELO_DATABASE_URL to run migrations")
    from sqlalchemy import create_engine
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
