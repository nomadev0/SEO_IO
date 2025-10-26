from __future__ import annotations

import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import String, TypeDecorator

from backlinks.db.base import Base


class TopicArray(TypeDecorator[list[str]]):
    """Persist topic tags as TEXT[] in Postgres and JSON elsewhere."""

    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY  # local import

            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        if value is None:
            return []
        return value


class PageScore(Base):
    __tablename__ = "page_scores"

    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    authority: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    outlinks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    topical: Mapped[list[str]] = mapped_column(TopicArray(), nullable=False, default=list)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["Page"] = relationship(back_populates="score")
