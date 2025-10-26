from __future__ import annotations

import datetime
import enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class LinkRel(str, enum.Enum):
    dofollow = "follow"
    nofollow = "nofollow"
    sponsored = "sponsored"
    ugc = "ugc"
    unknown = "unknown"


class BacklinkStatus(str, enum.Enum):
    active = "active"
    lost = "lost"
    pending = "pending"


class Backlink(Base):
    __tablename__ = "backlinks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    target_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    rel: Mapped[LinkRel] = mapped_column(Enum(LinkRel), default=LinkRel.dofollow, nullable=False)
    anchor: Mapped[str | None] = mapped_column(String(512))
    context_snippet: Mapped[str | None] = mapped_column(Text)
    status: Mapped[BacklinkStatus] = mapped_column(Enum(BacklinkStatus), default=BacklinkStatus.active, nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer)
    first_seen: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    authority: Mapped[float] = mapped_column(default=0.0)
    toxicity: Mapped[float] = mapped_column(default=0.0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    source_page: Mapped["Page"] = relationship(back_populates="backlinks")
    events: Mapped[list["LinkEvent"]] = relationship(
        back_populates="backlink",
        cascade="all,delete-orphan",
        order_by="LinkEvent.event_at.desc()",
    )
    outreach: Mapped["Outreach | None"] = relationship(back_populates="backlink", uselist=False)


Index("ix_backlinks_source_target", Backlink.source_page_id, Backlink.target_url)
