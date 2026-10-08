import io
import time
import zipfile
import pytest

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_create_generation_job_synchronous(client):
    payload = {
        "title": "Data Engineering Bootcamp 2026",
        "course_name": "Distributed Data Pipelines with Apache Spark",
        "issuer_organization": "Global Tech Academy",
        "issue_date": "October 8, 2026",
        "instructor_name": "Dr. Sarah Mitchell",
        "recipients": [
            {"name": "Alice Johnson", "email": "alice@example.com"},
            {"name": "Bob Smith", "email": "bob@example.com"}
        ]
    }
    response = client.post("/api/v1/jobs?run_async=false", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "id" in data
    assert data["title"] == payload["title"]
    assert data["total_count"] == 2
    assert data["processed_count"] == 2
    assert data["success_count"] == 2
    assert data["failure_count"] == 0
    assert data["status"] == "COMPLETED"
    assert data["progress_percentage"] == 100.0

def test_create_generation_job_asynchronous(client):
    payload = {
        "title": "Cloud Computing Essentials",
        "course_name": "Kubernetes and Container Orchestration",
        "issuer_organization": "Cloud Native Foundation",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "Diana Prince", "email": "diana@example.com"},
            {"name": "Bruce Wayne", "email": "bruce@example.com"}
        ]
    }
    response = client.post("/api/v1/jobs?run_async=true", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "id" in data
    assert data["total_count"] == 2
    job_id = data["id"]

    # In FastAPI test client, background tasks execute before response returns or right after
    get_res = client.get(f"/api/v1/jobs/{job_id}")
    assert get_res.status_code == 200
    job_data = get_res.json()
    assert job_data["id"] == job_id

def test_input_validation_empty_recipients(client):
    payload = {
        "title": "Empty Batch Job",
        "course_name": "Test Course",
        "issuer_organization": "Test Org",
        "issue_date": "October 8, 2026",
        "recipients": []
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 422  # Pydantic validation error

def test_input_validation_invalid_recipient_name(client):
    payload = {
        "title": "Invalid Name Batch",
        "course_name": "Test Course",
        "issuer_organization": "Test Org",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "A"}  # Less than 2 chars
        ]
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 422

def test_input_validation_invalid_email_format(client):
    payload = {
        "title": "Invalid Email Batch",
        "course_name": "Test Course",
        "issuer_organization": "Test Org",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "Valid Name", "email": "not-an-email"}
        ]
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 422

def test_job_status_and_recipient_details(client):
    payload = {
        "title": "Web Architecture Series",
        "course_name": "Microservices in Go & Python",
        "issuer_organization": "Apex Software Institute",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "Carol Danvers", "email": "carol@example.com"}
        ]
    }
    create_res = client.post("/api/v1/jobs?run_async=false", json=payload)
    assert create_res.status_code == 202
    job_id = create_res.json()["id"]

    # Retrieve job details
    get_res = client.get(f"/api/v1/jobs/{job_id}")
    assert get_res.status_code == 200
    job_data = get_res.json()
    assert job_data["id"] == job_id
    assert job_data["status"] == "COMPLETED"
    assert len(job_data["certificates"]) == 1

    cert = job_data["certificates"][0]
    assert cert["recipient_name"] == "Carol Danvers"
    assert cert["status"] == "GENERATED"
    assert cert["certificate_code"].startswith("CERT-")
    assert cert["download_url"] is not None
    assert cert["file_size_bytes"] > 0

def test_individual_certificate_failure_handling(client):
    """
    CRITICAL REQUIREMENT:
    A failure while generating one certificate should not prevent
    other valid certificates in the same job from being generated.
    """
    payload = {
        "title": "Mixed Resilience Batch",
        "course_name": "Resilient Systems Engineering",
        "issuer_organization": "Cloud Resilience Labs",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "Elena Rostova", "email": "elena@example.com"},
            {"name": "Simulated Failure __SIMULATE_FAILURE__", "email": "fail@example.com"},
            {"name": "David Miller", "email": "david@example.com"}
        ]
    }
    create_res = client.post("/api/v1/jobs?run_async=false", json=payload)
    assert create_res.status_code == 202
    job_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/jobs/{job_id}")
    assert get_res.status_code == 200
    job_data = get_res.json()

    # Job level statistics
    assert job_data["status"] == "PARTIALLY_FAILED"
    assert job_data["total_count"] == 3
    assert job_data["processed_count"] == 3
    assert job_data["success_count"] == 2
    assert job_data["failure_count"] == 1
    assert "failed" in job_data["error_summary"].lower()

    # Verify per-certificate status
    certs = job_data["certificates"]
    assert len(certs) == 3

    # First recipient succeeded
    assert certs[0]["recipient_name"] == "Elena Rostova"
    assert certs[0]["status"] == "GENERATED"
    assert certs[0]["download_url"] is not None

    # Second recipient failed with clear error message
    assert certs[1]["status"] == "FAILED"
    assert "Simulated certificate rendering failure" in certs[1]["error_message"]
    assert certs[1]["download_url"] is None

    # Third recipient succeeded despite the second one failing
    assert certs[2]["recipient_name"] == "David Miller"
    assert certs[2]["status"] == "GENERATED"
    assert certs[2]["download_url"] is not None

