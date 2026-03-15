# BDB-FONDOS: Portfolio Optimizer & Reporting

BDB-FONDOS is a specialized platform for financial portfolio analysis, optimization, and reporting. It leverages Firebase for data and computation, with a React frontend and Python-based cloud functions for quantitative analysis.

## Repository Structure

- `/frontend`: React + Vite application (UI, charts, print flows).
- `/functions_python`: Firebase Cloud Functions (Optimization engine, risk statistics).
- `/scripts`: Utility scripts for data ingestion and maintenance.

## 🛠️ Operational Rules (Source of Truth)

### 1. Canonical Taxonomy
All assets must be categorized into one of the following buckets for consistency across the system:
- **RV**: Renta Variable
- **RF**: Renta Fija
- **Mixto**: Balanced/Mixed funds
- **Monetario**: Cash equivalents, money market
- **Alternativos**: Alternative investments (Hedge funds, Private Equity)
- **Otros**: Unclassified or specialized assets

### 2. Data Precedence Rules
- **Classification**: `classification_v2` takes precedence over `asset_class`. Logic should always seek the v2 label first.
- **Exposure**: `portfolio_exposure_v2` takes precedence for geographical and sector analysis.
- **Rules Engine**: The frontend `rulesEngine.ts` and backend `config.py` MUST be kept in sync regarding risk profile parameters.

### 3. Optimizer Behavior
- **Risk Profiles**: Scale of 1 (Defensive) to 10 (Aggressive).
- **Equity Floors**: Each level has a minimum required Equity (RV) exposure.
- **Volatility Targets**: Profiles target specific annual volatility bands (e.g., Risk 1 ~2.5%, Risk 10 ~30%).
- **Constraints**: Higher risk levels (8-10) have caps on Cash/Bonds to ensure aggressive allocation is met.

## 🚀 Getting Started

### Local Development
The project relies on Firebase Emulators for local development.
1. Start Emulators: `firebase emulators:start`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Backend: `cd functions_python && pip install -r requirements.txt`

### Environment Variables
Refer to `.env.example` in both `/frontend` and `/functions_python` for required credentials.
- `EODHD_API_KEY`: Data provider for prices/fundamentals.
- `GEMINI_API_KEY`: AI-driven analysis features.

## 🚀 Deployment & Ops

### Deployment Assumptions
- **Project ID**: The system is bound to the `bdb-fondos` Firebase project.
- **Region**: Cloud Functions are pinned to `europe-west1`.
- **Security**: Firestore rules (`firestore.rules`) and Storage rules (`storage.rules`) must be deployed alongside code.
- **Service Account**: Local backend scripts (outside Cloud Functions) require `serviceAccountKey.json` in the root.

### Common Commands
```bash
# Start local environment (Emulators + Frontend)
# Terminal 1:
firebase emulators:start
# Terminal 2:
cd frontend && npm run dev

# Deploy only python backend
firebase deploy --only functions

# Deploy frontend hosting
firebase deploy --only hosting
```

## 📄 Maintenance
For deep maintenance on taxonomy, refer to `scripts/populate_taxonomy_v2_FINAL.py`. This script is the primary tool for mass-updating asset classifications and regions.
