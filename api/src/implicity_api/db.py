import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.sql import visitors
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.sql.schema import Table

from implicity_api.models import METADATA

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./implicity.db")
engine = create_engine(DATABASE_URL)
TABLE_OWNERS = {
    table.name: owner
    for owner, metadata in zip(("engine", "memory", "app", "agent"), METADATA)
    for table in metadata.tables.values()
}


class OwnedSession(Session):
    @property
    def owner(self) -> str:
        return self.info["owner"]

    def execute(self, statement, *args, **kwargs):
        if isinstance(statement, (str, TextClause)):
            raise PermissionError("Raw SQL bypasses module table ownership")
        return super().execute(statement, *args, **kwargs)


@event.listens_for(OwnedSession, "do_orm_execute")
def enforce_table_ownership(execute_state) -> None:
    for table in visitors.iterate(execute_state.statement):
        if not isinstance(table, Table):
            continue
        owner = TABLE_OWNERS.get(table.name)
        if owner is not None and owner != execute_state.session.owner:
            raise PermissionError(
                f"{execute_state.session.owner} cannot read {owner}.{table.name}"
            )


def session_for(owner: str, bind=engine) -> Session:
    if owner not in {"engine", "memory", "app", "agent"}:
        raise ValueError(f"Unknown module: {owner}")
    return sessionmaker(bind=bind, class_=OwnedSession, info={"owner": owner})()
