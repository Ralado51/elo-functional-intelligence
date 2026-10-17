"""Durable one-attempt reservation and explicit family-draft review."""
from alembic import op
import sqlalchemy as sa
revision = '0005_family_reports'
down_revision = '0004_reviewed_functional_domain'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('family_reports',
        sa.Column('session_id', sa.String(36), sa.ForeignKey('sessions.id'), primary_key=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('evidence_hash', sa.String(64), nullable=False),
        sa.Column('evidence_json', sa.Text(), nullable=False),
        sa.Column('report_json', sa.Text()),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('reviewed_by', sa.String(36), sa.ForeignKey('professionals.id')),
        sa.Column('reviewed_at', sa.Text()), sa.Column('review_reason', sa.Text()))

def downgrade():
    op.drop_table('family_reports')
