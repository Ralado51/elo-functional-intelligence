"""Initial cases and sessions schema.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cases",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("case_id", sa.String(80), sa.ForeignKey("cases.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("extraction_json", sa.Text()),
        sa.Column("reviewed_text", sa.Text()),
        sa.Column("approved_at", sa.Text()),
        sa.CheckConstraint("duration_minutes = 40", name="ck_session_40_minutes"),
    )
    op.create_index("ix_sessions_case_id", "sessions", ["case_id"])


def downgrade():
    op.drop_index("ix_sessions_case_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("cases")
