import warnings

warnings.warn(
    "This module (services.optimizer) is deprecated. Use services.portfolio.optimizer_core safely instead.",
    DeprecationWarning,
    stacklevel=2,
)

# Re-export core functions for legacy scripts to prevent runtime breakage
