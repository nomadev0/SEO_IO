from __future__ import annotations

import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backlinks.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    domains: Mapped[list["Domain"]] = relationship(back_populates="project", cascade="all,delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="project", cascade="all,delete-orphan")
