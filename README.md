# Bulk Certificate Generator

A high-performance backend API engineered to accept bulk certificate generation requests for cohorts of participants, generate verifiable completion certificates using an ornate vector template, track generation status, and retrieve individual certificates or archived batches.

---

## Key Features

- **Bulk Request Processing**: Ingest hundreds of recipients in a single API call with transactional job creation.
- **Asynchronous & Synchronous Execution**: Default background processing with real-time progress tracking, plus synchronous execution option for deterministic workflows.
- **Resilient Fault Isolation**: A failure while generating one certificate does not interrupt other valid certificates in the same batch.
- **Relational Data Persistence**: SQLite (default) and PostgreSQL compatible via SQLAlchemy ORM with full relational auditing (`Job` and `CertificateRecord` entities).
- **Vector PDF & High-Res Previews**: Pixel-perfect vector PDF generation using ReportLab with double borders, corner embellishments, official seals, and companion PNG previews.
- **Unique Verification Identity**: Every certificate embeds a unique verification code (`CERT-{YEAR}-{HASH}`) with an authenticity verification endpoint.
- **Bulk Retrieval**: Single-certificate PDF download and full-batch `.zip` archive streaming.
- **Comprehensive Test Suite**: Automated tests with Pytest covering jobs, validation, rendering, partial failures, downloads, and edge cases.

---

## Tech Stack

- **Language**: Python 3.11
- **Web Framework**: FastAPI
- **Database ORM**: SQLAlchemy 2.0 (SQLite / PostgreSQL)
- **Data Validation**: Pydantic V2
- **Document Generation**: ReportLab (Vector PDF) & Pillow (Image Rendering)
- **Testing**: Pytest & HTTPX
- **Server**: Uvicorn ASGI

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py             # Storage paths and environment settings
│   │   ├── database.py           # Engine and session factory
│   │   ├── generator.py          # Vector PDF and PNG rendering engine
│   │   ├── main.py               # FastAPI entrypoint, middleware, and routes
│   │   ├── models.py             # SQLAlchemy models (Job, CertificateRecord)
│   │   ├── schemas.py            # Pydantic V2 schemas and input validators
│   │   ├── services.py           # Core business logic and bulk orchestration
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── certificates.py   # Certificate download, preview, and verification
│   │       └── jobs.py           # Job submission, status, and ZIP packaging
├── docs/
│   ├── API_SPECIFICATION.md      # Detailed REST endpoint documentation
│   ├── ARCHITECTURE.md           # System architecture and design decisions
│   └── DEPLOYMENT.md             # Docker and production deployment instructions
├── tests/
│   ├── conftest.py               # In-memory database fixtures and TestClient
│   └── test_jobs_api.py          # 12 automated test cases
├── storage/                      # Generated PDFs, previews, and SQLite database
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Multi-container orchestration
├── pytest.ini                    # Pytest configuration
├── requirements.txt              # Production and testing dependencies
└── README.md                     # Project manual
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- `pip` package manager

### 1. Installation
Clone the repository and set up a virtual environment:

```bash
git clone <repository_url>
cd bulk-certificate-generator

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Running the Application
Start the FastAPI server:

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Once running:
- **API Base URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

---

## Running the Test Suite

Run the automated test suite with verbose output:

```bash
pytest -v
```

The test suite validates:
1. `test_health_check`: Health check endpoint response.
2. `test_create_generation_job_synchronous`: Direct end-to-end generation.
3. `test_create_generation_job_asynchronous`: Background task execution.
4. `test_input_validation_empty_recipients`: Rejection of empty recipient lists.
5. `test_input_validation_invalid_recipient_name`: Enforcement of recipient name length and character constraints.
6. `test_input_validation_invalid_email_format`: Rejection of malformed recipient email addresses.
7. `test_job_status_and_recipient_details`: Polling and metadata validation.
8. `test_individual_certificate_failure_handling`: Verification that an individual certificate failure does not stop subsequent certificates in the batch.
9. `test_retrieve_and_download_certificate`: PDF file download, PNG preview stream, and verification.
10. `test_bulk_zip_download`: Zip archive creation and integrity verification.
11. `test_list_jobs_and_deletion`: Job pagination, listing, and cascading deletion.
12. `test_nonexistent_job_and_certificate`: Proper 404 and unverified response handling.

---

## API Usage Guide

### 1. Submit a Bulk Generation Job

```bash
curl -X POST "http://localhost:8000/api/v1/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Machine Learning Masterclass 2026",
    "course_name": "Applied Deep Learning & Neural Networks",
    "issuer_organization": "National Data Science Institute",
    "issue_date": "October 8, 2026",
    "instructor_name": "Dr. Sarah Mitchell",
    "recipients": [
      {
        "name": "Alex Mercer",
        "email": "alex.mercer@example.com",
        "grade": "Distinction"
      },
      {
        "name": "Beatriz Ramos",
        "email": "b.ramos@example.com"
      }
    ]
  }'