def test_retrieve_and_download_certificate(client):
    payload = {
        "title": "Download Test Batch",
        "course_name": "Cybersecurity Fundamentals",
        "issuer_organization": "Defense Academy",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "Fiona Gallagher", "email": "fiona@example.com"}
        ]
    }
    res = client.post("/api/v1/jobs?run_async=false", json=payload)
    job_id = res.json()["id"]

    job_detail = client.get(f"/api/v1/jobs/{job_id}").json()
    cert_id = job_detail["certificates"][0]["id"]
    cert_code = job_detail["certificates"][0]["certificate_code"]

    # 1. Test Single Certificate Metadata Retrieval
    cert_res = client.get(f"/api/v1/certificates/{cert_id}")
    assert cert_res.status_code == 200
    assert cert_res.json()["certificate_code"] == cert_code

    # 2. Test PDF Download
    download_res = client.get(f"/api/v1/certificates/{cert_id}/download")
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "application/pdf"
    assert "attachment" in download_res.headers["content-disposition"]
    assert download_res.content[:5] == b"%PDF-"

    # 3. Test PNG Preview
    preview_res = client.get(f"/api/v1/certificates/{cert_id}/preview")
    assert preview_res.status_code == 200
    assert "image/png" in preview_res.headers["content-type"]

    # 4. Test Verification Endpoint
    verify_res = client.get(f"/api/v1/certificates/verify/{cert_code}")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_valid"] is True
    assert verify_data["recipient_name"] == "Fiona Gallagher"
    assert verify_data["course_name"] == "Cybersecurity Fundamentals"

def test_bulk_zip_download(client):
    payload = {
        "title": "Bulk Archive Test",
        "course_name": "Deep Learning Specialization",
        "issuer_organization": "Neural Network Institute",
        "issue_date": "October 8, 2026",
        "recipients": [
            {"name": "George Washington", "email": "george@example.com"},
            {"name": "Hannah Abbott", "email": "hannah@example.com"}
        ]
    }
    res = client.post("/api/v1/jobs?run_async=false", json=payload)
    job_id = res.json()["id"]

    zip_res = client.get(f"/api/v1/jobs/{job_id}/download-all")
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"

    zip_buffer = io.BytesIO(zip_res.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        file_list = zf.namelist()
        assert len(file_list) == 2
        for fname in file_list:
            assert fname.endswith(".pdf")

def test_list_jobs_and_deletion(client):
    # Create two jobs
    payload1 = {
        "title": "Job One",
        "course_name": "Course 1",
        "issuer_organization": "Org 1",
        "issue_date": "October 8, 2026",
        "recipients": [{"name": "User One"}]
    }
    payload2 = {
        "title": "Job Two",
        "course_name": "Course 2",
        "issuer_organization": "Org 2",
        "issue_date": "October 8, 2026",
        "recipients": [{"name": "User Two"}]
    }
    r1 = client.post("/api/v1/jobs?run_async=false", json=payload1)
    r2 = client.post("/api/v1/jobs?run_async=false", json=payload2)
    j1_id = r1.json()["id"]
    j2_id = r2.json()["id"]

    # List jobs
    list_res = client.get("/api/v1/jobs?limit=10")
    assert list_res.status_code == 200
    jobs = list_res.json()
    assert len(jobs) >= 2

    # Delete j1
    del_res = client.delete(f"/api/v1/jobs/{j1_id}")
    assert del_res.status_code == 204

    # Verify j1 is gone
    get_res = client.get(f"/api/v1/jobs/{j1_id}")
    assert get_res.status_code == 404

def test_nonexistent_job_and_certificate(client):
    res = client.get("/api/v1/jobs/non-existent-uuid-12345")
    assert res.status_code == 404

    cert_res = client.get("/api/v1/certificates/non-existent-uuid-12345")
    assert cert_res.status_code == 404

    verify_res = client.get("/api/v1/certificates/verify/FAKE-CODE-9999")
    assert verify_res.status_code == 200
    assert verify_res.json()["is_valid"] is False
