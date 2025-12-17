import os

# ==========================================
# CONFIGURACIÓN GLOBAL
# ==========================================
BENCHMARK_RF_ISIN = 'IE00B18GC888' 
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'
EODHD_API_KEY = os.environ.get("EODHD_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("⚠️ WARNING: GEMINI_API_KEY not found in environment variables.")

if not EODHD_API_KEY:
    print("⚠️ WARNING: EODHD_API_KEY not found in environment variables.")

BUCKET_NAME = "bdb-fondos.firebasestorage.app" 
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03
PRICE_CACHE = {}
