"""CRM-adjacent clinical relational foundation.

Revision ID: 0002_relational
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_relational"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("organizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False))
    op.create_table("professionals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False))
    op.create_index("ix_professionals_organization_id", "professionals", ["organization_id"])
    op.create_table("patients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("synthetic_code", sa.String(80), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.UniqueConstraint("organization_id", "synthetic_code", name="uq_patient_code_per_org"))
    op.create_index("ix_patients_organization_id", "patients", ["organization_id"])
    op.create_table("guardians",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False))
    op.create_index("ix_guardians_organization_id", "guardians", ["organization_id"])
    op.create_table("patient_guardians",
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), primary_key=True),
        sa.Column("guardian_id", sa.String(36), sa.ForeignKey("guardians.id"), primary_key=True),
        sa.Column("relationship", sa.String(60), nullable=False))
    op.add_column("cases", sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=True))
    op.create_index("ix_cases_patient_id", "cases", ["patient_id"])
    op.create_table("observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("source_excerpt", sa.Text(), nullable=False),
        sa.Column("functional_domain", sa.String(80), nullable=False),
        sa.Column("observation_text", sa.Text(), nullable=False),
        sa.Column("review_status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False))
    op.create_index("ix_observations_session_id", "observations", ["session_id"])


def downgrade():
    op.drop_index("ix_observations_session_id", table_name="observations")
    op.drop_table("observations")
    op.drop_index("ix_cases_patient_id", table_name="cases")
    op.drop_column("cases", "patient_id")
    op.drop_table("patient_guardians")
    op.drop_index("ix_guardians_organization_id", table_name="guardians")
    op.drop_table("guardians")
    op.drop_index("ix_patients_organization_id", table_name="patients")
    op.drop_table("patients")
    op.drop_index("ix_professionals_organization_id", table_name="professionals")
    op.drop_table("professionals")
    op.drop_table("organizations")
