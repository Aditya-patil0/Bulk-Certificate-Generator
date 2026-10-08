import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
CERTIFICATES_DIR = STORAGE_DIR / "certificates"
DATABASE_DIR = STORAGE_DIR / "database"

# Ensure directories exist
CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_DIR / 'certificates.db'}")
APP_TITLE = "Bulk Certificate Generator API"
APP_DESCRIPTION = "High-throughput asynchronous bulk certificate generation API with persistent relational tracking."
API_VERSION = "v1"
