# Architecture & System Design

## 1. System Overview

The **Bulk Certificate Generator** is a high-throughput, resilient backend application engineered to generate verifiable completion certificates for cohorts of participants in events, corporate trainings, and educational courses.

The system is built on **Python 3.11**, **FastAPI**, **SQLAlchemy ORM**, **ReportLab**, and **SQLite / PostgreSQL**.

```
+---------------------------------------------------------------------------------+
|                                 Client Applications                            |
|                 (REST API Clients, CLI Scripts, Web Portal)                     |
+---------------------------------------+-----------------------------------------+
                                        | HTTP / JSON
                                        v
+---------------------------------------------------------------------------------+
|                                  FastAPI Gateway                                |
|  - Input Validation & Schema Enforcement (Pydantic V2)                          |
|  - CORS & Security Middleware                                                   |
|  - Swagger & ReDoc Documentation Generation                                     |
+-------------------+-----------------------------------------+-------------------+
                    |                                         |
                    v                                         v
+------------------------------------+   +----------------------------------------+
|      Job Orchestration Router      |   |       Certificate Service Router       |
|  - POST /api/v1/jobs               |   |  - GET /api/v1/certificates/{id}       |
|  - GET  /api/v1/jobs               |   |  - GET /api/v1/certificates/{id}/down..|
|  - GET  /api/v1/jobs/{id}          |   |  - GET /api/v1/certificates/{id}/prev..|
|  - GET  /api/v1/jobs/{id}/down..   |   |  - GET /api/v1/certificates/verify/{c} |
+-------------------+----------------+   +--------------------+-------------------+
                    |                                         |
                    v                                         v
+------------------------------------+   +----------------------------------------+
|   Background Execution Pipeline    |   |         Vector Rendering Engine        |
|  - Per-recipient error isolation   |   |  - ReportLab PDF Canvas (Landscape A4) |
|  - Atomic status updates           |   |  - PIL High-Resolution PNG Previews    |
|  - ZIP Archive compilation         |   |  - Cryptographic / Unique ID stamping  |
+-------------------+----------------+   +--------------------+-------------------+
                    |                                         |
                    +--------------------+--------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                       Relational Persistence Layer                              |
|  - Jobs Table (Lifecycle status, counters, aggregates)                          |
|  - Certificates Table (Per-recipient state, file paths, failure reasons)       |
+---------------------------------------------------------------------------------+
```

---

## 2. Core Design Principles

### 2.1 Bulk Processing & Background Execution Strategy
Bulk operations can range from 10 to thousands of certificates. Generating a vector PDF with ornate borders, typography, vector seals, and cryptographic IDs requires CPU cycles.

**Design Decision**:
- Requests can run **Asynchronously** (`run_async=true`, default) or **Synchronously** (`run_async=false`).
- For asynchronous requests, the API immediately creates the job record and associated certificate placeholders in state `PENDING`, dispatches execution via FastAPI's `BackgroundTasks` (or distributed queue like Celery in scaled deployments), and returns HTTP `202 Accepted` with the job ID and polling URL.
- Clients poll `GET /api/v1/jobs/{job_id}` to track real-time progress (`processed_count`, `success_count`, `failure_count`, `progress_percentage`).

### 2.2 Fault Isolation & Partial Failure Resilience
A primary requirement is that **an error generating one certificate must never fail the entire batch**.

**Implementation**:
- The generation loop wraps each recipient in an isolated `try/except` block.
- If recipient data has format issues or unexpected exceptions during rendering:
  1. The specific `CertificateRecord` status is updated to `FAILED`.
  2. The exact exception reason is saved to `error_message`.
  3. The parent job's `failure_count` and `processed_count` increment.
  4. The database transaction commits immediately for that record.
  5. The generator seamlessly proceeds to the next recipient.
- Job-level status mapping:
  - `COMPLETED`: All certificates generated successfully (`failure_count == 0`).
  - `PARTIALLY_FAILED`: Some succeeded, some failed (`success_count > 0 and failure_count > 0`).
  - `FAILED`: Every recipient failed (`success_count == 0`).

---

## 3. Relational Data Model

### `jobs` Table
| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID v4 unique identifier |
| `title` | VARCHAR(255) | Name of campaign or batch |
| `course_name` | VARCHAR(255) | Course or event title printed on certificate |
| `issuer_organization` | VARCHAR(255) | Issuing institution |
| `issue_date` | VARCHAR(50) | Formatted date displayed on certificate |
| `instructor_name` | VARCHAR(255) | Signatory name (optional) |
| `status` | VARCHAR(50) | `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIALLY_FAILED`, `FAILED` |
| `total_count` | INTEGER | Total recipients in request |
| `processed_count` | INTEGER | Number of recipients attempted |
| `success_count` | INTEGER | Number of certificates successfully generated |
| `failure_count` | INTEGER | Number of certificates that failed |
| `error_summary` | TEXT | Summary description if failures occurred |
| `created_at` | DATETIME | Timestamp job was created |
| `completed_at` | DATETIME | Timestamp job reached terminal state |

### `certificates` Table
| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID v4 unique identifier |
| `job_id` | VARCHAR(36) FK | Foreign key reference to `jobs.id` |
| `recipient_name` | VARCHAR(255) | Full name of recipient |
| `recipient_email` | VARCHAR(255) | Optional email address |
| `certificate_code` | VARCHAR(64) UNIQUE | Human-readable verification ID (e.g. `CERT-2026-F9A1B2C3`) |
| `status` | VARCHAR(50) | `PENDING`, `GENERATED`, `FAILED` |
| `pdf_path` | VARCHAR(512) | Absolute filesystem path to generated vector PDF |
| `preview_path` | VARCHAR(512) | Absolute filesystem path to generated PNG preview |
| `file_size_bytes` | INTEGER | PDF file size in bytes |
| `error_message` | TEXT | Detailed failure reason if generation failed |
| `created_at` | DATETIME | Creation timestamp |
| `generated_at` | DATETIME | Timestamp generation finished |

---

## 4. Vector PDF Generation Engine

The certificate layout uses ReportLab vector primitives:
1. **Geometry**: Landscape A4 (841.89 x 595.27 points).
2. **Frames & Margins**: Deep Navy outer border (`#0A192F`), metallic Gold inset border (`#C59B27`), hairline inner guide.
3. **Corner Accents**: Geometric corner ornaments rendered mathematically.
4. **Official Seal**: 32-tooth circular starburst emblem in vector paths with contrast typography.
5. **Typography**: Classic serif titles paired with modern sans-serif verification footers.
6. **Unique ID & Verification**: Every certificate embeds a unique code `CERT-{YEAR}-{UUID_HASH}` queryable via `/api/v1/certificates/verify/{code}`.
