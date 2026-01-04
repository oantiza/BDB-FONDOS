# Endpoints package - import all endpoints here for Firebase discovery
from .market import getMarketIndex, getYieldCurve
from .portfolio import optimize_portfolio_quant, generateSmartPortfolio, backtest_portfolio
from .admin import getFinancialNews, restore_historico
