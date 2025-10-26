from __future__ import annotations

import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (UniqueConstraint("project_id", "root_domain", name="uq_domains_project_root"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    root_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    tld: Mapped[str | None] = mapped_column(String(32))
    asn: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(64))
    whois_country: Mapped[str | None] = mapped_column(String(64))
    authority_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    toxicity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    first_seen: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="domains")
    pages: Mapped[list["Page"]] = relationship(back_populates="domain", cascade="all,delete-orphan")


Index("ix_domains_root_domain", Domain.root_domain)
