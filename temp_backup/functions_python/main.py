from firebase_admin import initialize_app

# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
initialize_app()

# ==============================================================================
# 2. DEFINICIÓN DECLARATIVA DE ENDPOINTS Y JOBS
# ==============================================================================
# Firebase Tools require the functions to be exported/visible at the module level.
