import logging
logger = logging.getLogger(__name__)
from firebase_functions import https_fn, options
from firebase_admin import firestore

from services.portfolio.optimizer_core import run_optimization
from services.portfolio.autoexpand_candidates import select_candidate_pool
from services.portfolio.constraints_builder_v1 import build_constraints_v1, merge_profile_vol_band
from services.portfolio.frontier_engine import generate_efficient_frontier
from services.backtester import run_backtest, run_multi_period_backtest
from services.portfolio.analyzer import analyze_portfolio
from services.portfolio.utils import (
    _to_float,
    asset_type_to_bucket_label,
    extract_v2_identity,
    get_v2_asset_mix,
    get_v2_group_map,
    has_usable_v2_exposure,
    has_usable_v2_identity,
    summarize_v2_quality,
)

cors_config = options.CorsOptions(
    cors_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        r"https://.*\.web\.app",
        r"https://.*\.firebaseapp\.com",
    ],
    cors_methods=["GET", "POST", "OPTIONS"],
)


# =====================================================================
# HELPER FUNCTIONS PARA ENDPOINT (ROLES CLAROS)
# =====================================================================

def _inject_challengers(db, assets_list: list) -> list:
    """FASE 2: Añade candidatos top performance (Challengers) a la lista si no existen."""
    try:
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
            return challengers
        else:
            logger.info("ℹ️ No valid challengers found in Top 20.")
            return []
    except Exception as e_chal:
        logger.info(f"⚠️ Error fetching challengers: {e_chal}")
        return []

def _build_asset_metadata(db, assets_list: list, frontend_meta: dict) -> dict:
    """
    FASE 3: CONSTRUCCIÓN CANÓNICA DE METADATA
    1. Descarga metadata cruda directamente desde Firestore (Fuente de Verdad).
    2. Hace merge de sobreescritura con los metadatos de UI para compatibilidad.
    El Backend siempre tiene prioridad sobre 'asset_class' real si existe en BD.
    """
    asset_metadata = {}
    try:
        refs = [db.collection("funds_v3").document(isin) for isin in assets_list]
        docs = db.get_all(refs)
        for d in docs:
            if not d.exists:
                continue

            data = d.to_dict() or {}
            metrics = data.get("std_perf", {}) or data.get("metrics", {}) or {}
            meta_payload = {
                "classification_v2": data.get("classification_v2", {}) or {},
                "portfolio_exposure_v2": data.get("portfolio_exposure_v2", {}) or {},
                "derived": data.get("derived", {}) or {},
                "ms": data.get("ms", {}) or {},
                "regions": data.get("regions", {}) or {},
            }
            identity = extract_v2_identity(meta_payload)
            exposure_mix = get_v2_asset_mix(meta_payload, as_percent=True)
            v2_quality = summarize_v2_quality(meta_payload)

            asset_class = asset_type_to_bucket_label(identity.get("asset_type"))
            if not has_usable_v2_identity(meta_payload):
                asset_class = (
                    data.get("derived", {}).get("asset_class")
                    or data.get("asset_class")
                    or data.get("std_type")
                )

            asset_metadata[d.id] = {
                "regions": get_v2_group_map(meta_payload, "regions", as_percent=True),
                "styles": get_v2_group_map(meta_payload, "styles", as_percent=True),
                "sectors": get_v2_group_map(meta_payload, "sectors", as_percent=True),
                "credit": get_v2_group_map(meta_payload, "credit", as_percent=True),
                "duration": get_v2_group_map(meta_payload, "duration", as_percent=True),
                "bond_types": get_v2_group_map(meta_payload, "bond_types", as_percent=True),
                "metrics": metrics or {},
                "asset_class": asset_class,
                "market_cap": data.get("std_mcap", 1e9),
                "classification_v2": meta_payload["classification_v2"],
                "portfolio_exposure_v2": meta_payload["portfolio_exposure_v2"],
                "v2_identity": identity,
                "v2_exposure": exposure_mix,
                "v2_quality": v2_quality,
            }
    except Exception as e_meta:
        logger.info(f"⚠️ Error batch metadata: {e_meta}")

    if frontend_meta:
        logger.info(f"📥 Merging {len(frontend_meta)} metadata items from Frontend")
        for isin, meta in frontend_meta.items():
            if isin not in asset_metadata:
                asset_metadata[isin] = {}

            # We strictly prefer the DB 'asset_class' if we already fetched it.
            if "asset_class" in meta and not asset_metadata[isin].get("asset_class"):
                asset_metadata[isin]["asset_class"] = meta["asset_class"]

            # Fallback support for legacy label logic
            if "label" in meta:
                asset_metadata[isin]["label"] = meta["label"]
                if not asset_metadata[isin].get("asset_class"):
                    asset_metadata[isin]["asset_class"] = meta["label"]

            if "classification_v2" in meta and not asset_metadata[isin].get("classification_v2"):
                asset_metadata[isin]["classification_v2"] = meta.get("classification_v2") or {}
            if "portfolio_exposure_v2" in meta and not asset_metadata[isin].get("portfolio_exposure_v2"):
                asset_metadata[isin]["portfolio_exposure_v2"] = meta.get("portfolio_exposure_v2") or {}

    return asset_metadata

