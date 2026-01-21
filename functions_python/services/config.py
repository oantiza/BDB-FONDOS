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

# ==========================================
# OPTIMIZACIÓN (PARÁMETROS CANÓNICOS)
# ==========================================
# Límite máximo por activo (Perfil B / producción)
MAX_WEIGHT_DEFAULT = 0.20

# Cutoff de limpieza de pesos (elimina "polvo" pero mantiene diversificación)
CUTOFF_DEFAULT = 0.005

# Mínimo de activos con peso > 0 para considerar la solución "estable"
MIN_ASSETS_DEFAULT = 8

# Perfil B agresivo (mixtos permitidos por su equity real: metrics.equity)
# equity_floor define el % mínimo de renta variable (equity) ponderado por pesos.
EQUITY_FLOOR = {
    1: 0.05, 2: 0.10, 3: 0.20,
    4: 0.30, 5: 0.40, 6: 0.55,
    7: 0.65, 8: 0.75, 9: 0.85, 10: 0.98,
}

# Caps opcionales (recomendados para perfiles altos).
BOND_CAP = {8: 0.25, 9: 0.18, 10: 0.00}
CASH_CAP = {8: 0.12, 9: 0.10, 10: 0.02}

# Definimos explícitamente qué volatilidad anual buscar para cada perfil.
RISK_TARGETS = {
    1: 0.025, 2: 0.045, 3: 0.065, 
    4: 0.085, 5: 0.105, 6: 0.125, 
    7: 0.155, 8: 0.185, 9: 0.225, 10: 0.300
}

# ==========================================
# NEW: BUCKET LOGIC V3 (Label-Based Constraints)
# Matches Frontend 'rulesEngine.ts' exactly.
# ==========================================
# Keys must match normalized labels in optimization logic
RISK_BUCKETS_LABELS = {
    1: { "RV": (0.0, 0.10), "RF": (0.20, 0.60), "Mixto": (0.0, 0.20), "Monetario": (0.40, 0.80), "Other": (0.0, 0.10) },
    2: { "RV": (0.0, 0.15), "RF": (0.40, 0.70), "Mixto": (0.0, 0.20), "Monetario": (0.20, 0.50), "Other": (0.0, 0.10) },
    3: { "RV": (0.10, 0.25), "RF": (0.40, 0.70), "Mixto": (0.10, 0.30), "Monetario": (0.10, 0.30), "Other": (0.0, 0.20) },
    4: { "RV": (0.20, 0.40), "RF": (0.30, 0.60), "Mixto": (0.20, 0.40), "Monetario": (0.0, 0.20), "Other": (0.0, 0.30) },
    5: { "RV": (0.40, 0.60), "RF": (0.20, 0.40), "Mixto": (0.20, 0.50), "Monetario": (0.0, 0.10), "Other": (0.0, 0.25) },
    6: { "RV": (0.50, 0.75), "RF": (0.10, 0.30), "Mixto": (0.10, 0.40), "Monetario": (0.0, 0.10), "Other": (0.0, 0.20) },
    7: { "RV": (0.70, 0.90), "RF": (0.0, 0.20), "Mixto": (0.0, 0.20), "Monetario": (0.0, 0.05), "Other": (0.0, 0.20) },
    8: { "RV": (0.85, 1.00), "RF": (0.0, 0.10), "Mixto": (0.0, 0.10), "Monetario": (0.0, 0.0),  "Other": (0.0, 0.15) },
    9: { "RV": (0.95, 1.00), "RF": (0.0, 0.05), "Mixto": (0.0, 0.05), "Monetario": (0.0, 0.0),  "Other": (0.0, 0.05) },
    10:{ "RV": (1.00, 1.00), "RF": (0.0, 0.0),  "Mixto": (0.0, 0.0),  "Monetario": (0.0, 0.0),  "Other": (0.0, 0.0) },
}
