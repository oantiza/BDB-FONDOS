from firebase_functions import logging
logger = logging.getLogger(__name__)
import https_fn, options
from firebase_admin import firestore

from services.portfolio.optimizer_core import run_optimization
from services.portfolio.frontier_engine import generate_efficient_frontier
from services.backtester import run_backtest, run_multi_period_backtest
from services.portfolio.analyzer import analyze_portfolio

cors_config = options.CorsOptions(
    cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"]
)


@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.GB_2,
    timeout_sec=120,
    cors=cors_config,
)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    req_data = request.data
    db = firestore.client()

    if req_data.get("warmup") is True:
        return {"status": "warmed_up"}

    try:
        STRATEGY_CONSTRAINTS = {}

        assets_list = req_data.get("assets", [])
        risk_level = req_data.get("risk_level", 5)
        locked_assets = req_data.get("locked_assets", []) or []
        if not assets_list:
            return {"status": "error", "warnings": ["Cartera vacía"]}

        # --- NEW: CHALLENGER LOGIC (Add +1 Fund Capability) ---
        if req_data.get("enable_challengers") is True:
            try:
                # --- SMART CHALLENGER LOGIC (V4.1) ---
                docs = (
                    db.collection("funds_v3")
                    .order_by("std_perf.sharpe", direction=firestore.Query.DESCENDING)
                    .limit(20)
                    .stream()
                )

                challengers = []
                for d in docs:
                    if len(challengers) >= 2:
                        break
                    data = d.to_dict() or {}
                    isin = d.id
                    if isin in assets_list:
                        continue
                    dq = data.get("data_quality", {})
                    if dq.get("history_ok") is False:
                        continue
                    if not data.get("std_perf"):
                        continue
                    challengers.append(isin)

                if challengers:
                    logger.info(f"🚀 Injecting Challengers (Valid Quality): {challengers}")
                    assets_list.extend(challengers)
                else:
                    logger.info("ℹ️ No valid challengers found in Top 20.")
            except Exception as e_chal:
                logger.info(f"⚠️ Error fetching challengers: {e_chal}")
        else:
            logger.info("ℹ️ Challenger Logic DISABLED by default (Weight-Only Optimization)")

        # Batch-read metadata (evita N+1)
        asset_metadata = {}
        try:
            refs = [db.collection("funds_v3").document(isin) for isin in assets_list]
            docs = db.get_all(refs)
            for d in docs:
                if d.exists:
                    data = d.to_dict() or {}
                    derived_exposure = data.get("derived", {}).get(
                        "portfolio_exposure", {}
                    )
                    regions = derived_exposure.get("equity_regions_total", {})

                    if not regions:
                        ms_regions = data.get("ms", {}).get("regions", {})
                        regions = ms_regions.get("detail", {})
                        if not regions:
                            regions = ms_regions.get("macro", {})

                    if not regions:
                        regions = data.get("regions", {})

                    metrics = data.get("std_perf", {})
                    if not metrics:
                        metrics = data.get("metrics", {})

                    asset_class = data.get("derived", {}).get("asset_class")
                    if not asset_class:
                        asset_class = data.get("asset_class")
                    if not asset_class:
                        asset_class = data.get("std_type")

                    asset_metadata[d.id] = {
                        "regions": regions or {},
                        "metrics": metrics or {},
                        "asset_class": asset_class,
                        "market_cap": data.get("std_mcap", 1e9),
                        "classification_v2": data.get("classification_v2", {}),
                        "portfolio_exposure_v2": data.get("portfolio_exposure_v2", {}),
                    }
        except Exception as e_meta:
            logger.info(f"⚠️ Error batch metadata: {e_meta}")

        frontend_meta = req_data.get("asset_metadata", {})
        if frontend_meta:
            logger.info(f"📥 Merging {len(frontend_meta)} metadata items from Frontend")
            for isin, meta in frontend_meta.items():
                if isin not in asset_metadata:
                    asset_metadata[isin] = {}

                # We strictly prefer the DB 'asset_class' if we already fetched it.
                # If the DB doesn't have it (e.g. custom CSV import), we accept the frontend's.
                if "asset_class" in meta and not asset_metadata[isin].get(
                    "asset_class"
                ):
                    asset_metadata[isin]["asset_class"] = meta["asset_class"]

                # Fallback support for legacy label logic
                if "label" in meta:
                    asset_metadata[isin]["label"] = meta["label"]
                    if not asset_metadata[isin].get("asset_class"):
                        asset_metadata[isin]["asset_class"] = meta["label"]

        frontend_constraints = req_data.get("constraints", {})
        for k, v in frontend_constraints.items():
            STRATEGY_CONSTRAINTS[k] = v

        if req_data.get("auto_expand_universe"):
            STRATEGY_CONSTRAINTS["auto_expand_universe"] = True

        if req_data.get("objective"):
            STRATEGY_CONSTRAINTS["objective"] = req_data.get("objective")
            STRATEGY_CONSTRAINTS["target_weights"] = req_data.get(
                "target_weights", {}
            )

        tactical_views = req_data.get("tactical_views", {})

        result = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            asset_metadata=asset_metadata,
            locked_assets=locked_assets,
            tactical_views=tactical_views,
        )
        result["api_version"] = result.get("api_version", "optimize_quant_v4")
        return result
    except Exception as e:
        error_msg = str(e)
        if error_msg.startswith("INFEASIBLE_HISTORY:"):
            candidates_str = error_msg.split(":")[1]
            candidates = candidates_str.split(",") if candidates_str else []
            logger.info(
                f"⚠️ [Endpoint] Infeasible optimization. Requesting UI expansion with {candidates}"
            )
            return {
                "status": "infeasible",
                "message": "Faltan datos históricos o diversidad de activos para equilibrar matemáticamente la cartera. ¿Aceptas añadir fondos globales?",
                "recovery_candidates": candidates,
            }
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL, message=error_msg
        )


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config
)
def backtest_portfolio(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    db = firestore.client()
    data = request.data
    portfolio = data.get("portfolio", [])
    period = data.get("period", "3y")
    if not portfolio:
        return {"error": "Cartera vacía"}
    return run_backtest(portfolio, period, db)


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config
)
def backtest_portfolio_multi(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    db = firestore.client()
    data = request.data
    portfolio = data.get("portfolio", [])
    periods = data.get("periods", ["1y", "3y", "5y"])
    if not portfolio:
        return {"error": "Cartera vacía"}
    return run_multi_period_backtest(portfolio, periods, db)


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config
)
def getEfficientFrontier(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    db = firestore.client()
    try:
        data = request.data or {}
        portfolio = data.get("portfolio", [])
        period = data.get("period", "3y")

        if not portfolio:
            logger.info("⚠️ [getEfficientFrontier] Cartera vacía recibida.")
            return {"error": "Empty portfolio"}

        assets_list = [item["isin"] for item in portfolio]
        portfolio_weights = {
            item["isin"]: (float(item.get("weight", 0)) / 100.0) for item in portfolio
        }

        logger.info(
            f"🚀 [getEfficientFrontier] Calculando para {len(assets_list)} activos. Period: {period}"
        )

        result = generate_efficient_frontier(
            assets_list, db, portfolio_weights, period=period
        )

        if "error" in result:
            logger.info(
                f"❌ [getEfficientFrontier] Error en lógica interna: {result['error']}"
            )

        return result

    except Exception as e:
        logger.info(f"🔥 [getEfficientFrontier] Error crítico en endpoint: {e}")
        import traceback

        traceback.print_exc()
        return {"status": "error", "error": str(e)}


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config
)
def analyze_portfolio_endpoint(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    db = firestore.client()
    try:
        data = request.data or {}
        portfolio = data.get("portfolio", [])

        if not portfolio:
            return {"error": "Empty portfolio"}

        portfolio_weights = {
            item["isin"]: (float(item.get("weight", 0)) / 100.0) for item in portfolio
        }

        result = analyze_portfolio(portfolio_weights, db)
        return result

    except Exception as e:
        logger.info(f"🔥 [analyze_portfolio_endpoint] Error: {e}")
        return {"status": "error", "error": str(e)}
