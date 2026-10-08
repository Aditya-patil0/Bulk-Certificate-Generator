import io
import re
import uuid
import zipfile
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.generator import generate_certificate
from backend.app.models import CertificateRecord, Job
from backend.app.schemas import JobCreateRequest

def generate_cert_code() -> str:
    year = datetime.utcnow().year
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"CERT-{year}-{unique_suffix}"

def create_bulk_job(db: Session, job_data: JobCreateRequest) -> Job:
    job = Job(
        title=job_data.title,
        course_name=job_data.course_name,
        issuer_organization=job_data.issuer_organization,
        issue_date=job_data.issue_date,
        instructor_name=job_data.instructor_name,
        status="PENDING",
        total_count=len(job_data.recipients),
        processed_count=0,
        success_count=0,
        failure_count=0
    )
    db.add(job)
    db.flush()

    for recipient in job_data.recipients:
        cert_record = CertificateRecord(
            job_id=job.id,
            recipient_name=recipient.name,
            recipient_email=recipient.email,
            certificate_code=generate_cert_code(),
            status="PENDING"
        )
        db.add(cert_record)

    db.commit()
    db.refresh(job)
    return job

def process_job_execution(job_id: str, db: Optional[Session] = None) -> None:
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = "PROCESSING"
        db.commit()

        certificates = db.query(CertificateRecord).filter(CertificateRecord.job_id == job_id).all()

        for cert in certificates:
            try:
                raw_name = cert.recipient_name or ""
                cleaned_name = raw_name.strip()
                
                if len(cleaned_name) < 2:
                    raise ValueError("Recipient name must have at least 2 characters")
                if not re.search(r"[a-zA-Z0-9]", cleaned_name):
                    raise ValueError("Recipient name must contain letters or numbers")

                if cert.recipient_email:
                    email_str = cert.recipient_email.strip()
                    if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email_str):
                        raise ValueError(f"Invalid email address provided: {email_str}")

                if "__SIMULATE_FAILURE__" in cleaned_name:
                    raise RuntimeError("Simulated certificate rendering failure for resilience test")

                pdf_path, preview_path, file_size = generate_certificate(
                    recipient_name=cleaned_name,
                    course_name=job.course_name,
                    issuer_organization=job.issuer_organization,
                    issue_date=job.issue_date,
                    certificate_code=cert.certificate_code,
                    instructor_name=job.instructor_name
                )

                cert.pdf_path = str(pdf_path)
                cert.preview_path = str(preview_path)
                cert.file_size_bytes = file_size
                cert.status = "GENERATED"
                cert.generated_at = datetime.utcnow()
                cert.error_message = None

                job.success_count += 1

            except Exception as e:
                cert.status = "FAILED"
                cert.error_message = str(e)
                job.failure_count += 1

            finally:
                job.processed_count += 1
                db.commit()

        # Final job status determination
        if job.failure_count == 0:
            job.status = "COMPLETED"
        elif job.success_count > 0:
            job.status = "PARTIALLY_FAILED"
            job.error_summary = f"{job.failure_count} of {job.total_count} certificates failed generation."
        else:
            job.status = "FAILED"
            job.error_summary = f"All {job.total_count} certificates failed generation."

        job.completed_at = datetime.utcnow()
        db.commit()

    finally:
        if close_db:
            db.close()

def build_job_zip(job: Job, db: Session) -> Optional[io.BytesIO]:
    successful_certs = db.query(CertificateRecord).filter(
        CertificateRecord.job_id == job.id,
        CertificateRecord.status == "GENERATED"
    ).all()

    if not successful_certs:
        return None

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for cert in successful_certs:
            if cert.pdf_path:
                try:
                    with open(cert.pdf_path, "rb") as f:
                        safe_name = re.sub(r"[^\w\s-]", "", cert.recipient_name).strip()
                        safe_name = re.sub(r"[-\s]+", "_", safe_name)
                        filename = f"{safe_name}_{cert.certificate_code}.pdf"
                        zf.writestr(filename, f.read())
                except Exception:
                    continue

    zip_buffer.seek(0)
    return zip_buffer
