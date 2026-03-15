import warnings

warnings.warn(
    "This module (services.optimizer) is deprecated. Use services.portfolio.optimizer_core safely instead.",
    DeprecationWarning,
    stacklevel=2
)

# Re-export core functions for legacy scripts to prevent runtime breakage
from services.portfolio.optimizer_core import run_optimization
from services.portfolio.frontier_engine import generate_efficient_frontier