def _build_auto_expand_candidates(db, risk_level=None) -> dict:
    """
    FASE 3.5: Helper P2 para precargar candidatos de auto-expand.
    Elimina el acceso a BD de optimizer_core manteniendo pura su rutina.

    DECISION 2026-06-09 (post-auditoria, H2): pool por PERFIL con margen.
    La elegibilidad del perfil es el unico gate duro; la afinidad de tramo
    (defensivo <=2, mixtos 3-4, crecimiento 5-7, RV alta 8-10) solo ordena.
    La consulta se amplia a top-150 por Sharpe (antes 50) y la seleccion vive
    en services/portfolio/autoexpand_candidates.select_candidate_pool (pura).
    """
    candidates = {}
    fallback_isins = [
        "LU0340557775", "LU1135865084", "LU0690375182", "LU0203975437", "IE00B2NXKW18"
    ]
    _tier_keys = {1: "defensive_isins", 2: "defensive_isins", 3: "moderate_isins",
                  4: "moderate_isins", 5: "growth_isins", 6: "growth_isins",
                  7: "growth_isins"}
    try:
        cfg = db.collection("config").document("auto_complete_candidates").get()
        if cfg.exists:
            cfg_d = cfg.to_dict() or {}
            tier_key = _tier_keys.get(int(risk_level)) if risk_level else None
            fallback_isins = (
                (tier_key and cfg_d.get(tier_key))
                or cfg_d.get("equity90_isins", fallback_isins)
            )
    except Exception:
        pass

    try:
        docs = (
            db.collection("funds_v3")
            .order_by("std_perf.sharpe", direction=firestore.Query.DESCENDING)
            .limit(150)
            .stream()
        )
        rows = [(d.id, d.to_dict() or {}) for d in docs]
        candidates = select_candidate_pool(rows, risk_level=risk_level)
    except Exception as e:
        logger.info(f"⚠️ Error dynamic candidates: {e}")

    if not candidates:
        refs = [db.collection("funds_v3").document(isin) for isin in fallback_isins]
        docs = db.get_all(refs)
        for d in docs:
            if d.exists:
                dd = d.to_dict() or {}
                meta_payload = {
                    "classification_v2": dd.get("classification_v2", {}) or {},
                    "portfolio_exposure_v2": dd.get("portfolio_exposure_v2", {}) or {},
                }
                candidates[d.id] = {
                    "metrics": dd.get("metrics", {}),
                    "asset_class": asset_type_to_bucket_label((dd.get("classification_v2", {}) or {}).get("asset_type")) or "UNKNOWN",
                    "classification_v2": meta_payload["classification_v2"],
                    "portfolio_exposure_v2": meta_payload["portfolio_exposure_v2"],
                    "v2_identity": extract_v2_identity(meta_payload),
                    "v2_exposure": get_v2_asset_mix(meta_payload, as_percent=True),
                    "v2_quality": summarize_v2_quality(meta_payload),
                }

    return candidates


