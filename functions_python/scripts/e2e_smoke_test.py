import os
import sys

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.append(os.path.join(PROJECT_ROOT, "functions_python"))

# Initialize Firebase before importing services
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
if os.path.exists(KEY_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_PATH

import firebase_admin
from firebase_admin import credentials, firestore

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
except:
    pass

from services.portfolio.optimizer_core import run_optimization
from services.portfolio.analyzer import analyze_portfolio

db = firestore.client()


def print_result(name, res):
    print(f"\\n{'=' * 50}")
    print(f"✅ SCENARIO: {name}")
    status = res.get("status")
    print(f"Status: {status}")
    if "api_version" in res:
        print(f"API Version: {res['api_version']}")
    if "solver_path" in res:
        print(f"Solver Path: {res['solver_path']}")
    if "warnings" in res and res["warnings"]:
        print(f"Warnings: {res['warnings']}")

    if "weights" in res:
        w = res["weights"]
        print(f"Weights count: {len(w)}")
        print(f"Total weight sum: {sum(w.values()):.4f}")

    if "metrics" in res:
        m = res["metrics"]
        print(
            f"Metrics: Return: {m.get('expected_return', m.get('return', 0)):.4%}, Vol: {m.get('volatility', 0):.4%}, Sharpe: {m.get('sharpe_ratio', m.get('sharpe', 0)):.4f}"
        )

    if "explainability" in res:
        print(
            f"Explainability applied constraints: {res['explainability'].get('applied_constraints', {})}"
        )
    print(f"{'=' * 50}\\n")


def test_normal_optimization():
    print("Running: Normal Optimization")
    assets_list = [
        "LU0293313671",
        "LU0117858752",
        "ES0182105033",
        "ES0161992005",
        "ES0142167032",
        "ES0138936036",
        "LU0835722488",
        "LU1066281574",
    ]
    risk_level = 5
    STRATEGY_CONSTRAINTS = {
        "objective": "max_sharpe",
        "min_weight": 0.05,
        "max_weight": 0.25,
    }

    # We mock the asset metadata fetch to test just the optimizer logic
    # Or pass empty dict to let optimizer core fetch or fail, actually optimizer_core handles missing metadata well, wait, endpoints handles metadata.
    # Let's let the functions do what they do
    try:
        from api.endpoints_portfolio import _build_asset_metadata

        asset_metadata = _build_asset_metadata(db, assets_list, {})
        res = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            asset_metadata=asset_metadata,
            locked_assets=[],
            tactical_views={},
        )
        print_result("Normal Optimization", res)
        return True, res
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"❌ Failed Normal Optimization: {e}")
        return False, None


def test_locked_assets():
    print("Running: Optimization with Locked Assets")
    assets_list = [
        "LU0293313671",
        "LU0117858752",
        "ES0182105033",
        "ES0161992005",
        "ES0142167032",
    ]
    risk_level = 6
    STRATEGY_CONSTRAINTS = {"objective": "max_sharpe"}
    locked_assets = [{"isin": "LU0293313671", "weight": 0.20}]

    try:
        from api.endpoints_portfolio import _build_asset_metadata

        asset_metadata = _build_asset_metadata(db, assets_list, {})
        res = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            asset_metadata=asset_metadata,
            locked_assets=locked_assets,
            tactical_views={},
        )
        print_result("Locked Assets", res)
        return True, res
    except Exception as e:
        print(f"❌ Failed Locked Assets: {e}")
        return False, None


def test_tactical_views():
    print("Running: Optimization with Tactical Views")
    assets_list = [
        "LU0293313671",
        "LU0117858752",
        "ES0182105033",
        "ES0161992005",
        "ES0142167032",
    ]
    risk_level = 5
    STRATEGY_CONSTRAINTS = {}
    tactical_views = {
        "views": [
            {"type": "technology", "group": "US", "sentiment": 1, "confidence": 0.8}
        ],
        "mode": "bl_lite",
    }

    try:
        from api.endpoints_portfolio import _build_asset_metadata

        asset_metadata = _build_asset_metadata(db, assets_list, {})
        res = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            asset_metadata=asset_metadata,
            locked_assets=[],
            tactical_views=tactical_views,
        )
        print_result("Tactical Views", res)
        return True, res
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"❌ Failed Tactical Views: {e}")
        return False, None


def test_analyzer(opt_res):
    print("Running: Analyzer Endpoint")
    if not opt_res or "weights" not in opt_res:
        print(
            "❌ Cannot run analyzer: Previous optimization failed or returned no weights."
        )
        return False, None

    # Analyze portfolio takes a dictionary ISIN: Weight mapping
    weights = opt_res["weights"]
    try:
        res = analyze_portfolio(weights, db)
        print_result("Analyzer Endpoint", res)

        # Verify V2 exposure properties
        if "exposure" in res and "asset_type" in res["exposure"]:
            print("✅ Analyzer correctly constructed V2 exposure breakdown")
        return True, res
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"❌ Failed Analyzer: {e}")
        return False, None


def main():
    print("=== STARTING E2E SMOKE TESTS ===")
    s1, res1 = test_normal_optimization()
    s2, _ = test_locked_assets()
    s3, _ = test_tactical_views()

    # Run analyzer with the output of the first successful optimization
    s4 = False
    if s1:
        s4, _ = test_analyzer(res1)

    print("\\n=== SUMMARY ===")
    print(f"Normal Opt:      {'✅' if s1 else '❌'}")
    print(f"Locked Assets:   {'✅' if s2 else '❌'}")
    print(f"Tactical Views:  {'✅' if s3 else '❌'}")
    print(f"Analyzer/Report: {'✅' if s4 else '❌'}")
    print("================================")


if __name__ == "__main__":
    main()
