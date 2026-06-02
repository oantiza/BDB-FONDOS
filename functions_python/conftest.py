# Garantiza que functions_python esté en sys.path para que `services`/`models`
# se importen sin depender de los sys.path.insert de cada test ni de un venv concreto.
import os
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
