"""Preserve original domain and audit human-reviewed functional domain."""
from alembic import op
import sqlalchemy as sa

revision = "0004_reviewed_functional_domain"
down_revision = "0003_observation_review"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("observations", sa.Column("reviewed_domain", sa.String(80), nullable=True))
    op.add_column("observation_review_events", sa.Column("previous_domain", sa.String(80), nullable=True))
    op.add_column("observation_review_events", sa.Column("reviewed_domain", sa.String(80), nullable=True))
    op.execute("UPDATE observations SET reviewed_domain = functional_domain WHERE review_status IN ('approved', 'corrected')")
    op.execute("""UPDATE observation_review_events
        SET previous_domain = (SELECT o.functional_domain FROM observations o WHERE o.id = observation_id),
            reviewed_domain = CASE WHEN decision IN ('approve', 'correct')
              THEN (SELECT o.functional_domain FROM observations o WHERE o.id = observation_id) ELSE NULL END""")

def downgrade():
    op.drop_column("observation_review_events", "reviewed_domain")
    op.drop_column("observation_review_events", "previous_domain")
    op.drop_column("observations", "reviewed_domain")
