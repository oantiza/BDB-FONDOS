import logging

logger = logging.getLogger(__name__)

from firebase_admin import firestore
import pandas as pd
import numpy as np
from pypfopt import (
    EfficientFrontier,
    risk_models,
    objective_functions,
    CLA,
)

from services.data_fetcher import DataFetcher
from services.config import (
    RISK_TARGETS,
    MAX_WEIGHT_DEFAULT,
    CUTOFF_DEFAULT,
    RISK_BUCKETS_LABELS,
)

from .utils import (
    _to_float,
    _normalize,
    _allocation_vectors,
    apply_market_proxy_backfill,
)

from services.quant_core import (
    get_covariance_matrix,
    get_expected_returns,
    calculate_portfolio_metrics,
)

from services.portfolio.suitability_engine import is_fund_eligible_for_profile

FALLBACK_CANDIDATES_DEFAULT = [
    "LU0340557775",  # Morgan Stanley Global Opportunity (Activo)
    "LU1135865084",  # Fidelity Funds - Global Dividend (Activo)
    "LU0690375182",  # Fundsmith Equity Fund (Activo)
    "LU0203975437",  # Robeco BP Global Premium Equities (Activo)
    "IE00B2NXKW18",  # Seilern World Growth (Activo)
]

# =========================================================================
# INTERNAL PIPELINE HELPERS
# =========================================================================

def _build_optimization_context(db, constraints):
    """
    FASE 1: Construcción de contexto y políticas base.
    [PRECEDENCIA]: Firestore (risk_profiles) manda sobre todo lo demás.
    """
    apply_profile = constraints.get("apply_profile", True)
    optimization_mode = constraints.get("optimization_mode", "rebalance_to_profile")
    lock_mode = constraints.get("lock_mode", "keep_weight")
    fixed_weights = constraints.get("fixed_weights", {})

    if optimization_mode == "pure_markowitz" or constraints.get("disable_profile_rules"):
        apply_profile = False

    try:
        risk_profile_doc = db.collection("system_settings").document("risk_profiles").get()
        if risk_profile_doc.exists:
            raw_dic = risk_profile_doc.to_dict()
            current_risk_buckets = {int(k): v for k, v in raw_dic.items()}
            logger.info("⚡ [Optimizer] Cargados perfiles de riesgo desde Firestore")
        else:
            logger.info("⚠️ [Optimizer] Perfiles no encontrados en DB. Auto-inicializando...")
            db_save = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
            db.collection("system_settings").document("risk_profiles").set(db_save)
            current_risk_buckets = RISK_BUCKETS_LABELS
    except Exception as e:
        logger.info(f"⚠️ [Optimizer] Fallo al leer perfiles de riesgo: {e}. Usando locales.")
        current_risk_buckets = RISK_BUCKETS_LABELS

    equity_floor = float(constraints.get("equity_floor", 0.0))
    bond_cap = float(constraints.get("bond_cap", 1.0))
    cash_cap = float(constraints.get("cash_cap", 1.0))

    return apply_profile, optimization_mode, lock_mode, fixed_weights, current_risk_buckets, equity_floor, bond_cap, cash_cap


def _apply_suitability_filter(assets_list, asset_metadata, risk_level, apply_profile, locked_assets):
    """
    FASE 2: Suitability Hard Filter.
    [PRECEDENCIA CANÓNICA] Nivel 2: Filtro Regulador Excluyente.
    [CORRECCIÓN DE PRECEDENCIA]: El Nivel 1 (Locked Assets) prevalece explícitamente.
    Si el usuario fuerza/bloquea un activo manual, se salta el filtro de idoneidad local.
    """
    if not apply_profile:
        return assets_list

    filtered_list = []
    locked_set = set(locked_assets or [])
    for isin in assets_list:
        if isin in locked_set:
            logger.info(f"🔓 [Suitability Override] {isin} mantenido por Nivel 1 (Locked Asset).")
            filtered_list.append(isin)
            continue
            
        meta = asset_metadata.get(isin, {})
        eligible, reason = is_fund_eligible_for_profile(meta, int(risk_level))
        if eligible:
            filtered_list.append(isin)
        else:
            logger.info(f"🚫 [Suitability Excluded] {isin}: {reason}")
    return filtered_list

