import json
from typing import Any

from sqlalchemy import event, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.sql import visitors
from sqlalchemy.sql.elements import ColumnClause, TextClause
from sqlalchemy.sql.schema import Table
from sqlalchemy.sql.selectable import TableClause

from implicity_api.db import engine as default_engine
from implicity_api.models.agent import AgentSession
from implicity_api.models.app import Message, MessageSpec
from implicity_api.models.engine import Decision
from implicity_api.models.metadata import METADATA
from implicity_api.stores.app import delete_unattached_message_specs_before

TABLE_OWNERS = {
    table.name: owner
    for owner, metadata in METADATA.items()
    for table in metadata.tables.values()
}
OWNER_BY_METADATA = {metadata: owner for owner, metadata in METADATA.items()}
SESSION_REQUIRED = (Message, AgentSession)


class _OwnedSession(Session):
    @property
    def owner(self) -> str:
        return self.info["owner"]

    def execute(self, statement: Any, *args: Any, **kwargs: Any):
        if isinstance(statement, (str, TextClause)):
            raise PermissionError("Raw SQL bypasses module table ownership")
        return super().execute(statement, *args, **kwargs)

    def get(self, entity, ident, **kwargs):
        _check_model(entity, self.owner)
        return super().get(entity, ident, **kwargs)


@event.listens_for(_OwnedSession, "do_orm_execute")
def _check_statement(execute_state) -> None:
    _check_tables(execute_state.statement, execute_state.session.owner)


@event.listens_for(_OwnedSession, "before_flush")
def _check_writes(session, _flush_context, _instances) -> None:
    for row in session.new.union(session.dirty).union(session.deleted):
        _check_model(type(row), session.owner)


def _check_model(model: type, owner: str) -> None:
    actual_owner = OWNER_BY_METADATA.get(model.__table__.metadata)
    if actual_owner != owner:
        raise PermissionError(
            f"{owner} cannot access {actual_owner}.{model.__tablename__}"
        )


def _check_tables(statement: Any, owner: str) -> None:
    if isinstance(statement, (str, TextClause)):
        raise PermissionError("Raw SQL bypasses module table ownership")
    for element in visitors.iterate(statement):
        if isinstance(element, TextClause) or (
            isinstance(element, ColumnClause) and element.is_literal
        ):
            raise PermissionError("Textual SQL bypasses module table ownership")
        table = element
        if isinstance(table, (Table, TableClause)):
            actual_owner = TABLE_OWNERS.get(table.name)
            if actual_owner != owner:
                raise PermissionError(
                    f"{owner} cannot access {actual_owner or 'unowned'}.{table.name}"
                )


class ModuleStore:
    __slots__ = ("__owner", "__engine")

    def __init__(self, owner: str, bind: Engine = default_engine):
        if owner not in METADATA:
            raise ValueError(f"Unknown module: {owner}")
        self.__owner = owner
        self.__engine = bind

    def get(self, model: type, row_id: str):
        _check_model(model, self.__owner)
        with self._session() as session:
            return session.get(model, row_id)

    def select(self, statement: Any) -> list[Any]:
        _check_tables(statement, self.__owner)
        with self._session() as session:
            return session.execute(statement).all()

    def list(self, model: type) -> list[Any]:
        _check_model(model, self.__owner)
        with self._session() as session:
            return session.scalars(select(model)).all()

    def filter_by(self, model: type, **filters: Any) -> list[Any]:
        _check_model(model, self.__owner)
        with self._session() as session:
            return session.scalars(select(model).filter_by(**filters)).all()

    def insert(self, row: Any):
        self._validate(row)
        with self._session() as session, session.begin():
            session.add(row)
            session.flush()
        return row

    def put(self, row: Any):
        self._validate(row)
        with self._session() as session, session.begin():
            session.merge(row)
            session.flush()
        return row

    def put_many(self, rows: list[Any]) -> list[Any]:
        for row in rows:
            self._validate(row)
        with self._session() as session, session.begin():
            for row in rows:
                session.merge(row)
            session.flush()
        return rows

    def attach_message_spec(self, message_id: str, spec_id: str) -> str | None:
        if self.__owner != "app":
            raise PermissionError("Only the app store owns message specs")
        with self._session() as session, session.begin():
            message = session.get(Message, message_id)
            if message is None:
                return "message_missing"
            spec = session.get(MessageSpec, spec_id)
            if spec is None:
                return "spec_missing"
            if message.data.get("role") != "assistant":
                return "not_assistant"
            existing = message.data.get("message_spec_id")
            if spec.session_id is not None:
                return (
                    "already_attached"
                    if existing != spec_id or spec.session_id != message.session_id
                    else None
                )
            if existing is not None and existing != spec_id:
                return "message_has_spec"
            claimed = session.execute(
                update(MessageSpec)
                .where(MessageSpec.id == spec_id, MessageSpec.session_id.is_(None))
                .values(session_id=message.session_id)
            )
            if claimed.rowcount != 1:
                return "already_attached"
            message.data = {**message.data, "message_spec_id": spec_id}
        return None

    def delete_unattached_message_specs_before(self, cutoff) -> int:
        if self.__owner != "app":
            raise PermissionError("Only the app store owns message specs")
        return delete_unattached_message_specs_before(cutoff, self.__engine)

    def _validate(self, row: Any) -> None:
        model = type(row)
        _check_model(model, self.__owner)
        if isinstance(row, SESSION_REQUIRED) and not row.session_id:
            raise ValueError(f"{model.__tablename__} requires session_id")
        if model in (Decision, MessageSpec):
            from implicity_contracts.codec import decode_contract, encode_contract
            from implicity_contracts.generated import Decision as ContractDecision
            from implicity_contracts.generated import Spec as ContractSpec
            from jsonschema.exceptions import (
                ValidationError as JSONSchemaValidationError,
            )

            contract = ContractDecision if model is Decision else ContractSpec
            try:
                value = decode_contract(json.dumps(row.data, allow_nan=False))
                if not isinstance(value, contract):
                    raise ValueError(
                        f"{model.__tablename__} payload has the wrong contract"
                    )
            except (JSONSchemaValidationError, TypeError, ValueError) as error:
                raise ValueError(
                    f"Invalid {model.__tablename__} contract payload"
                ) from error
            if isinstance(value, ContractDecision) and row.id != row.data.get("id"):
                raise ValueError("Decision row id must match its contract id")
            row.data = json.loads(encode_contract(value))

    def _session(self) -> Session:
        return sessionmaker(
            bind=self.__engine,
            class_=_OwnedSession,
            expire_on_commit=False,
            info={"owner": self.__owner},
        )()


def create_store(owner: str, bind: Engine = default_engine) -> ModuleStore:
    return ModuleStore(owner, bind)
