from __future__ import annotations

import datetime
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class OutreachStage(str, enum.Enum):
    prospect = "prospect"
    contacted = "contacted"
    negotiating = "negotiating"
    live = "live"
    archived = "archived"


class Outreach(Base):
    __tablename__ = "outreach"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    backlink_id: Mapped[int] = mapped_column(ForeignKey("backlinks.id", ondelete="CASCADE"), nullable=False)
    stage: Mapped[OutreachStage] = mapped_column(Enum(OutreachStage), default=OutreachStage.prospect, nullable=False)
    owner: Mapped[str | None] = mapped_column(String(128))
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    backlink: Mapped["Backlink"] = relationship(back_populates="outreach")