def _build_candidate_universe(db, assets_list, asset_metadata, constraints):
    """
    FASE 3: Historico de Datos y Expansión Básica.
    [LEGADO]: Incluye lógica de auto-expandir basada en base de datos si fallan historiales.
    """
    fetcher = DataFetcher(db)
    price_data, synthetic_used = fetcher.get_price_data(
        assets_list, resample_freq="D", strict=False, no_fill=True
    )

    df = pd.DataFrame(price_data)
    df.index = pd.to_datetime(df.index)

    target_years = 5
    ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * target_years) if not df.empty else None

    if not df.empty:
        df = df[df.index >= ideal_start_date]
        logger.info(
            f"ℹ️ Optimization Fixed Window: {ideal_start_date.date()} to {df.index[-1].date()} ({(df.index[-1] - ideal_start_date).days} days)"
        )
        df = df.sort_index().ffill()
    else:
        logger.info(
            "⚠️ No valid data found for any asset. Falling back to strict inner join..."
        )
        df = df.dropna()

    if df.empty or len(df) < 50:
        auto_expand = constraints.get("auto_expand_universe", False)

        if not auto_expand:
            logger.info(
                "⚠️ Insufficient history. Aborting and returning recovery candidates..."
            )
            candidates_list = FALLBACK_CANDIDATES_DEFAULT
            try:
                cfg_ref = db.collection("config").document("auto_complete_candidates")
                cfg = cfg_ref.get()
                if cfg.exists:
                    candidates_list = cfg.to_dict().get("equity90_isins", FALLBACK_CANDIDATES_DEFAULT)
            except Exception:
                pass

            raise ValueError(f"INFEASIBLE_HISTORY:{','.join(candidates_list[:5])}")

        logger.info("⚠️ Auto-expanding due to missing history...")
        candidates_list = FALLBACK_CANDIDATES_DEFAULT
        try:
            cfg_ref = db.collection("config").document("auto_complete_candidates")
            cfg = cfg_ref.get()
            if cfg.exists:
                candidates_list = cfg.to_dict().get("equity90_isins", FALLBACK_CANDIDATES_DEFAULT)
        except Exception:
            pass

        valid_cands, _ = fetcher.get_price_data(candidates_list, resample_freq="D", strict=True)
        for isin, p_series in valid_cands.items():
            if len(p_series) >= 50:
                price_data[isin] = p_series

        if not price_data:
            raise Exception("Fallo crítico: ni siquiera los candidatos de recuperación tienen datos.")

        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)

        ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * 5)
        first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()

        if not first_valid_indices.empty:
            actual_start_date = first_valid_indices.max()
            final_start_date = max(ideal_start_date, actual_start_date)
            df = df[df.index >= final_start_date]
            df = df.sort_index().ffill()
            df = apply_market_proxy_backfill(df, asset_metadata)
        else:
            raise Exception("Fallo crítico tras auto-expandir: sin historial común.")

    universe = list(df.columns)
    missing_assets = [a for a in assets_list if a not in universe]
    eq_vec, bd_vec, cs_vec, al_vec, ot_vec, _ = _allocation_vectors(universe, asset_metadata)

    return fetcher, price_data, synthetic_used, df, universe, missing_assets, eq_vec, bd_vec, cs_vec, al_vec, ot_vec

def _build_expected_returns_and_cov(df, universe, asset_metadata, tactical_views):
    """
    FASE 4: Cálculos Cuantitativos Base (Markowitz & Black-Litterman).
    [PRECEDENCIA CANÓNICA] Nivel 5: Tactical Views.
    Altera los expected returns y la covarianza estática según convicciones cualitativas activas.
    """
    mcaps = {}
    for t in universe:
        mcap_val = (asset_metadata or {}).get(t, {}).get("market_cap", 1e9)
        mcaps[t] = float(mcap_val)

    if tactical_views:
        logger.info("👁️ [Optimizer] Tactical Views Detected. Applying Black-Litterman...")
        try:
            from services.quant_core import apply_black_litterman
            valid_views = {k: v for k, v in tactical_views.items() if k in universe}
            if valid_views:
                mu, S = apply_black_litterman(
                    df_prices=df, market_caps=mcaps, views=valid_views
                )
                S = risk_models.fix_nonpositive_semidefinite(S)
            else:
                raise Exception("Valid views empty")
        except Exception as e_bl:
            logger.info(f"⚠️ Black-Litterman Failed: {e_bl}. Fallback to Pairwise Mean/Covariance.")
            mu = get_expected_returns(df, method="mean")
            S = get_covariance_matrix(df)
    else:
        mu = get_expected_returns(df, method="mean")
        S = get_covariance_matrix(df)
        
    return mu, S


