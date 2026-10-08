from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import Job
from backend.app.schemas import (
    JobCreateRequest,
    JobDetailResponse,
    JobStatusResponse,
)
from backend.app.services import build_job_zip, create_bulk_job, process_job_execution

router = APIRouter(prefix="/jobs", tags=["Jobs"])

def serialize_job_status(job: Job) -> dict:
    total = job.total_count or 0
    processed = job.processed_count or 0
    progress = round((processed / total * 100.0), 1) if total > 0 else 0.0

    return {
        "id": job.id,
        "title": job.title,
        "course_name": job.course_name,
        "issuer_organization": job.issuer_organization,
        "issue_date": job.issue_date,
        "instructor_name": job.instructor_name,
        "status": job.status,
        "total_count": total,
        "processed_count": processed,
        "success_count": job.success_count,
        "failure_count": job.failure_count,
        "progress_percentage": progress,
        "error_summary": job.error_summary,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "download_all_url": f"/api/v1/jobs/{job.id}/download-all" if job.success_count > 0 else None,
    }

def serialize_certificate_item(cert) -> dict:
    return {
        "id": cert.id,
        "recipient_name": cert.recipient_name,
        "recipient_email": cert.recipient_email,
        "certificate_code": cert.certificate_code,
        "status": cert.status,
        "file_size_bytes": cert.file_size_bytes,
        "error_message": cert.error_message,
        "created_at": cert.created_at,
        "generated_at": cert.generated_at,
        "download_url": f"/api/v1/certificates/{cert.id}/download" if cert.status == "GENERATED" else None,
        "preview_url": f"/api/v1/certificates/{cert.id}/preview" if cert.status == "GENERATED" else None,
    }

@router.post(
    "",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a bulk certificate generation job"
)
def create_job(
    job_in: JobCreateRequest,
    background_tasks: BackgroundTasks,
    run_async: bool = Query(True, description="Execute in background worker (True) or synchronously (False)"),
    db: Session = Depends(get_db)
):
    job = create_bulk_job(db, job_in)

    if run_async:
        background_tasks.add_task(process_job_execution, job.id)
    else:
        process_job_execution(job.id, db=db)
        db.refresh(job)

    return serialize_job_status(job)

@router.get(
    "",
    response_model=List[JobStatusResponse],
    summary="List all certificate generation jobs"
)
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Job)
    if status_filter:
        query = query.filter(Job.status == status_filter.upper())
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    return [serialize_job_status(j) for j in jobs]

@router.get(
    "/{job_id}",
    response_model=JobDetailResponse,
    summary="Retrieve job status and certificate generation results"
)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' not found"
        )
    data = serialize_job_status(job)
    data["certificates"] = [serialize_certificate_item(c) for c in job.certificates]
    return data

@router.get(
    "/{job_id}/download-all",
    summary="Download all successfully generated certificates as a ZIP archive"
)
def download_all_certificates(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' not found"
        )
    zip_buffer = build_job_zip(job, db)
    if not zip_buffer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No generated certificates available to download for this job"
        )

    clean_title = "".join(c for c in job.title if c.isalnum() or c in ("-", "_")).strip() or "certificates"
    filename = f"{clean_title}_batch.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a certificate generation job"
)
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    db.delete(job)
    db.commit()
    return None
