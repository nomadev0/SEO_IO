from __future__ import annotations

import datetime
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class LinkEventType(str, enum.Enum):
    new = "new"
    lost = "lost"
    changed = "changed"
    recovered = "recovered"


class LinkEvent(Base):
    __tablename__ = "link_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    backlink_id: Mapped[int] = mapped_column(ForeignKey("backlinks.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[LinkEventType] = mapped_column(Enum(LinkEventType), nullable=False)
    event_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    diff: Mapped[dict | None] = mapped_column(JSON)

    backlink: Mapped["Backlink"] = relationship(back_populates="events")


Index("ix_link_events_type_at", LinkEvent.event_type, LinkEvent.event_at)