def _build_frontier_curve(mu, S):
    """
    FASE 5: Generación de la Frontera Eficiente Teórica (para pintado en UI).
    """
    frontier_points = []
    try:
        cla = CLA(mu, S)
        f_ret, f_vol, _ = cla.efficient_frontier(points=50)
        for v_raw, r_raw in zip(f_vol, f_ret):
            if np.isnan(v_raw) or np.isnan(r_raw):
                continue
            frontier_points.append({"x": round(float(v_raw), 4), "y": round(float(r_raw), 4)})

        if frontier_points:
            frontier_points = sorted(frontier_points, key=lambda p: p["y"])
            min_vol_idx = min(range(len(frontier_points)), key=lambda i: frontier_points[i]["x"])
            efficient_only = []
            current_max_x = -1.0
            for p in frontier_points[min_vol_idx:]:
                if p["x"] >= current_max_x - 1e-5:
                    efficient_only.append(p)
                    current_max_x = max(current_max_x, p["x"])
            frontier_points = efficient_only
    except Exception as e_cla:
        logger.info(f"⚠️ Frontier gen warning: {e_cla}")
        
    return frontier_points


def _apply_standard_constraints(ef_inst, constraints, lock_mode, apply_profile, risk_level_i, locked_assets, fixed_weights, asset_metadata, current_risk_buckets, eq_v, bd_v, cs_v, al_v, ot_v):
    """
    FASE 6: Inyección de Restricciones Efectivas al Solver (PyPortfolioOpt).
    [PRECEDENCIA EFECTIVA EN SOLVER]:
    Toda restricción inyectada aquí es matemáticamente 'dura'. Si hay conflicto, el solver fallará.
    Jerarquía de construcción de constraints:
    - Nivel 1: Locked Assets & Lock Mode (Bloqueos de peso por isin dictan límites precisos)
    - Nivel 4: Restricciones adicionales (Geografías y grupos custom)
    - Nivel 3: Risk Profile Buckets (Bandas permitidas por tipo de activo base)
    """
    universe = ef_inst.tickers
    for isin in locked_assets or []:
        if isin in universe:
            idx = universe.index(isin)

            if lock_mode in ["keep_weight", "keep_money"] and isin in fixed_weights:
                fw_val = float(fixed_weights[isin])
                fw_val = min(max(fw_val, 0.0), 1.0)
                ef_inst.add_constraint(lambda w, i=idx, fw=fw_val: w[i] == fw)
            elif lock_mode == "min_keep" and isin in fixed_weights:
                fw_val = float(fixed_weights[isin])
                fw_val = min(max(fw_val, 0.0), 1.0)
                ef_inst.add_constraint(lambda w, i=idx, fw=fw_val: w[i] >= fw)
            elif lock_mode == "free":
                pass
            else:
                ef_inst.add_constraint(lambda w, i=idx: w[i] >= 0.01)

    if constraints and asset_metadata:
        try:
            eu_target = float((constraints.get("europe", 0.0) or 0.0))
            us_cap = float((constraints.get("americas", 1.0) or 1.0))
            if eu_target > 0 or us_cap < 1.0:
                eu_vec_l = []
                us_vec_l = []
                for t in universe:
                    m = (asset_metadata or {}).get(t, {}) or {}
                    regs = m.get("regions", {}) or {}
                    eu_vec_l.append(_to_float(regs.get("europe", 0.0), 0.0) / 100.0)
                    us_vec_l.append(_to_float(regs.get("americas", 0.0), 0.0) / 100.0)

                if eu_target > 0:
                    eu_vec_np = np.array(eu_vec_l)
                    ef_inst.add_constraint(lambda w: w @ eu_vec_np >= eu_target)
                if us_cap < 1.0:
                    us_vec_np = np.array(us_vec_l)
                    ef_inst.add_constraint(lambda w: w @ us_vec_np <= us_cap)

            emerging_cap = float((constraints.get("emerging", 1.0) or 1.0))
            if apply_profile and risk_level_i <= 3:
                emerging_cap = min(emerging_cap, 0.05)
            if emerging_cap < 1.0:
                em_vec_l = []
                for t in universe:
                    m = (asset_metadata or {}).get(t, {}) or {}
                    regs = m.get("regions", {}) or {}
                    em_vec_l.append(_to_float(regs.get("emerging", 0.0), 0.0) / 100.0)

                em_vec_np = np.array(em_vec_l)
                ef_inst.add_constraint(lambda w: w @ em_vec_np <= emerging_cap)
        except Exception as e_geo:
            logger.info(f"⚠️ Geo Constraint Warning: {e_geo}")

    group_limits = constraints.get("group_limits", {})
    if group_limits and asset_metadata:
        try:
            for group_type, limits in group_limits.items():
                for group_name, bounds in limits.items():
                    min_val = float(bounds.get("min", 0.0))
                    max_val = float(bounds.get("max", 1.0))

                    vec_l = []
                    for t in universe:
                        m = (asset_metadata or {}).get(t, {}) or {}
                        group_data = m.get(group_type, {}) or {}
                        vec_l.append(_to_float(group_data.get(group_name, 0.0), 0.0) / 100.0)

                    vec_np = np.array(vec_l)
                    if min_val > 0.001:
                        ef_inst.add_constraint(lambda w, v=vec_np, m=min_val: w @ v >= m)
                    if max_val < 0.999:
                        ef_inst.add_constraint(lambda w, v=vec_np, m=max_val: w @ v <= m)
        except Exception as e_grp:
            logger.info(f"⚠️ Generic Group Constraint Warning: {e_grp}")

    if apply_profile and risk_level_i in current_risk_buckets:
        bucket_cfg = current_risk_buckets[risk_level_i]
        if "RV" in bucket_cfg:
            ef_inst.add_constraint(lambda w: w @ eq_v >= bucket_cfg["RV"][0])
            ef_inst.add_constraint(lambda w: w @ eq_v <= bucket_cfg["RV"][1])
        if "RF" in bucket_cfg:
            ef_inst.add_constraint(lambda w: w @ bd_v >= bucket_cfg["RF"][0])
            ef_inst.add_constraint(lambda w: w @ bd_v <= bucket_cfg["RF"][1])
        if "Monetario" in bucket_cfg:
            ef_inst.add_constraint(lambda w: w @ cs_v >= bucket_cfg["Monetario"][0])
            ef_inst.add_constraint(lambda w: w @ cs_v <= bucket_cfg["Monetario"][1])
        if "Alternativos" in bucket_cfg:
            ef_inst.add_constraint(lambda w: w @ al_v >= bucket_cfg["Alternativos"][0])
            ef_inst.add_constraint(lambda w: w @ al_v <= bucket_cfg["Alternativos"][1])
        if "Otros" in bucket_cfg:
            ef_inst.add_constraint(lambda w: w @ ot_v >= bucket_cfg["Otros"][0])
            ef_inst.add_constraint(lambda w: w @ ot_v <= bucket_cfg["Otros"][1])

