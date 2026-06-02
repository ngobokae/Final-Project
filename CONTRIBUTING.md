# Contributing

Thanks for contributing! This document explains how to get a local development copy running and the preferred workflow for submitting changes.

Prerequisites
- Node.js (16+), npm
- Python 3.10+ and pip
- Optional: Docker & Docker Compose

Local setup (quick)

1) Backend

```powershell
cd backend\backend
npm ci
cp .env.example .env
# Edit .env to match your local DB/keys
npm start
```

To seed sample data (if needed):

```powershell
node scripts/seed-data.js
```

2) Frontend

```powershell
cd frontend\frontend
npm ci
npm run dev
```

3) ML service (Django)

```powershell
cd ml-service\ml-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 8000
```

4) Docker (one-step)

```powershell
docker-compose up --build
```

Workflow
- Create a feature branch from `main`.
- Keep commits focused and small. Use descriptive commit messages.
- Open a PR against `main` and request review.

Coding style and tests
- Run linters and tests (if present) before submitting PRs.

Reporting issues
- Open GitHub issues with a clear repro, logs, and environment details.

Thanks — maintainers will review PRs in priority order.
