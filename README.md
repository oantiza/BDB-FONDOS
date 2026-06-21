# BDB-FONDOS: Portfolio Optimizer & Reporting

BDB-FONDOS is a specialized platform for financial portfolio analysis, optimization, and reporting. It leverages Firebase for data and computation, with a React frontend and Python-based cloud functions for quantitative analysis.

## Repository Structure

- `/data`: Operational parser storage. `input_pdfs`, `canonical`, `review`, `error`, and `work`. (Not version-controlled — see `.gitignore`.)
- `/overrides`: Manual override layer (`05_overrides`) and institutional validator.
- `/schemas`: Institutional schemas for governance and validation.
- `/tests`: Regression suites for parser-adjacent governance flows.
- `/docs`: Parser docs and audit/report outputs.
- `/frontend`: React + Vite application (UI, charts, print flows).
- `/functions_python`: Firebase Cloud Functions (Optimization engine, risk statistics).
- `/scripts`: Utility scripts for data ingestion and maintenance.

## 🛠️ Operational Rules (Source of Truth)

### 1. Canonical Taxonomy
All assets must be categorized into one of the following buckets for consistency across the system:
- **RV**: Renta Variable
- **RF**: Renta Fija
- **Mixto**: Balanced/Mixed funds (display class; mapped to a constraint bucket via economic look-through)
- **Monetario**: Cash equivalents, money market
- **Alternativos**: Alternative investments (Hedge funds, Private Equity)
- **Otros**: Unclassified or specialized assets

### 2. Data Precedence Rules
- **Classification**: `classification_v2` takes precedence over `asset_class`. Logic should always seek the v2 label first.
- **Exposure**: `portfolio_exposure_v2` takes precedence for geographical and sector analysis.
- **Rules Engine**: The frontend `rulesEngine.ts` and backend `config.py` MUST be kept in sync regarding risk profile parameters.

### 3. Optimizer Behavior
- **Risk Profiles**: Scale of 1 (Defensive) to 10 (Aggressive).
- **Equity Floor (derived)**: The minimum required Equity (RV) exposure is **derived from the profile's `rv_min` band** inside `optimizer_core.py` (REM-4). There is no standalone `EQUITY_FLOOR` constant: it acted on the same economic exposure (look-through) as the RV band, so it was removed to avoid a duplicate policy on the same axis.
- **Volatility Targets**: Profiles target specific annual volatility bands (e.g., Risk 1 ~2.5%, Risk 10 ~30%). The lower bound is non-convex, so it is audited **post-solve** (soft warning by default, hard check under `strict_feasibility`).
- **Bucket Caps**: Per-profile maximums for Cash/Bonds/etc. live in `RISK_BUCKETS_LABELS` (`services/config.py`) and in Firestore `system_settings/risk_profiles`. The former standalone `BOND_CAP`/`CASH_CAP` constants were removed as dead code that contradicted those bucket maxima (REM-4).

## 🚀 Getting Started

### Local Development
The project relies on Firebase Emulators for local development.
1. Start Emulators: `firebase emulators:start`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Backend: `cd functions_python && pip install -r requirements.txt`

### Environment Variables
Refer to `.env.example` in the root and in `/frontend` and `/functions_python` for required credentials.
- `EODHD_API_KEY`: Data provider for prices/fundamentals.
- `GEMINI_API_KEY`: AI-driven analysis features.

## 🚀 Deployment & Ops

### Deployment Assumptions
- **Project ID**: The system is bound to the `bdb-fondos` Firebase project.
- **Region**: Cloud Functions are pinned to `europe-west1`.
- **Runtime**: Cloud Functions run on Python 3.12 (`firebase.json`); CI is pinned to the same version.
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