def _check_feasibility_and_autoexpand(
    db, fetcher, price_data, universe, assets_list, apply_profile, equity_floor, max_weight, 
    eq_vec, locked_assets, constraints, asset_metadata, min_weight, gamma,
    bd_vec, cs_vec, al_vec, ot_vec, lock_mode, risk_level_i, fixed_weights, current_risk_buckets
):
    """
    FASE 7: Predicción de Factibilidad (Floor Checks).
    [LEGADO]: Incluye lógica de inyección de fondos de alta RV si no se cumple el equity floor.
    """
    added_assets = []
    solver_path = None
    ef = None
    mu = None
    S = None
    
    if apply_profile and equity_floor > 0:
        achieved_equity = 0.0
        current_budget = 1.0
        processed = set()

        for isin in locked_assets:
            if isin in universe:
                idx = universe.index(isin)
                w = max(0.03, min(max_weight, 1.0))
                achieved_equity += w * eq_vec[idx]
                current_budget -= w
                processed.add(idx)

        sorted_eq = np.argsort(eq_vec)[::-1]
        for idx in sorted_eq:
            if idx in processed:
                continue
            space = min(max_weight, current_budget)
            if space <= 1e-4:
                break
            achieved_equity += space * eq_vec[idx]
            current_budget -= space

        if achieved_equity + 0.005 < equity_floor:
            auto_expand = constraints.get("auto_expand_universe", False)
            if not auto_expand:
                return False, {
                    "api_version": "optimizer_v4",
                    "status": "infeasible_equity_floor",
                    "solver_path": "blocked_infeasible",
                    "feasibility": {"requested": equity_floor, "achievable": round(achieved_equity, 4)},
                    "weights": {},
                    "warnings": [f"Equity Floor {equity_floor} Unachievable"],
                }, None, None, None, None, None, None, None, None, None, None, None

            logger.info("⚠️ Auto-Expanding Universe...")
            candidates_list = []
            try:
                docs = (
                    db.collection("funds_v3")
                    .order_by("std_perf.sharpe", direction=firestore.Query.DESCENDING)
                    .limit(50)
                    .stream()
                )
                for d in docs:
                    dd = d.to_dict()
                    exp_v2 = dd.get("portfolio_exposure_v2", {})
                    eq_val = _to_float(exp_v2.get("equity", 0.0)) if exp_v2 else _to_float(dd.get("metrics", {}).get("equity"), 0.0)
                    if eq_val >= 90.0:
                        candidates_list.append(d.id)
            except Exception:
                pass

            if not candidates_list:
                candidates_list = FALLBACK_CANDIDATES_DEFAULT

            valid_added = []
            seen = set(universe) | set(assets_list)
            potential = [c for c in candidates_list if c not in seen]
            if potential:
                p_check, _ = fetcher.get_price_data(potential, resample_freq="D", strict=True)
                for isin, p_s in p_check.items():
                    if len(p_s) >= 20:
                        valid_added.append(isin)

            if not valid_added:
                return False, {
                    "api_version": "optimizer_v4",
                    "status": "auto_expand_failed",
                    "weights": {},
                }, None, None, None, None, None, None, None, None, None, None, None

            added_assets = valid_added[:6]
            price_data.update({k: p_check[k] for k in added_assets})

            for isin in added_assets:
                d = db.collection("funds_v3").document(isin).get()
                if d.exists:
                    dd = d.to_dict()
                    asset_metadata[isin] = {
                        "metrics": dd.get("metrics", {}),
                        "asset_class": dd.get("asset_class"),
                        "classification_v2": dd.get("classification_v2", {}),
                        "portfolio_exposure_v2": dd.get("portfolio_exposure_v2", {}),
                    }

            df = pd.DataFrame(price_data).sort_index().ffill()
            universe = list(df.columns)
            mu = get_expected_returns(df, method="ema")
            S = get_covariance_matrix(df)
            eq_vec, bd_vec, cs_vec, al_vec, ot_vec, _ = _allocation_vectors(universe, asset_metadata)

            ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
            if constraints.get("objective") != "min_deviation":
                ef.add_objective(objective_functions.L2_reg, gamma=gamma)
            
            _apply_standard_constraints(
                ef, constraints, lock_mode, apply_profile, risk_level_i, locked_assets, 
                fixed_weights, asset_metadata, current_risk_buckets, eq_vec, bd_vec, cs_vec, al_vec, ot_vec
            )
            solver_path = "auto_expand_then_solve"
            
    return True, {}, added_assets, solver_path, ef, mu, S, universe, eq_vec, bd_vec, cs_vec, al_vec, ot_vec

