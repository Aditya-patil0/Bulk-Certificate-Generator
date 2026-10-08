import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(255), nullable=False)
    course_name = Column(String(255), nullable=False)
    issuer_organization = Column(String(255), nullable=False)
    issue_date = Column(String(50), nullable=False)
    instructor_name = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="PENDING", index=True)
    # PENDING, PROCESSING, COMPLETED, PARTIALLY_FAILED, FAILED

    total_count = Column(Integer, default=0, nullable=False)
    processed_count = Column(Integer, default=0, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    error_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    certificates = relationship(
        "CertificateRecord",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="CertificateRecord.created_at"
    )

class CertificateRecord(Base):
    __tablename__ = "certificates"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_name = Column(String(255), nullable=False)
    recipient_email = Column(String(255), nullable=True)
    certificate_code = Column(String(64), nullable=False, unique=True, index=True)
    
    status = Column(String(50), nullable=False, default="PENDING", index=True)
    # PENDING, GENERATED, FAILED

    pdf_path = Column(String(512), nullable=True)
    preview_path = Column(String(512), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    generated_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="certificates")
