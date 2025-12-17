# Shared configuration for all endpoints
from firebase_admin import initialize_app, firestore, storage
import os

# Initialize Firebase (only once)
try:
    initialize_app()
except ValueError:
    pass  # Already initialized

# ==========================================
# GLOBAL CONFIGURATION
# ==========================================
BENCHMARK_RF_ISIN = 'IE00B18GC888' 
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'
EODHD_API_KEY = os.environ.get("EODHD_API_KEY")
if not EODHD_API_KEY:
    print("⚠️ WARNING: EODHD_API_KEY not found in environment variables.")

BUCKET_NAME = "bdb-fondos.firebasestorage.app" 
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03

# In-memory cache
PRICE_CACHE = {}

# CORS configuration
from firebase_functions import options
cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])