```

**Response (HTTP 202 Accepted):**
```json
{
  "id": "c1f72e38-4e9b-4b48-8df0-109038d15a51",
  "title": "Machine Learning Masterclass 2026",
  "course_name": "Applied Deep Learning & Neural Networks",
  "issuer_organization": "National Data Science Institute",
  "issue_date": "October 8, 2026",
  "instructor_name": "Dr. Sarah Mitchell",
  "status": "PENDING",
  "total_count": 2,
  "processed_count": 0,
  "success_count": 0,
  "failure_count": 0,
  "progress_percentage": 0.0,
  "error_summary": null,
  "created_at": "2026-10-08T07:45:00.000Z",
  "completed_at": null,
  "download_all_url": null
}
```

---

### 2. Check Job Progress & Results

```bash
curl "http://localhost:8000/api/v1/jobs/c1f72e38-4e9b-4b48-8df0-109038d15a51"
```

**Response when completed:**
```json
{
  "id": "c1f72e38-4e9b-4b48-8df0-109038d15a51",
  "status": "COMPLETED",
  "total_count": 2,
  "processed_count": 2,
  "success_count": 2,
  "failure_count": 0,
  "progress_percentage": 100.0,
  "download_all_url": "/api/v1/jobs/c1f72e38-4e9b-4b48-8df0-109038d15a51/download-all",
  "certificates": [
    {
      "id": "673f443b-31d7-4c07-94d0-f20387b32876",
      "recipient_name": "Alex Mercer",
      "certificate_code": "CERT-2026-A1B2C3D4",
      "status": "GENERATED",
      "file_size_bytes": 14205,
      "download_url": "/api/v1/certificates/673f443b-31d7-4c07-94d0-f20387b32876/download",
      "preview_url": "/api/v1/certificates/673f443b-31d7-4c07-94d0-f20387b32876/preview"
    }
  ]
}
```

---

### 3. Retrieve Individual Certificate PDF

```bash
curl -O -J "http://localhost:8000/api/v1/certificates/673f443b-31d7-4c07-94d0-f20387b32876/download"
```

---

### 4. Download All Certificates as a ZIP Archive

```bash
curl -O -J "http://localhost:8000/api/v1/jobs/c1f72e38-4e9b-4b48-8df0-109038d15a51/download-all"
```

---

### 5. Verify Certificate Authenticity

```bash
curl "http://localhost:8000/api/v1/certificates/verify/CERT-2026-A1B2C3D4"
```

---

## Design Decisions & Trade-Offs

1. **Framework (FastAPI)**:
   - Automatic OpenAPI/Swagger generation simplifies integration for frontend clients and third-party consumers.
   - Pydantic V2 provides strict request validation and runtime data normalization.
   - Built-in asynchronous background task handling removes heavy message broker dependencies for single-instance deployments while allowing trivial extension to Celery or Redis Queue for enterprise clusters.

2. **Database & Relational Model (SQLAlchemy ORM)**:
   - Relational modeling cleanly represents the 1-to-many relationship between `Job` (aggregate batch tracking, progress percentage) and `CertificateRecord` (individual status, error isolation, file locations).
   - Compatible with SQLite for zero-configuration local execution and PostgreSQL for cloud deployments.

3. **Per-Recipient Fault Isolation**:
   - In bulk jobs, failing the entire cohort due to a single invalid record damages user experience.
   - Each recipient is isolated in an individual transactional block. Valid certificates are produced and stored; faulty records receive clear error descriptions and mark the job as `PARTIALLY_FAILED`.

4. **Vector PDF Generation (ReportLab)**:
   - ReportLab produces sharp, compact, scalable PDF documents with vector geometric borders and seals rather than heavy rasterized files.
   - Companion PNG previews generated via Pillow enable fast web previews without client-side PDF rendering overhead.