def _run_solver(ef, mu, S, constraints, risk_level_i, rf_rate, max_weight, gamma, apply_profile, universe):
    """
    FASE 8: Ejecución Matemática Final.
    [PRECEDENCIA CANÓNICA] Nivel 6: Objetivo del Solver.
    Manda el 'objective' (max_sharpe, etc.). Si las constraints de Niveles 1, 3 o 4 
    impiden la convergencia del solver, salta la excepción hacia Nivel 7.
    """
    solver_path = None
    raw_weights = None
    
    try:
        if constraints.get("objective") == "min_deviation":
            solver_path = "min_deviation_custom"
            import cvxpy as cp
            target_dict = constraints.get("target_weights", {})
            target_arr = np.array([target_dict.get(t, 0.0) for t in universe])

            def tracking_error_objective(w, w_target):
                return cp.sum_squares(w - w_target)

            raw_weights = ef.convex_objective(tracking_error_objective, w_target=target_arr)
        elif apply_profile:
            target_vol = float(RISK_TARGETS.get(risk_level_i, 0.05))
            solver_path = f"efficient_risk_profile_{target_vol:.3f}"
            raw_weights = ef.efficient_risk(target_vol)
        elif constraints.get("objective") == "max_sharpe":
            solver_path = "max_sharpe_custom"
            raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
        else:
            base_target = float(RISK_TARGETS.get(risk_level_i, 0.05))
            target_vol = base_target + 0.015
            solver_path = f"efficient_risk_{target_vol:.3f}"
            raw_weights = ef.efficient_risk(target_vol)
    except Exception as e1:
        logger.info(f"⚠️ Optimization Failed: {e1}. Trying Relaxed Fallbacks...")
        try:
            logger.info("⚠️ Fallback 1: Relaxed Sharpe")
            ef_relaxed = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
            ef_relaxed.add_objective(objective_functions.L2_reg, gamma=gamma)
            raw_weights = ef_relaxed.max_sharpe(risk_free_rate=rf_rate)
            ef = ef_relaxed
            solver_path = "fallback_relaxed_sharpe"
        except Exception:
            try:
                logger.info("⚠️ Fallback 2: Min Volatility")
                ef_minvol = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
                raw_weights = ef_minvol.min_volatility()
                ef = ef_minvol
                solver_path = "fallback_min_vol"
            except Exception as e_crit:
                logger.info(f"❌ ALL PATHS FAILED: {e_crit}")
                solver_path = "fallback_equal_weight"
                raw_weights = None
                
    return ef, raw_weights, solver_path


