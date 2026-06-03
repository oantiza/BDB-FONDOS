import os

# ==========================================
# 0) INFRASTRUCTURE & CREDENTIALS
# ==========================================
BENCHMARK_RF_ISIN = "IE00B18GC888"
BENCHMARK_RV_ISIN = "IE00B03HCZ61"
EODHD_API_KEY = os.environ.get("EODHD_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # print("WARNING: GEMINI_API_KEY not found in environment variables.")
    pass

if not EODHD_API_KEY:
    # print("WARNING: EODHD_API_KEY not found in environment variables.")
    pass

BUCKET_NAME = "bdb-fondos.firebasestorage.app"
PRICE_CACHE = {}

# ==========================================
# 1) QUANT DEFAULTS (Technical Truth)
# ==========================================
# [PRECEDENCIA CANÓNICA]: Nivel 4 - Entorno Matemático.
# Estas constantes definen la física del motor (Días, Tasa libre de riesgo).
# Autoridad total del backend, NO DEBEN ser sobreescritas por Firestore ni UI.
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03

# ==========================================
# 2) SOLVER DEFAULTS (Technical Truth / Fallback Policy)
# ==========================================
# [PRECEDENCIA CANÓNICA]: Nivel 4 - Contornos Algorítmicos Base.
# Parámetros técnicos para pypfopt. Representan la política de caídas (fallbacks) 
# y estabilidad. NO DEBEN guiarse por reglas de negocio de Firestore.

# Límite máximo por activo para evitar concentración excesiva
MAX_WEIGHT_DEFAULT = 0.20

# Cutoff de limpieza de pesos (elimina "polvo" pero mantiene diversificación)
CUTOFF_DEFAULT = 0.02

# Mínimo de activos con peso > 0 para considerar la solución "estable"
MIN_ASSETS_DEFAULT = 8

# ==========================================
# 3) PROFILE POLICY DEFAULTS (DB Seed Only)
# ==========================================
# [PRECEDENCIA CANÓNICA]: Nivel 3 - Contornos de Negocio.
# NOTA CRÍTICA: La ÚNICA FUENTE DE VERDAD REAL para la política de perfiles es FIRESTORE.
# RISK_TARGETS actúa SOLAMENTE COMO SEED (semilla estática) en caso de fallo de lectura o BD vacía.
#
# REM-4 (A2/A3) — EQUITY_FLOOR, BOND_CAP y CASH_CAP ELIMINADAS:
#   * EQUITY_FLOOR era redundante con la banda RV del perfil: ambos operan sobre la MISMA
#     exposición económica (w·eq_v, look-through). El "equity floor técnico" para
#     precheck/auto-expand se DERIVA del rv_min efectivo en optimizer_core, no de una
#     constante separada (evita una 2ª política sobre el mismo eje).
#   * BOND_CAP/CASH_CAP eran código muerto y CONTRADECÍAN los máximos de RF/Monetario de
#     RISK_BUCKETS_LABELS. Los topes reales viven en los buckets del perfil.

# Volatilidad anual explícita objetivo para cada perfil. (SEED)
RISK_TARGETS = {
    1: 0.025,
    2: 0.045,
    3: 0.065,
    4: 0.085,
    5: 0.105,
    6: 0.125,
    7: 0.155,
    8: 0.185,
    9: 0.225,
    10: 0.300,
}

CANONICAL_RISK_PROFILE_DOC = "system_settings/risk_profiles"
PROFILE_POLICY_SEED_VERSION = "risk_profiles_seed_v1"
# Grouped fallback payload: useful for future canonical profile assembly without breaking legacy imports today.
PROFILE_POLICY_SEED = {
    "risk_targets": RISK_TARGETS,
}
# Legacy module-level constants remain available for optimizer imports.

# ==========================================
# 4) ASSET ALLOCATION BUCKETS (DB Seed Only)
# ==========================================
# [PRECEDENCIA CANÓNICA]: Nivel 3 - Contornos de Negocio.
# Misma regla: FIRESTORE MANDA. Esto es inicialización.
# Matches Frontend 'rulesEngine.ts' exactly.
# Keys must match normalized labels in optimization logic
RISK_BUCKETS_LABELS = {
    1: {
        "RV": (0.0, 0.10),
        "RF": (0.20, 0.60),
        "Monetario": (0.40, 0.80),
        "Alternativos": (0.0, 0.10),
        "Otros": (0.0, 0.10),
    },
    2: {
        "RV": (0.0, 0.15),
        "RF": (0.40, 0.70),
        "Monetario": (0.20, 0.50),
        "Alternativos": (0.0, 0.10),
        "Otros": (0.0, 0.10),
    },
    3: {
        "RV": (0.10, 0.25),
        "RF": (0.40, 0.70),
        "Monetario": (0.10, 0.30),
        "Alternativos": (0.0, 0.15),
        "Otros": (0.0, 0.20),
    },
    4: {
        "RV": (0.20, 0.40),
        "RF": (0.30, 0.60),
        "Monetario": (0.0, 0.20),
        "Alternativos": (0.0, 0.20),
        "Otros": (0.0, 0.30),
    },
    5: {
        "RV": (0.40, 0.60),
        "RF": (0.20, 0.40),
        "Monetario": (0.0, 0.10),
        "Alternativos": (0.0, 0.20),
        "Otros": (0.0, 0.25),
    },
    6: {
        "RV": (0.50, 0.75),
        "RF": (0.10, 0.30),
        "Monetario": (0.0, 0.10),
        "Alternativos": (0.0, 0.20),
        "Otros": (0.0, 0.20),
    },
    7: {
        "RV": (0.70, 0.90),
        "RF": (0.0, 0.20),
        "Monetario": (0.0, 0.05),
        "Alternativos": (0.0, 0.15),
        "Otros": (0.0, 0.20),
    },
    8: {
        "RV": (0.85, 1.00),
        "RF": (0.0, 0.05),
        "Monetario": (0.0, 0.05),
        "Alternativos": (0.0, 0.10),
        "Otros": (0.0, 0.15),
    },
    9: {
        "RV": (0.95, 1.00),
        "RF": (0.0, 0.05),
        "Monetario": (0.0, 0.0),
        "Alternativos": (0.0, 0.05),
        "Otros": (0.0, 0.05),
    },
    10: {
        "RV": (0.95, 1.00),
        "RF": (0.0, 0.05),
        "Monetario": (0.0, 0.05),
        "Alternativos": (0.0, 0.05),
        "Otros": (0.0, 0.0),
    },
}

# Grouped view of the same fallback matrix, useful for future single-profile payload assembly.
RISK_PROFILE_BUCKETS_SEED = RISK_BUCKETS_LABELS
PROFILE_POLICY_SEED["risk_buckets_labels"] = RISK_PROFILE_BUCKETS_SEED
