from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import APP_DESCRIPTION, APP_TITLE
from backend.app.database import init_db
from backend.app.routers import certificates, jobs

# Initialize relational database schemas
init_db()

app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(certificates.router, prefix="/api/v1")

@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "Bulk Certificate Generator",
        "engine": "FastAPI + ReportLab + SQLAlchemy"
    }

@app.get("/api", tags=["System"])
def api_info():
    return {
        "name": "Bulk Certificate Generator API",
        "endpoints": {
            "create_job": "POST /api/v1/jobs",
            "list_jobs": "GET /api/v1/jobs",
            "get_job_status": "GET /api/v1/jobs/{job_id}",
            "download_all_zip": "GET /api/v1/jobs/{job_id}/download-all",
            "download_certificate": "GET /api/v1/certificates/{cert_id}/download",
            "preview_certificate": "GET /api/v1/certificates/{cert_id}/preview",
            "verify_certificate": "GET /api/v1/certificates/verify/{certificate_code}",
            "interactive_docs": "/docs",
            "openapi_schema": "/openapi.json"
        }
    }
