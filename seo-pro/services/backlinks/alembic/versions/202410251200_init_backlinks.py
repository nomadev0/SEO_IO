"""Initial schema for backlinks module.

Revision ID: 202410251200
Revises:
Create Date: 2024-10-25 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "202410251200"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "domains",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("root_domain", sa.String(length=255), nullable=False),
        sa.Column("tld", sa.String(length=32)),
        sa.Column("asn", sa.String(length=64)),
        sa.Column("ip", sa.String(length=64)),
        sa.Column("whois_country", sa.String(length=64)),
        sa.Column("authority_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("toxicity_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "root_domain", name="uq_domains_project_root"),
    )
    op.create_index("ix_domains_root_domain", "domains", ["root_domain"])

    op.create_table(
        "pages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("domain_id", sa.Integer(), sa.ForeignKey("domains.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False, unique=True),
        sa.Column(
            "status",
            sa.Enum("active", "redirected", "broken", "unknown", name="pagestatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("lang", sa.String(length=8)),
        sa.Column("country_guess", sa.String(length=8)),
        sa.Column("title", sa.String(length=512)),
        sa.Column("crawled_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("html_snapshot", sa.Text()),
    )
    op.create_index("ix_pages_domain_id", "pages", ["domain_id"])

    op.create_table(
        "page_scores",
        sa.Column(
            "page_id",
            sa.Integer(),
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("authority", sa.Float(), nullable=False, server_default="0"),
        sa.Column("outlinks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("topical", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "backlinks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_page_id", sa.Integer(), sa.ForeignKey("pages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_url", sa.String(length=2048), nullable=False),
        sa.Column(
            "rel",
            sa.Enum("follow", "nofollow", "sponsored", "ugc", "unknown", name="linkrel"),
            nullable=False,
            server_default="follow",
        ),
        sa.Column("anchor", sa.String(length=512)),
        sa.Column("context_snippet", sa.Text()),
        sa.Column(
            "status",
            sa.Enum("active", "lost", "pending", name="backlinkstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("status_code", sa.Integer()),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("authority", sa.Float(), nullable=False, server_default="0"),
        sa.Column("toxicity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_backlinks_source_target", "backlinks", ["source_page_id", "target_url"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "link_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("backlink_id", sa.Integer(), sa.ForeignKey("backlinks.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum("new", "lost", "changed", "recovered", name="linkeventtype"),
            nullable=False,
        ),
        sa.Column("event_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("diff", postgresql.JSONB(astext_type=sa.Text())),
    )
    op.create_index("ix_link_events_type_at", "link_events", ["event_type", "event_at"])

    op.create_table(
        "outreach",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("backlink_id", sa.Integer(), sa.ForeignKey("backlinks.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "stage",
            sa.Enum("prospect", "contacted", "negotiating", "live", "archived", name="outreachstage"),
            nullable=False,
            server_default="prospect",
        ),
        sa.Column("owner", sa.String(length=128)),
        sa.Column("cost", sa.Numeric(10, 2)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("outreach")
    op.drop_index("ix_link_events_type_at", table_name="link_events")
    op.drop_table("link_events")
    op.drop_table("alerts")
    op.drop_index("ix_backlinks_source_target", table_name="backlinks")
    op.drop_table("backlinks")
    op.drop_table("page_scores")
    op.drop_index("ix_pages_domain_id", table_name="pages")
    op.drop_table("pages")
    op.drop_index("ix_domains_root_domain", table_name="domains")
    op.drop_table("domains")
    op.drop_table("projects")

    sa.Enum(name="outreachstage").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="linkeventtype").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="backlinkstatus").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="linkrel").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="pagestatus").drop(op.get_bind(), checkfirst=False)
