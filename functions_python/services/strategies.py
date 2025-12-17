# Strategy Definitions

# Risk Level to Target Volatility Map
# Used in optimizer.py
RISK_VOL_MAP = {
    1: 0.03, 2: 0.05, 3: 0.07, 4: 0.09, 5: 0.12,
    6: 0.15, 7: 0.18, 8: 0.22, 9: 0.28, 10: 0.99
}

# Macro-Europeist Strategy Constraints
# Defines the target allocation for regions
STRATEGY_CONSTRAINTS = {
    'europe': 0.40,  # Target 40%
    'americas': 0.35 # Cap at 35%
}
