import os
import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import CertificateRecord
from backend.app.schemas import (
    CertificateItemResponse,
    CertificateVerificationResponse,
)

router = APIRouter(prefix="/certificates", tags=["Certificates"])

@router.get(
    "/{cert_id}",
    response_model=CertificateItemResponse,
    summary="Get single certificate details"
)
def get_certificate_details(cert_id: str, db: Session = Depends(get_db)):
    cert = db.query(CertificateRecord).filter(CertificateRecord.id == cert_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Certificate '{cert_id}' not found"
        )
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

@router.get(
    "/{cert_id}/download",
    summary="Download certificate PDF document"
)
def download_certificate(cert_id: str, db: Session = Depends(get_db)):
    cert = db.query(CertificateRecord).filter(CertificateRecord.id == cert_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Certificate '{cert_id}' not found"
        )
    if cert.status != "GENERATED" or not cert.pdf_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Certificate '{cert_id}' has not been generated or generation failed"
        )
    if not os.path.exists(cert.pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate file does not exist on the filesystem"
        )

    safe_name = re.sub(r"[^\w\s-]", "", cert.recipient_name).strip()
    safe_name = re.sub(r"[-\s]+", "_", safe_name)
    download_filename = f"{safe_name}_{cert.certificate_code}.pdf"

    return FileResponse(
        path=cert.pdf_path,
        media_type="application/pdf",
        filename=download_filename
    )

@router.get(
    "/{cert_id}/preview",
    summary="Get high-resolution PNG preview of certificate"
)
def preview_certificate(cert_id: str, db: Session = Depends(get_db)):
    cert = db.query(CertificateRecord).filter(CertificateRecord.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    if cert.status != "GENERATED" or not cert.preview_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certificate preview is not available")
    if not os.path.exists(cert.preview_path):
        # Fallback to PDF if preview is missing
        if cert.pdf_path and os.path.exists(cert.pdf_path):
            return FileResponse(cert.pdf_path, media_type="application/pdf")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview file not found")

    return FileResponse(
        path=cert.preview_path,
        media_type="image/png"
    )

@router.get(
    "/verify/{certificate_code}",
    response_model=CertificateVerificationResponse,
    summary="Public certificate verification endpoint"
)
def verify_certificate(certificate_code: str, db: Session = Depends(get_db)):
    cert = db.query(CertificateRecord).filter(
        CertificateRecord.certificate_code == certificate_code
    ).first()

    if not cert or cert.status != "GENERATED":
        return {
            "is_valid": False,
            "certificate_code": certificate_code,
            "status": "UNVERIFIED",
            "verification_message": "Certificate record not found or revoked."
        }

    job = cert.job
    return {
        "is_valid": True,
        "certificate_code": cert.certificate_code,
        "recipient_name": cert.recipient_name,
        "course_name": job.course_name if job else "N/A",
        "issuer_organization": job.issuer_organization if job else "N/A",
        "issue_date": job.issue_date if job else "N/A",
        "status": "VALID",
        "verification_message": "This certificate is authentic and officially recognized.",
        "issued_at": cert.generated_at
    }
