import os

# ==========================================
# CONFIGURACIÓN GLOBAL
# ==========================================
BENCHMARK_RF_ISIN = 'IE00B18GC888' 
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'
EODHD_API_KEY = os.environ.get("EODHD_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # print("WARNING: GEMINI_API_KEY not found in environment variables.")
    pass

if not EODHD_API_KEY:
    # print("WARNING: EODHD_API_KEY not found in environment variables.")
    pass

BUCKET_NAME = "bdb-fondos.firebasestorage.app" 
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03
PRICE_CACHE = {}

# Definimos explícitamente qué volatilidad anual buscar para cada perfil.
RISK_TARGETS = {
    1: 0.025, 2: 0.045, 3: 0.065, 
    4: 0.085, 5: 0.105, 6: 0.125, 
    7: 0.155, 8: 0.185, 9: 0.225, 10: 0.300
}