def _load_canonical_profile(db, profile_id: str) -> dict:
    """
    Carga el perfil canónico desde Firestore. Mantiene fallback local
    (dict vacío con profile_id) para no romper el flujo si falla la lectura.
    """
    normalized_id = str(profile_id or "5")
    try:
        doc = db.collection("system_settings").document("risk_profiles").get()
        if doc.exists:
            raw = doc.to_dict() or {}
            profile = raw.get(normalized_id)
            if isinstance(profile, dict):
                payload = dict(profile)
                payload["profile_id"] = normalized_id
                # DECISION 2026-06-09: bandas de vol explicitas en el campo
                # paralelo 'vol_bands' (no contamina el vocabulario de buckets).
                payload = merge_profile_vol_band(payload, raw, normalized_id)
                return payload
    except Exception as e_prof:
        logger.info(f"⚠️ Error loading canonical profile {normalized_id}: {e_prof}")
    return {"profile_id": normalized_id}


def _build_effective_constraints(req_data: dict) -> dict:
    """
    FASE 4: EVALUACIÓN DE RESTRICCIONES DUALES
    Extrae tolerancias / objetivos solicitados por la UI.
    Actúan en el solver solo como override secundario o directriz puntual.
    """
    strategy_constraints = {}
    frontend_constraints = req_data.get("constraints", {})
    for k, v in frontend_constraints.items():
        strategy_constraints[k] = v

    if req_data.get("auto_expand_universe"):
        strategy_constraints["auto_expand_universe"] = True

    if req_data.get("objective"):
        strategy_constraints["objective"] = req_data.get("objective")
        strategy_constraints["target_weights"] = req_data.get("target_weights", {})
        
    return strategy_constraints

# =====================================================================

