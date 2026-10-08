# REST API Specification

Base URL: `/api/v1`

---

## 1. Job Management

### `POST /api/v1/jobs`
Submit a bulk certificate generation request.

#### Query Parameters:
- `run_async` (boolean, default: `true`): Whether to process via background task (`true`) or block synchronously (`false`).

#### Request Body:
```json
{
  "title": "Full-Stack Python & Angular Bootcamp 2026",
  "course_name": "Modern Software Engineering & Distributed Systems",
  "issuer_organization": "Global Technology Institute",
  "issue_date": "October 8, 2026",
  "instructor_name": "Prof. Marcus Vance",
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
}
```

#### Validation Rules:
- `title`, `course_name`, `issuer_organization`, `issue_date`: Required, non-empty, max 200 chars.
- `recipients`: Must contain at least 1 recipient.
- `recipients[].name`: Required, 2-120 chars, must contain valid alphanumeric characters.
- `recipients[].email`: Optional, must match standard RFC email pattern if provided.

#### Response (HTTP 202 Accepted):
```json
{
  "id": "c1f72e38-4e9b-4b48-8df0-109038d15a51",
  "title": "Full-Stack Python & Angular Bootcamp 2026",
  "course_name": "Modern Software Engineering & Distributed Systems",
  "issuer_organization": "Global Technology Institute",
  "issue_date": "October 8, 2026",
  "instructor_name": "Prof. Marcus Vance",
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

### `GET /api/v1/jobs`
List all certificate generation jobs.

#### Query Parameters:
- `skip` (integer, default: 0): Pagination offset.
- `limit` (integer, default: 50, max: 100): Page size.
- `status` (string, optional): Filter by `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIALLY_FAILED`, `FAILED`.

#### Response (HTTP 200 OK):
Array of `JobStatusResponse` objects.

---

### `GET /api/v1/jobs/{job_id}`
Retrieve detailed job status, progress counters, and recipient-level generation results.

#### Response (HTTP 200 OK):
```json
{
  "id": "c1f72e38-4e9b-4b48-8df0-109038d15a51",
  "title": "Full-Stack Python & Angular Bootcamp 2026",
  "course_name": "Modern Software Engineering & Distributed Systems",
  "issuer_organization": "Global Technology Institute",
  "issue_date": "October 8, 2026",
  "instructor_name": "Prof. Marcus Vance",
  "status": "COMPLETED",
  "total_count": 2,
  "processed_count": 2,
  "success_count": 2,
  "failure_count": 0,
  "progress_percentage": 100.0,
  "error_summary": null,
  "created_at": "2026-10-08T07:45:00.000Z",
  "completed_at": "2026-10-08T07:45:02.120Z",
  "download_all_url": "/api/v1/jobs/c1f72e38-4e9b-4b48-8df0-109038d15a51/download-all",
  "certificates": [
    {
      "id": "673f443b-31d7-4c07-94d0-f20387b32876",
      "recipient_name": "Alex Mercer",
      "recipient_email": "alex.mercer@example.com",
      "certificate_code": "CERT-2026-A1B2C3D4",
      "status": "GENERATED",
      "file_size_bytes": 14205,
      "error_message": null,
      "created_at": "2026-10-08T07:45:00.000Z",
      "generated_at": "2026-10-08T07:45:01.050Z",
      "download_url": "/api/v1/certificates/673f443b-31d7-4c07-94d0-f20387b32876/download",
      "preview_url": "/api/v1/certificates/673f443b-31d7-4c07-94d0-f20387b32876/preview"
    }
  ]
}
```

---

### `GET /api/v1/jobs/{job_id}/download-all`
Download all successfully generated certificates for a job packaged as a `.zip` archive.

#### Response (HTTP 200 OK):
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="{job_title}_batch.zip"`

---

## 2. Certificate Retrieval & Verification

### `GET /api/v1/certificates/{cert_id}`
Retrieve metadata of a single certificate record.

---

### `GET /api/v1/certificates/{cert_id}/download`
Download the generated vector PDF certificate.

#### Response (HTTP 200 OK):
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="{recipient_name}_{certificate_code}.pdf"`

---

### `GET /api/v1/certificates/{cert_id}/preview`
Retrieve high-resolution PNG image preview of the certificate.

#### Response (HTTP 200 OK):
- `Content-Type: image/png`

---

### `GET /api/v1/certificates/verify/{certificate_code}`
Public verification endpoint. Checks if the given certificate ID is authentic.

#### Response (HTTP 200 OK):
```json
{
  "is_valid": true,
  "certificate_code": "CERT-2026-A1B2C3D4",
  "recipient_name": "Alex Mercer",
  "course_name": "Modern Software Engineering & Distributed Systems",
  "issuer_organization": "Global Technology Institute",
  "issue_date": "October 8, 2026",
  "status": "VALID",
  "verification_message": "This certificate is authentic and officially recognized.",
  "issued_at": "2026-10-08T07:45:01.050Z"
}
```