def _postprocess_weights(ef, raw_weights, cutoff, universe, apply_profile, risk_level_i, current_risk_buckets, eq_vec, bd_vec, cs_vec, al_vec, ot_vec, lock_mode, locked_assets, fixed_weights):
    """
    FASE 9: Limpieza, Degradación Graciosa y Asignación Final.
    [PRECEDENCIA CANÓNICA] Nivel 7: Fallbacks / Degradaciones.
    Si falló el solver, entramos en fallback asumiendo pesos equitativos PONDERADOS:
    - Conserva Nivel 3 (Filtro por Risk Buckets lógicos).
    - Conserva Nivel 1 (Locked Assets mantienen su peso hardcoded).
    - Se pierden Nivel 4 y Nivel 5.
    """
    weights = {}
    if raw_weights is not None:
        cleaned = ef.clean_weights(cutoff=cutoff)
        weights = _normalize({t: float(cleaned.get(t, 0.0)) for t in universe})
    else:
        logger.info("⚠️ Applying Graceful Degradation (Filtered Equal-Weight)")
        allowed_universe = []

        if apply_profile and risk_level_i in current_risk_buckets:
            bucket_cfg = current_risk_buckets[risk_level_i]
            for idx, isin in enumerate(universe):
                is_eq = eq_vec[idx] > 0
                is_bd = bd_vec[idx] > 0
                is_cs = cs_vec[idx] > 0

                allowed = False
                if is_eq and "RV" in bucket_cfg and bucket_cfg["RV"][1] > 0: allowed = True
                elif is_bd and "RF" in bucket_cfg and bucket_cfg["RF"][1] > 0: allowed = True
                elif (is_cs and "Monetario" in bucket_cfg and bucket_cfg["Monetario"][1] > 0): allowed = True
                elif (al_vec[idx] > 0 and "Alternativos" in bucket_cfg and bucket_cfg["Alternativos"][1] > 0): allowed = True
                elif "Otros" in bucket_cfg and bucket_cfg["Otros"][1] > 0: allowed = True

                if allowed: allowed_universe.append(isin)
        else:
            allowed_universe = universe

        if not allowed_universe:
            allowed_universe = universe

        remaining_budget = 1.0
        if lock_mode in ["keep_weight", "keep_money", "min_keep"]:
            for t in universe:
                if t in (locked_assets or []):
                    fw = min(1.0, max(0.0, float(fixed_weights.get(t, 0.0))))
                    weights[t] = fw
                    remaining_budget -= fw
                    allowed_universe = [a for a in allowed_universe if a != t]

        remaining_budget = max(0.0, remaining_budget)
        w_fallback = remaining_budget / max(1, len(allowed_universe))
        
        for t in universe:
            if t not in weights:
                weights[t] = w_fallback if t in allowed_universe else 0.0

        weights = _normalize(weights)
        
    return weights


