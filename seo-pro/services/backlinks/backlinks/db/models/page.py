from __future__ import annotations

import datetime
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class PageStatus(str, enum.Enum):
    active = "active"
    redirected = "redirected"
    broken = "broken"
    unknown = "unknown"


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    domain_id: Mapped[int] = mapped_column(ForeignKey("domains.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    status: Mapped[PageStatus] = mapped_column(Enum(PageStatus), default=PageStatus.active, nullable=False)
    lang: Mapped[str | None] = mapped_column(String(8))
    country_guess: Mapped[str | None] = mapped_column(String(8))
    title: Mapped[str | None] = mapped_column(String(512))
    crawled_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    html_snapshot: Mapped[str | None] = mapped_column(Text)

    domain: Mapped["Domain"] = relationship(back_populates="pages")
    backlinks: Mapped[list["Backlink"]] = relationship(
        back_populates="source_page",
        cascade="all,delete-orphan",
    )
    score: Mapped["PageScore | None"] = relationship(back_populates="page", uselist=False)


Index("ix_pages_domain_id", Page.domain_id)
