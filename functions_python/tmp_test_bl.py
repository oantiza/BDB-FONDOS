import firebase_admin
from firebase_admin import credentials, firestore
import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../functions_python"))
from services.portfolio.optimizer_core import run_optimization

if not firebase_admin._apps:
    # Attempt to initialize defaulting to GOOGLE_APPLICATION_CREDENTIALS or emulator
    firebase_admin.initialize_app()
db = firestore.client()

assets = ["LU0171283459", "IE00B0M62X26", "LU0292095535"]

print("\n--- RUNNING WITHOUT VIEWS ---")
res_no_views = run_optimization(
    assets_list=assets,
    risk_level=5,
    db=db,
    constraints={"disable_profile_rules": True, "objective": "max_sharpe"},
    tactical_views={}
)
print("Return:", res_no_views.get("portfolio_return"))
print("Risk:", res_no_views.get("portfolio_risk"))
print("Weights:", res_no_views.get("weights"))

print("\n--- RUNNING WITH STRONG VIEWS (LU0171283459 will return 50%) ---")
res_views = run_optimization(
    assets_list=assets,
    risk_level=5,
    db=db,
    constraints={"disable_profile_rules": True, "objective": "max_sharpe"},
    tactical_views={"LU0171283459": 0.50}
)
print("Return:", res_views.get("portfolio_return"))
print("Risk:", res_views.get("portfolio_risk"))
print("Weights:", res_views.get("weights"))
