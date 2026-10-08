import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

class RecipientInput(BaseModel):
    name: str = Field(..., description="Recipient full name")
    email: Optional[str] = Field(None, description="Recipient email address")
    grade: Optional[str] = Field(None, description="Optional score, honors, or grade distinction")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if len(trimmed) < 2:
            raise ValueError("Recipient name must be at least 2 characters")
        if len(trimmed) > 120:
            raise ValueError("Recipient name must not exceed 120 characters")
        # Must contain at least one alphanumeric character
        if not re.search(r"[a-zA-Z0-9]", trimmed):
            raise ValueError("Recipient name must contain letters or numbers")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            return None
        if not re.match(EMAIL_REGEX, trimmed):
            raise ValueError(f"Invalid email format: '{trimmed}'")
        return trimmed

class JobCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, description="Job title or campaign name")
    course_name: str = Field(..., min_length=2, max_length=200, description="Course or event name printed on certificate")
    issuer_organization: str = Field(..., min_length=2, max_length=200, description="Organization issuing the certificate")
    issue_date: str = Field(..., min_length=4, max_length=50, description="Date formatted for certificate display, e.g. 'October 8, 2026'")
    instructor_name: Optional[str] = Field(None, max_length=120, description="Signatory or instructor name")
    recipients: List[RecipientInput] = Field(..., min_length=1, description="List of recipients to generate certificates for")

    @field_validator("title", "course_name", "issuer_organization", "issue_date")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not trimmed:
            raise ValueError("Field cannot be empty or blank")
        return trimmed

class CertificateItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipient_name: str
    recipient_email: Optional[str]
    certificate_code: str
    status: str
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    generated_at: Optional[datetime] = None
    download_url: Optional[str] = None
    preview_url: Optional[str] = None

class JobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    course_name: str
    issuer_organization: str
    issue_date: str
    instructor_name: Optional[str]
    status: str
    total_count: int
    processed_count: int
    success_count: int
    failure_count: int
    progress_percentage: float
    error_summary: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    download_all_url: Optional[str] = None

class JobDetailResponse(JobStatusResponse):
    certificates: List[CertificateItemResponse] = []

class CertificateVerificationResponse(BaseModel):
    is_valid: bool
    certificate_code: str
    recipient_name: Optional[str] = None
    course_name: Optional[str] = None
    issuer_organization: Optional[str] = None
    issue_date: Optional[str] = None
    status: str
    verification_message: str
    issued_at: Optional[datetime] = None
