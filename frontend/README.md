# BDB-FONDOS: Frontend Application

React + Vite + TypeScript interface for portfolio management.

## 🛠️ Setup & Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the Firebase credentials.
   ```bash
   cp .env.example .env
   ```

3. **Run Dev Server**:
   ```bash
   npm run dev
   ```

## 🔄 Firebase Emulators
The application automatically detects the development environment (`import.meta.env.DEV`) and connects to the local Firebase emulators (Firestore, Auth, Functions) if they are running.

## 📊 Business Logic Sources
- **Taxonomy**: Standardized in `usePortfolio.ts` and `rulesEngine.ts`.
- **Precedence**: UI follows `classification_v2` -> `asset_class`.
- **Allocations**: Stats and charts are calculated in `usePortfolioStats.ts`.

## 🖨️ Print System
The print-ready reports are located in `/src/pages/print`. The `MacroReport.tsx` handles the standardized print flow using `localStorage` as a data bridge for high-performance rendering.