# =========================================================================
# MAIN PUBLIC API
# =========================================================================

def run_optimization(
    assets_list,
    risk_level,
    db,
    constraints=None,
    asset_metadata=None,
    locked_assets=None,
    tactical_views=None,
):
    """Optimizer v4.2 (Institutional: Hard Cutoff + Black-Litterman)"""
    constraints = constraints or {}
    asset_metadata = asset_metadata or {}
    locked_assets = locked_assets or []
    logger.info(f"📥 [Optimizer] Risk: {risk_level}, Assets: {len(assets_list)}, Meta: {len(asset_metadata)}")

    try:
        # FASE 1: Contexto Global
        (apply_profile, optimization_mode, lock_mode, fixed_weights, 
         current_risk_buckets, equity_floor, bond_cap, cash_cap) = _build_optimization_context(db, constraints)

        # FASE 2: Suitability Filter
        assets_list = _apply_suitability_filter(assets_list, asset_metadata, risk_level, apply_profile, locked_assets)

        # FASE 3: Universe Construction (Price Data & Expansions)
        (fetcher, price_data, synthetic_used, df, universe, missing_assets, 
         eq_vec, bd_vec, cs_vec, al_vec, ot_vec) = _build_candidate_universe(db, assets_list, asset_metadata, constraints)

        # FASE 4: Returns & Covariances (Markowitz & BL)
        mu, S = _build_expected_returns_and_cov(df, universe, asset_metadata, tactical_views)
        
        # FASE 5: Efficient Frontier Reference
        frontier_points = _build_frontier_curve(mu, S)
        
        # Setup Constants
        rf_rate = float(fetcher.get_dynamic_risk_free_rate())
        max_weight = float(constraints.get("max_weight", MAX_WEIGHT_DEFAULT))
        min_weight = float(constraints.get("min_weight", 0.0))
        cutoff = float(CUTOFF_DEFAULT)
        risk_level_i = int(risk_level)
        n_assets = len(universe)
        gamma = 1.0 if n_assets < 10 else (2.0 if n_assets <= 25 else 3.0)

        # Main Base Solver Instantiation
        ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
        objective = constraints.get("objective", "max_sharpe")
        if objective != "min_deviation":
            ef.add_objective(objective_functions.L2_reg, gamma=gamma)
            
        # FASE 6: Constraints Injection
        _apply_standard_constraints(
            ef, constraints, lock_mode, apply_profile, risk_level_i, locked_assets, 
            fixed_weights, asset_metadata, current_risk_buckets, 
            eq_vec, bd_vec, cs_vec, al_vec, ot_vec
        )
        
        # FASE 7: Feasibility & Auto-Expand Check
        (is_feasible, infeasible_ret_obj, added_assets, solver_path_override, 
         ef_override, mu_override, S_override, universe_override, 
         eq_vec_override, bd_vec_override, cs_vec_override, al_vec_override, ot_vec_override
        ) = _check_feasibility_and_autoexpand(
            db, fetcher, price_data, universe, assets_list, apply_profile, equity_floor, max_weight, 
            eq_vec, locked_assets, constraints, asset_metadata, min_weight, gamma,
            bd_vec, cs_vec, al_vec, ot_vec, lock_mode, risk_level_i, fixed_weights, current_risk_buckets
        )
        
        if not is_feasible:
            return infeasible_ret_obj
            
        if solver_path_override:
            solver_path = solver_path_override
            ef = ef_override
            mu = mu_override
            S = S_override
            universe = universe_override
            eq_vec, bd_vec, cs_vec, al_vec, ot_vec = eq_vec_override, bd_vec_override, cs_vec_override, al_vec_override, ot_vec_override
        else:
            solver_path = None
            
        # FASE 8: Final Mathematical Run
        if not solver_path or solver_path == "auto_expand_then_solve":
            ef, raw_weights, solver_path = _run_solver(
                ef, mu, S, constraints, risk_level_i, rf_rate, max_weight, gamma, apply_profile, universe
            )
        else:
            raw_weights = None

        # FASE 9: Post-Processing & Normalization
        weights = _postprocess_weights(
            ef, raw_weights, cutoff, universe, apply_profile, risk_level_i, current_risk_buckets, 
            eq_vec, bd_vec, cs_vec, al_vec, ot_vec, lock_mode, locked_assets, fixed_weights
        )

        # FASE 10: Formatting Metrics & Output
        metrics_dict = calculate_portfolio_metrics(weights, mu, S, rf_rate)
        port_ret = metrics_dict["return"]
        port_vol = metrics_dict["volatility"]
        port_sharpe = metrics_dict["sharpe"]
        portfolio_point = {"x": round(port_vol, 4), "y": round(port_ret, 4)}

        w_arr = np.array([weights.get(t, 0.0) for t in universe])
        eq_total = float(w_arr @ eq_vec)
        bd_total = float(w_arr @ bd_vec)
        cs_total = float(w_arr @ cs_vec)
        al_total = float(w_arr @ al_vec)
        ot_total = float(w_arr @ ot_vec)
        s_sum = eq_total + bd_total + cs_total + al_total + ot_total
        if s_sum > 0:
            eq_total, bd_total, cs_total, al_total, ot_total = (
                eq_total/s_sum, bd_total/s_sum, cs_total/s_sum, al_total/s_sum, ot_total/s_sum,
            )

        requested = []
        seen = set()
        for a in assets_list:
            if a not in seen:
                requested.append(a)
                seen.add(a)
        weights_full = {a: float(weights.get(a, 0.0)) if a in universe else 0.0 for a in requested}

        binding_constraints = []
        if apply_profile: binding_constraints.append(f"Risk Profile ({risk_level_i}) caps applied")
        if locked_assets: binding_constraints.append(f"{len(locked_assets)} locked assets maintained")
        if (constraints and (float(constraints.get("europe", 0.0) or 0.0) > 0 or float(constraints.get("americas", 1.0) or 1.0) < 1.0)):
            binding_constraints.append("Geographic limits applied")
        if apply_profile and risk_level_i <= 3: binding_constraints.append("Emerging markets capped at 5%")

        profile_limits = current_risk_buckets.get(risk_level_i, {}) if apply_profile else {}

        explainability = {
            "apply_profile": apply_profile,
            "optimization_mode": optimization_mode,
            "lock_mode": lock_mode,
            "profile_limits": profile_limits,
            "applied_views": bool(tactical_views),
            "locked_assets_count": len(locked_assets or []),
            "fixed_weights_applied": list(fixed_weights.keys()),
            "primary_objective": str(objective) if "objective" in locals() else "max_sharpe",
            "solver_fallback_used": solver_path.startswith("fallback_") if solver_path else False,
            "binding_constraints": binding_constraints,
        }

        return {
            "api_version": "optimizer_v4",
            "mode": "PROFILE_B_AGGRESSIVE" if apply_profile else "PROFILE_A",
            "status": "optimal" if raw_weights is not None else "fallback",
            "solver_path": solver_path,
            "added_assets": added_assets,
            "used_assets": universe,
            "missing_assets": missing_assets,
            "portfolio_allocation": {
                "RV": eq_total, "RF": bd_total, "Monetario": cs_total,
                "Alternativos": al_total, "Otros": ot_total,
            },
            "weights": weights_full,
            "metrics": {
                "return": port_ret, "volatility": port_vol, "sharpe": port_sharpe,
                "rf_rate": rf_rate, "portfolio": portfolio_point,
            },
            "frontier": frontier_points,
            "portfolio": portfolio_point,
            "explainability": explainability,
            "warnings": [],
        }

    except Exception as e:
        logger.info(f"❌ Critical Error: {e}")
        return {"api_version": "optimizer_v4", "status": "error", "message": str(e)}
