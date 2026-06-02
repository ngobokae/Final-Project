# Django ML Service

Django-based machine learning service for demand forecasting and inventory optimization.

## Features

- ✅ Demand forecasting
- ✅ Inventory optimization
- ✅ Trend analysis
- ✅ Seasonality detection
- ✅ Risk assessment

## How to run the ML service

### 1. Open a terminal and go to the ML service folder

```bash
cd ml-service
```

### 2. Create and activate a Python virtual environment

**Windows (PowerShell or CMD):**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. (Optional) Create .env

If you have a `.env.example` in this folder:
```bash
cp .env.example .env
```
Edit `.env` and set `JWT_SECRET` to match your backend if the backend sends JWT to the ML service.

### 5. Start the server

```bash
python manage.py runserver
```

By default the service runs at **http://localhost:8000**. Keep this terminal open.

---

## How to verify it works

### Quick check (health endpoint)

In a **new** terminal (or in the browser):

**Windows (PowerShell):**
```powershell
curl http://localhost:8000/api/health/
```

**Or in a browser:** open **http://localhost:8000/api/health/**

You should see JSON like:
```json
{
  "status": "ok",
  "service": "ml-service",
  "endpoints": {
    "forecast": "POST /api/forecast/",
    "optimize_inventory": "POST /api/optimize-inventory/"
  }
}
```

### Check forecast endpoint (optional)

- **GET** http://localhost:8000/api/forecast/ → expected: `405 Method Not Allowed` (only POST is allowed; that’s normal).
- **POST** is used by the backend when you run “Generate Forecast” or “Run Predict 2” from the app.

### From the app

1. Start **backend** (port 3001) and **frontend** (port 5173) as usual.
2. Ensure the **ML service** is running (port 8000) as above.
3. Go to **Operations → Demand Forecast (Predict 2 – Demand)**.
4. Select a product and click **Run Predict 2 (Demand)** (or **Generate Forecast**).
5. If the ML service is running and the backend can reach it, you should get forecasts; if not, you may see an error in the UI or backend logs.

---

## Setup (summary)

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # if the file exists
python manage.py runserver
```

## API Endpoints

- `GET /api/health/`: Check if the service is running (no auth).
- `POST /api/forecast/`: Generate demand forecasts.
- `POST /api/optimize-inventory/`: Calculate optimal inventory levels.

## ML Algorithms

- Linear regression for trend detection
- Moving averages for baseline forecasting
- Seasonality analysis
- Economic Order Quantity (EOQ)
- Risk assessment

## Development

```bash
python manage.py runserver  # Auto-reload enabled
```

## Requirements

See `requirements.txt` for all Python dependencies.
