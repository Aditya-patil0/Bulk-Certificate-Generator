# Production Deployment Guide

## 1. Environment Requirements
- Python 3.10+ (Python 3.11 recommended)
- Relational Database: SQLite (default) or PostgreSQL 14+
- Storage: Persistent volume mounted at `/app/storage`

---

## 2. Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///storage/database/certificates.db` | SQLAlchemy connection string (e.g. `postgresql://user:pass@localhost:5432/certdb`) |
| `STORAGE_DIR` | `./storage` | Directory where PDF certificates and previews are saved |
| `PORT` | `8000` | Port for the backend application |
| `WORKERS` | `4` | Number of Uvicorn worker processes |

---

## 3. Running with Docker

### Build the Image:
```bash
docker build -t bulk-certificate-generator:latest .
```

### Run Container:
```bash
docker run -d \
  --name cert-generator \
  -p 8000:8000 \
  -v $(pwd)/storage:/app/storage \
  bulk-certificate-generator:latest
```

---

## 4. Running with Docker Compose
```bash
docker-compose up -d
```
Docker compose starts the application service with volume mounting and auto-restart policy.

---

## 5. Direct Linux / Production Host Execution

```bash
# 1. Clone repository
git clone <repository_url>
cd bulk-certificate-generator

# 2. Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Run database initialization and server with Uvicorn
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 6. Health Checks & Monitoring
- Health endpoint: `GET /api/health` -> returns `{"status": "healthy"}`
- Interactive OpenAPI Docs: `GET /docs`
- Machine-readable schema: `GET /openapi.json`
