from firebase_admin import initialize_app

# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
initialize_app()

# ==============================================================================
# 2. DEFINICIÓN DECLARATIVA DE ENDPOINTS Y JOBS
# ==============================================================================
# Firebase Tools require the functions to be exported/visible at the module level.

# -----------------
# SCHEDULERS (CRONS)
# -----------------
from api.schedulers import (
    scheduleWeeklyResearch,
    runMasterDailyRoutine,
    runDailyDataValidation
)

# -----------------
# PORTFOLIO
# -----------------
from api.endpoints_portfolio import (
    optimize_portfolio_quant,
    backtest_portfolio,
    backtest_portfolio_multi,
    getEfficientFrontier,
    analyze_portfolio_endpoint
)

# -----------------
# ADMIN / MISC
# -----------------
from api.endpoints_macro import get_economic_calendar
from api.endpoints_admin import (
    force_weekly_research,
    generate_analysis_report,
    restore_historico,
    insertMonthlyReport,
    getRiskRate,
    updateFundHistory,
    refresh_daily_metrics
)

# -----------------
# XRAY COMPARADOR
# -----------------
from api.endpoints_xray_comparador import compare_risk_free

# -----------------
# ADMIN CONSOLE (READ-ONLY)
# -----------------
from api.endpoints_admin_console import (
    admin_health,
    admin_fund_search,
)
