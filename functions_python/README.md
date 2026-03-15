# BDB-FONDOS: Python Cloud Functions

Quantitative engine and API endpoints for portfolio optimization.

## 🛠️ Setup & Development

1. **Prerequisites**:
   - Python 3.11+
   - Firebase CLI

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**:
   Create a `.env` file with the following keys:
   - `EODHD_API_KEY`: Required for historical price data.
   - `GEMINI_API_KEY`: Required for AI analysis modules.

## 🏗️ Architecture

- `api/`: Cloud Function entry points (`endpoints_portfolio.py`).
- `services/`: Core business logic.
  - `portfolio/`: Optimization engines (Markowitz, Black-Litterman).
  - `config.py`: **Source of truth for risk profiles and bucket constraints.**
- `models/`: Data structures/schemas.

## 🧪 Testing
Run tests using pytest:
```bash
pytest tests/
```

## 🚀 Deployment
Deploy functions to the `europe-west1` region (standard for this project):
```bash
firebase deploy --only functions
```
