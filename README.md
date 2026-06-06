# Kinglion Manufacturing System

Full-stack manufacturing operations platform: inventory, sales, demand forecasting (ML), procurement, and role-based dashboards for admin, operations, inventory, and executive users.

**Repository:** [github.com/ngobokae/Final-Project](https://github.com/ngobokae/Final-Project)

## Stack

| Layer | Tech | Path |
|-------|------|------|
| Frontend | React + Vite + Tailwind | `frontend/frontend` |
| Backend | Node.js (HTTP API) | `backend/backend` |
| ML service | Django + scikit-learn / Prophet / TensorFlow | `ml-service/ml-service` |
| Database | MySQL 8 | Docker or local |

## Run with Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```powershell
docker compose up --build
```

| Service | URL | Notes |
|---------|-----|--------|
| Frontend | http://localhost:5173 | Main UI |
| Backend API | http://localhost:3001 | REST + Socket.io |
| ML service | http://localhost:8000 | `/api/health/` to check |
| MySQL | `localhost:3307` | Host port **3307** (avoids conflict with local MySQL on 3306) |

**Default login** (from `Manaf1.sql` seed, after first DB init):



Other seed users: `operations@example.com`, `inventory@example.com`, `executive@example.com` (see SQL dump for password hashes).

If a container name conflict appears:

```powershell
docker rm -f manufacturing-backend manufacturing-frontend
docker compose up -d --build
```

## Run locally (without Docker for app code)

Start **MySQL** and **ML** via Docker, then run backend and frontend on the host:

```powershell
docker compose up -d mysql ml-service
```

**Backend**

```powershell
cd backend\backend
npm install
# .env: DB_HOST=localhost, port 3307, DB_PASSWORD=Jtesire74!, ML_SERVICE_URL=http://localhost:8000
npm start
```

**Frontend**

```powershell
cd frontend\frontend
npm install
npm run dev
```

**ML service** (if not using Docker for ML)

```powershell
cd ml-service\ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

## Operations: upload sales and predict

1. Sign in as **operations** or **admin**.
2. Go to **Operations → Sales Data (Predict 2 – Sales)** → **Upload Data**.
3. Upload CSV/Excel with columns such as `sku` or `product_name`, `sale_date` (or `date`), `quantity`, `unit_price`.
4. After rows import, your file appears under **Uploaded documents** — then **Run Predict 2 (Sales)** is shown.
5. Use **Fast baseline** for bulk runs (much faster than Ensemble). Results appear on the **Overview** tab (charts and **Forecasted 30D**).
6. **Demand Forecast** page uses stored forecasts for per-product demand planning.

## Project layout

```
Final-Project/
├── frontend/frontend/     # React app
├── backend/backend/       # Node API
├── ml-service/ml-service/ # Django ML API
├── Manaf1.sql             # DB seed (first MySQL init)
├── docker-compose.yml
└── CONTRIBUTING.md
```

## Environment

Copy and adjust secrets as needed:

- Backend: `backend/backend/.env` (see `.env.example` at repo root for reference)
- ML: optional `.env` in `ml-service/ml-service`

Docker Compose sets `DB_HOST=mysql`, `ML_SERVICE_URL=http://ml-service:8000`, and MySQL password `Jtesire74!` for containers.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Final year project — Kinglion Rwanda / manufacturing system coursework.