@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.GB_2,
    timeout_sec=120,
    cors=cors_config,
)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    """
    [MÓDULO DE ENTRADA AL PMS - PRECEDENCIAS CLARIFICADAS]
    Este endpoint purifica la entrada del frontend y recaba metadata canónica.
    NOTA: Las determinaciones finales sobre Riesgo, Suitability y Restricciones las toma 
    'run_optimization' importando la configuración de la BD (Canonical Rules).
    """
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
        # =====================================================================
        # FASE 1: PARSEO Y VALIDACIÓN RAW (Contratos Tácticos del Frontend)
        # =====================================================================
        assets_list = list(req_data.get("assets", []))
        requested_assets = list(assets_list)
        risk_level = req_data.get("risk_level", 5)
        locked_assets = req_data.get("locked_assets", []) or []

        # --- [PRECEDENCIA CANÓNICA] Nivel 1: Bloqueos Reales ---
        if not assets_list:
            return {"status": "error", "warnings": ["Cartera vacía"]}
        
        try:
            risk_level = int(risk_level)
            if not (1 <= risk_level <= 10):
                return {"status": "error", "message": "Nivel de riesgo inválido (debe ser 1-10)"}
        except (ValueError, TypeError):
            return {"status": "error", "message": "Nivel de riesgo debe ser numérico"}

        # =====================================================================
        # FASE 2: EXPANSIÓN DE UNIVERSO (CHALLENGERS / Opcional)
        # =====================================================================
        added_challengers = []
        if req_data.get("enable_challengers") is True:
            added_challengers = _inject_challengers(db, assets_list)
            if added_challengers:
                assets_list.extend(added_challengers)
        else:
            logger.info("ℹ️ Challenger Logic DISABLED by default (Weight-Only Optimization)")

        # =====================================================================
        # FASE 3: CONSTRUCCIÓN CANÓNICA DE METADATA Y TELEMETRÍA 
        # =====================================================================
        asset_metadata = _build_asset_metadata(db, assets_list, req_data.get("asset_metadata", {}))

        telemetry = {
            "total_requested": len(assets_list),
            "v2_fully_compliant": sum(
                1
                for a in asset_metadata.values()
                if (a.get("v2_quality", {}) or {}).get("identity_ready")
                and (a.get("v2_quality", {}) or {}).get("exposure_ready")
            ),
            "v2_partial": sum(
                1
                for a in asset_metadata.values()
                if bool((a.get("v2_quality", {}) or {}).get("identity_ready"))
                ^ bool((a.get("v2_quality", {}) or {}).get("exposure_ready"))
            ),
            "legacy_fallback_only": sum(
                1
                for a in asset_metadata.values()
                if not (a.get("v2_quality", {}) or {}).get("identity_ready")
                and not (a.get("v2_quality", {}) or {}).get("exposure_ready")
            ),
            "legacy_assets": [
                k
                for k, a in asset_metadata.items()
                if not (a.get("v2_quality", {}) or {}).get("identity_ready")
                and not (a.get("v2_quality", {}) or {}).get("exposure_ready")
            ],
        }
        
        # --- STRUCTURED EXPLAINABILITY (Phase 5) ---
        v2_full = telemetry["v2_fully_compliant"]
        total_req = telemetry["total_requested"]
        telemetry["taxonomy_source"] = "classification_v2/portfolio_exposure_v2 prioritario"
        telemetry["legacy_fallbacks_triggered"] = bool(telemetry["legacy_assets"])
        telemetry["v2_usage_summary"] = f"{v2_full}/{total_req} activos usan Nivel 1 (100% V2 compliant)"

        logger.info(f"📊 Taxonomy Telemetry: {telemetry}")

        # =====================================================================
        # FASE 4: DEFINICIÓN DE RESTRICCIONES EFECTIVAS (Compatibilidad)
        # =====================================================================
        STRATEGY_CONSTRAINTS = _build_effective_constraints(req_data)
        tactical_views = req_data.get("tactical_views", {}) or {}

        profile_id = str(req_data.get("profile_id") or risk_level)
        optimization_mode = (
            req_data.get("optimization_mode")
            or STRATEGY_CONSTRAINTS.get("optimization_mode")
            or "rebalance_to_profile"
        )
        locked_positions = req_data.get("locked_positions")
        if not isinstance(locked_positions, dict):
            locked_positions = {
                "mode": STRATEGY_CONSTRAINTS.get("lock_mode", "keep_weight"),
                "positions": STRATEGY_CONSTRAINTS.get("fixed_weights", {}),
            }

        profile_payload = _load_canonical_profile(db, profile_id)
        builder_overrides = dict(STRATEGY_CONSTRAINTS)
        builder_overrides["profile_id"] = profile_id
        builder_overrides["optimization_mode"] = optimization_mode
        if req_data.get("objective"):
            builder_overrides["objective"] = req_data.get("objective")

        constraints_v1_obj = build_constraints_v1(
            profile=profile_payload,
            optimization_mode=optimization_mode,
            locked_positions=locked_positions,
            tactical_views=tactical_views,
            overrides=builder_overrides,
        )
        constraints_v1 = constraints_v1_obj.model_dump()

        # Compatibilidad: mantenemos dict legacy además del contrato canónico.
        STRATEGY_CONSTRAINTS["constraints_v1"] = constraints_v1
        STRATEGY_CONSTRAINTS["optimization_mode"] = constraints_v1["optimization_mode"]
        STRATEGY_CONSTRAINTS["objective"] = constraints_v1["objective"]
        STRATEGY_CONSTRAINTS["lock_mode"] = constraints_v1["locks"]["mode"]
        STRATEGY_CONSTRAINTS["fixed_weights"] = constraints_v1["locks"]["positions"]
        tactical_views = constraints_v1.get("views", {}).get("by_isin", tactical_views)

        # P2: Pre-fetch candidates para optimización matemática pura sin I/O
        candidate_funds = None
        if STRATEGY_CONSTRAINTS.get("auto_expand_universe") or float(STRATEGY_CONSTRAINTS.get("equity_floor", 0)) > 0:
            candidate_funds = _build_auto_expand_candidates(db, risk_level=risk_level)

        # =====================================================================
        # FASE 5: DELEGACIÓN AL MOTOR CÚANTITATIVO 
        # =====================================================================
        # Aquí 'run_optimization' (Nivel 4) asume el mando total matemático.
        result = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            constraints_v1=constraints_v1,
            asset_metadata=asset_metadata,
            locked_assets=locked_assets,
            tactical_views=tactical_views,
            candidate_funds=candidate_funds,
        )
        result["api_version"] = result.get("api_version", "optimize_quant_v4")
        result["taxonomy_telemetry"] = telemetry
        result["constraints_applied"] = constraints_v1

        # --- SNAPSHOT INSTRUMENTATION ---
        save_snapshot = req_data.get("save_snapshot") is True or bool(req_data.get("snapshot_label"))
        if save_snapshot:
            try:
                snapshot_ref = db.collection("optimizer_snapshots").document()
                snapshot = {
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "snapshot_label": req_data.get("snapshot_label", "manual_snapshot"),
                    "request_raw": {
                        "requested_assets": requested_assets,
                        "risk_level_raw": req_data.get("risk_level"),
                        "profile_id": profile_id,
                        "optimization_mode": optimization_mode,
                        "frontend_constraints_raw": req_data.get("constraints", {}),
                        "locked_positions": locked_positions,
                        "objective": req_data.get("objective"),
                        "auto_expand_universe": req_data.get("auto_expand_universe"),
                        "enable_challengers": req_data.get("enable_challengers"),
                        "locked_assets_raw": req_data.get("locked_assets"),
                        "tactical_views": tactical_views
                    },
                    "request_normalized": {
                        "effective_assets": assets_list,
                        "risk_level_normalized": risk_level,
                        "locked_assets_normalized": locked_assets,
                        "challengers_added": added_challengers,
                        "effective_constraints": STRATEGY_CONSTRAINTS,
                        "constraints_v1": constraints_v1,
                    },
                    "result_summary": {
                        "status": result.get("status"),
                        "solver_path": result.get("solver_path"),
                        "weights": result.get("weights", {}),
                        "bucket_totals": result.get("portfolio_allocation", {}),
                        "auto_added_funds": result.get("added_assets", []),
                        "warnings": result.get("warnings", []),
                        "expected_return": result.get("metrics", {}).get("return", 0),
                        "volatility": result.get("metrics", {}).get("volatility", 0),
                        "sharpe": result.get("metrics", {}).get("sharpe", 0),
                        "explainability": result.get("explainability", {}),
                        "taxonomy_telemetry": telemetry
                    }
                }
                snapshot_ref.set(snapshot)
                logger.info(f"📸 Snapshot saved to Firestore: {snapshot_ref.id} (label: {snapshot.get('snapshot_label')})")
            except Exception as snap_err:
                logger.error(f"Snapshot error: {snap_err}")
        # --------------------------------

        return result
    except Exception as e:
        logger.exception(f"🔥 Error en optimize_portfolio_quant: {e}")
        error_msg = str(e)
        # FIX H3 (auditoria 2026-06-09): el branch que parseaba "INFEASIBLE_HISTORY:"
        # aqui era codigo muerto: run_optimization captura esa ValueError internamente
        # y ahora devuelve {"status": "infeasible", "recovery_candidates": [...]}.
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error interno del servidor: {error_msg}"
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
        logger.exception(f"🔥 [getEfficientFrontier] Error crítico: {e}")
        return {"status": "error", "message": f"Error interno: {str(e)}", "error": f"Error interno: {str(e)}"}


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
        logger.exception(f"🔥 [analyze_portfolio_endpoint] Error: {e}")
        return {"status": "error", "error": f"Error interno: {str(e)}"}
