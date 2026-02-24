import os
import json
import logging
from firebase_admin import initialize_app

# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
initialize_app()

# ==============================================================================
# 2. DEFINICIÓN DECLARATIVA DE ENDPOINTS Y JOBS
# ==============================================================================
# Firebase Tools require the functions to be exported/visible at the module level.
from api.endpoints_portfolio import (
    optimize_portfolio_quant,
    generateSmartPortfolio,
    backtest_portfolio,
    backtest_portfolio_multi,
    getEfficientFrontier,
    analyze_portfolio_endpoint
)

from api.endpoints_admin import (
    force_weekly_research,
    generate_analysis_report,
    restore_historico,
    insertMonthlyReport,
    getRiskRate,
    updateFundHistory,
    refresh_daily_metrics
)

from api.schedulers import (
    scheduleWeeklyResearch,
    runMasterDailyRoutine
)
