"""Auditable human review of synthetic functional observations."""
from alembic import op
import sqlalchemy as sa

revision = "0003_observation_review"
down_revision = "0002_relational"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("observations", sa.Column("reviewed_text", sa.Text(), nullable=True))
    op.add_column("observations", sa.Column("reviewed_at", sa.Text(), nullable=True))
    op.add_column("observations", sa.Column("reviewed_by", sa.String(36), nullable=True))
    op.create_foreign_key("fk_observations_reviewer", "observations", "professionals", ["reviewed_by"], ["id"])
    op.create_table(
        "observation_review_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("observation_id", sa.String(36), sa.ForeignKey("observations.id"), nullable=False),
        sa.Column("reviewer_id", sa.String(36), sa.ForeignKey("professionals.id"), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("previous_status", sa.String(24), nullable=False),
        sa.Column("previous_text", sa.Text(), nullable=False),
        sa.Column("reviewed_text", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.CheckConstraint("decision IN ('approve', 'correct', 'reject')", name="ck_review_decision")
    )
    op.create_index("ix_review_events_observation_id", "observation_review_events", ["observation_id"])

def downgrade():
    op.drop_index("ix_review_events_observation_id", table_name="observation_review_events")
    op.drop_table("observation_review_events")
    op.drop_constraint("fk_observations_reviewer", "observations", type_="foreignkey")
    op.drop_column("observations", "reviewed_by")
    op.drop_column("observations", "reviewed_at")
    op.drop_column("observations", "reviewed_text")
