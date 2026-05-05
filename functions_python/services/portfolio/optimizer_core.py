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
    extract_v2_identity,
    get_effective_asset_mix,
    get_effective_group_map,
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


def _sanitize_fraction(value, default=0.0):
    """
    Normaliza valores de exposiciÃ³n a escala 0..1.
    Acepta tanto decimal (0..1) como porcentaje (0..100).
    """
    val = _to_float(value, default)
    if val > 1.0:
        val = val / 100.0
    return max(0.0, min(1.0, val))


def _extract_bucket_exposure_from_meta(meta):
    """Delegated to V2-first implementation. Legacy body removed (was dead code)."""
    return _extract_bucket_exposure_from_meta_v2(meta)




def _extract_bucket_exposure_from_meta_v2(meta):
    """V2-first bucket exposure reader used by the optimizer runtime."""
    mix = get_effective_asset_mix(meta)
    if mix:
        return {
            "equity": mix.get("equity", 0.0),
            "bond": mix.get("bond", 0.0),
            "cash": mix.get("cash", 0.0),
            "alternative": mix.get("alternative", 0.0),
            "real_asset": mix.get("real_asset", 0.0),
            "other": mix.get("other", 0.0),
        }

    asset_type = extract_v2_identity(meta).get("asset_type")
    if asset_type == "equity":
        return {"equity": 1.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    if asset_type == "fixed_income":
        return {"equity": 0.0, "bond": 1.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    if asset_type == "money_market":
        return {"equity": 0.0, "bond": 0.0, "cash": 1.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    if asset_type == "alternative":
        return {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 1.0, "real_asset": 0.0, "other": 0.0}
    if asset_type in {"real_asset", "commodities"}:
        return {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 1.0, "other": 0.0}
    return {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 1.0}


def _build_exposure_vectors(universe, asset_metadata):
    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = [], [], [], [], [], []
    for isin in universe:
        b = _extract_bucket_exposure_from_meta_v2((asset_metadata or {}).get(isin, {}))
        eq_v.append(b["equity"])
        bd_v.append(b["bond"])
        cs_v.append(b["cash"])
        al_v.append(b["alternative"])
        ra_v.append(b["real_asset"])
        ot_v.append(b["other"])
    return (
        np.array(eq_v),
        np.array(bd_v),
        np.array(cs_v),
        np.array(al_v),
        np.array(ra_v),
        np.array(ot_v),
    )


def _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v):
    return {
        "RV": eq_v,
        "RF": bd_v,
        "Monetario": cs_v,
        "Alternativos": al_v + ra_v,
        "Otros": ot_v,
    }


def _lookup_group_weight(group_data, group_name):
    if not isinstance(group_data, dict) or not group_data:
        return 0.0

    raw = str(group_name or "").strip()
    token = raw.replace("-", "_").replace(" ", "_")
    candidates = [raw, raw.lower(), raw.upper(), token, token.lower(), token.upper()]
    for key in candidates:
        if key in group_data:
            return _sanitize_fraction(group_data.get(key), 0.0)
    return 0.0


def _build_group_vector(universe, asset_metadata, group_type, group_name):
    vec_l = []
    for isin in universe:
        meta = (asset_metadata or {}).get(isin, {}) or {}
        group_data = get_effective_group_map(meta, group_type, as_percent=False)
        vec_l.append(_lookup_group_weight(group_data, group_name))
    return np.array(vec_l)


def _read_bound(raw):
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return _sanitize_fraction(raw[0]), _sanitize_fraction(raw[1])
    if isinstance(raw, dict):
        min_v = raw.get("min")
        max_v = raw.get("max")
        return (
            _sanitize_fraction(min_v) if min_v is not None else None,
            _sanitize_fraction(max_v) if max_v is not None else None,
        )
    return None, None

# =========================================================================
# INTERNAL PIPELINE HELPERS
# =========================================================================

def _build_optimization_context(db, constraints):
    """
    FASE 1: ConstrucciÃ³n de contexto y polÃ­ticas base.
    [PRECEDENCIA]: Firestore (risk_profiles) manda sobre todo lo demÃ¡s.
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
            logger.info("âš¡ [Optimizer] Cargados perfiles de riesgo desde Firestore")
        else:
            logger.info("âš ï¸ [Optimizer] Perfiles no encontrados en DB. Auto-inicializando...")
            db_save = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
            db.collection("system_settings").document("risk_profiles").set(db_save)
            current_risk_buckets = RISK_BUCKETS_LABELS
    except Exception as e:
        logger.info(f"âš ï¸ [Optimizer] Fallo al leer perfiles de riesgo: {e}. Usando locales.")
        current_risk_buckets = RISK_BUCKETS_LABELS

    equity_floor = float(constraints.get("equity_floor", 0.0))
    bond_cap = float(constraints.get("bond_cap", 1.0))
    cash_cap = float(constraints.get("cash_cap", 1.0))

    return apply_profile, optimization_mode, lock_mode, fixed_weights, current_risk_buckets, equity_floor, bond_cap, cash_cap


def _apply_suitability_filter(assets_list, asset_metadata, risk_level, apply_profile, locked_assets):
    """
    FASE 2: Suitability Hard Filter.
    [PRECEDENCIA CANÃ“NICA] Nivel 2: Filtro Regulador Excluyente.
    [CORRECCIÃ“N DE PRECEDENCIA]: El Nivel 1 (Locked Assets) prevalece explÃ­citamente.
    Si el usuario fuerza/bloquea un activo manual, se salta el filtro de idoneidad local.
    """
    if not apply_profile:
        return assets_list

    filtered_list = []
    locked_set = set(locked_assets or [])
    for isin in assets_list:
        if isin in locked_set:
            logger.info(f"ðŸ”“ [Suitability Override] {isin} mantenido por Nivel 1 (Locked Asset).")
            filtered_list.append(isin)
            continue
            
        meta = asset_metadata.get(isin, {})
        eligible, reason = is_fund_eligible_for_profile(meta, int(risk_level))
        if eligible:
            filtered_list.append(isin)
        else:
            logger.info(f"ðŸš« [Suitability Excluded] {isin}: {reason}")
    return filtered_list

def _build_candidate_universe(db, assets_list, asset_metadata, constraints, candidate_funds=None, locked_assets=None):
    """
    FASE 3: Historico de Datos y ExpansiÃ³n BÃ¡sica.
    [LEGADO]: Incluye lÃ³gica de auto-expandir basada en base de datos si fallan historiales.
    """
    fetcher = DataFetcher(db)
    price_data, synthetic_used = fetcher.get_price_data(
        assets_list, resample_freq="D", strict=False
    )

    df = pd.DataFrame(price_data)
    df.index = pd.to_datetime(df.index)

    target_years = 5
    ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * target_years) if not df.empty else None

    if not df.empty:
        df = df.sort_index()

        # Hardening: Exclude unviable assets before finding common window (P1)
        min_obs_auto = 756  # 3 years approx
        min_obs_locked = 60 # strict math minimum
        locked_set = set(locked_assets or [])
        
        valid_counts = df.count()
        to_drop = []
        for col, count in valid_counts.items():
            if col in locked_set:
                if count < min_obs_locked:
                    to_drop.append(col)
            else:
                if count < min_obs_auto:
                    to_drop.append(col)

        if to_drop:
            logger.warning(f"âš ï¸ [Optimizer] Excluyendo activos por historial insuficiente (auto<{min_obs_auto}, locked<{min_obs_locked}): {to_drop}")
            df = df.drop(columns=to_drop)

        first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
        if not first_valid_indices.empty:
            actual_start_date = first_valid_indices.max()
            final_start_date = max(ideal_start_date, actual_start_date)
        else:
            final_start_date = ideal_start_date
            
        df = df[df.index >= final_start_date]
        logger.info(
            f"â„¹ï¸ Optimization Strict Window: {final_start_date.date()} to {df.index[-1].date()} ({(df.index[-1] - final_start_date).days} days)"
        )
        df = df.ffill(limit=5)
        
        # Hardening: Check for excessive internal gaps
        if not df.empty:
            gap_threshold = len(df) * 0.05
            cols_to_drop = []
            for col in df.columns:
                missing_count = df[col].isnull().sum()
                if missing_count > gap_threshold:
                    logger.warning(f"âš ï¸ [Optimizer] Excluyendo serie {col} por {missing_count} huecos internos (>{gap_threshold:.0f}) tras suavizado.")
                    cols_to_drop.append(col)
                    
            if cols_to_drop:
                df = df.drop(columns=cols_to_drop)
                
        df = df.dropna()
    else:
        logger.info(
            "âš ï¸ No valid data found for any asset. Falling back to strict inner join..."
        )
        df = df.dropna()

    if df.empty or len(df) < 60:
        auto_expand = constraints.get("auto_expand_universe", False)

        if not auto_expand:
            logger.info(
                "âš ï¸ Insufficient history. Aborting and returning recovery candidates..."
            )
            if candidate_funds:
                candidates_list = list(candidate_funds.keys())
            else:
                candidates_list = FALLBACK_CANDIDATES_DEFAULT

            raise ValueError(f"INFEASIBLE_HISTORY:{','.join(candidates_list[:5])}")

        logger.info("âš ï¸ Auto-expanding due to missing history...")
        if candidate_funds:
            candidates_list = list(candidate_funds.keys())
        else:
            candidates_list = FALLBACK_CANDIDATES_DEFAULT

        valid_cands, _ = fetcher.get_price_data(candidates_list, resample_freq="D", strict=True)
        valid_cands_sorted = sorted(valid_cands.items(), key=lambda x: len(x[1]), reverse=True)
        for isin, p_series in valid_cands_sorted:
            if len(p_series) >= 756:
                price_data[isin] = p_series

        if not price_data:
            raise Exception("No se encontraron suficientes datos histÃ³ricos ni siquiera auto-expandiendo el universo.")

        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)

        ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * 5)
        first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()

        if not first_valid_indices.empty:
            actual_start_date = first_valid_indices.max()
            final_start_date = max(ideal_start_date, actual_start_date)
            df = df[df.index >= final_start_date]
            df = df.sort_index().ffill(limit=5).dropna()
        else:
            raise Exception("No fue posible alinear un tramo histÃ³rico comÃºn vÃ¡lido tras la expansiÃ³n del universo.")

    universe = list(df.columns)
    missing_assets = [a for a in assets_list if a not in universe]
    eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec = _build_exposure_vectors(universe, asset_metadata)

    return fetcher, price_data, synthetic_used, df, universe, missing_assets, eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec

def _build_expected_returns_and_cov(df, universe, asset_metadata, tactical_views):
    """
    FASE 4: CÃ¡lculos Cuantitativos Base (Markowitz & Black-Litterman).
    [PRECEDENCIA CANÃ“NICA] Nivel 5: Tactical Views.
    Altera los expected returns y la covarianza estÃ¡tica segÃºn convicciones cualitativas activas.
    """
    mcaps = {}
    for t in universe:
        mcap_val = (asset_metadata or {}).get(t, {}).get("market_cap", 1e9)
        mcaps[t] = float(mcap_val)

    if tactical_views:
        logger.info("ðŸ‘ï¸ [Optimizer] Tactical Views Detected. Applying Black-Litterman...")
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
            logger.info(f"âš ï¸ Black-Litterman Failed: {e_bl}. Fallback to Pairwise Mean/Covariance.")
            mu = get_expected_returns(df, method="mean")
            S = get_covariance_matrix(df)
    else:
        mu = get_expected_returns(df, method="mean")
        S = get_covariance_matrix(df)
        
    return mu, S


def _build_frontier_curve(mu, S):
    """
    FASE 5: GeneraciÃ³n de la Frontera Eficiente TeÃ³rica (para pintado en UI).
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
        logger.info(f"âš ï¸ Frontier gen warning: {e_cla}")
        
    return frontier_points


def _reconcile_bucket_vs_profile(bucket_bounds_v1, current_risk_buckets, risk_level_i):
    """
    Pre-solver validation: detects contradictions between bucket_bounds_v1
    and the Risk Profile and relaxes the profile bound to avoid CVXPY infeasibility.
    Returns a (possibly modified) copy of current_risk_buckets.
    """
    import copy
    buckets = copy.deepcopy(current_risk_buckets)
    profile_cfg = buckets.get(risk_level_i, {})
    if not profile_cfg:
        return buckets

    # Mapping: bucket_bounds_v1 key -> profile bucket name(s) it overlaps with
    v1_to_profile = {
        "equity": "RV",
        "bond": "RF",
        "cash": "Monetario",
        "alternative": "Alternativos",
        "real_asset": "Alternativos",
        "other": "Otros",
    }

    for v1_key, profile_key in v1_to_profile.items():
        v1_bound = bucket_bounds_v1.get(v1_key)
        if v1_bound is None:
            continue
        v1_min, v1_max = _read_bound(v1_bound)
        p_min, p_max = _read_bound(profile_cfg.get(profile_key))

        relaxed = False
        # Contradiction: v1 requires a minimum above profile's maximum
        if v1_min is not None and p_max is not None and v1_min > p_max + 1e-6:
            logger.warning(
                f"⚠️ [Reconcile] bucket_bounds_v1.{v1_key}.min={v1_min:.3f} > "
                f"Risk Profile.{profile_key}.max={p_max:.3f}. "
                f"Relaxing profile max to {v1_min:.3f} to avoid infeasibility."
            )
            p_max = v1_min
            relaxed = True

        # Contradiction: v1 caps below profile's minimum
        if v1_max is not None and p_min is not None and v1_max < p_min - 1e-6:
            logger.warning(
                f"⚠️ [Reconcile] bucket_bounds_v1.{v1_key}.max={v1_max:.3f} < "
                f"Risk Profile.{profile_key}.min={p_min:.3f}. "
                f"Relaxing profile min to {v1_max:.3f} to avoid infeasibility."
            )
            p_min = v1_max
            relaxed = True

        if relaxed:
            profile_cfg[profile_key] = {"min": p_min, "max": p_max}

    buckets[risk_level_i] = profile_cfg
    return buckets


def _apply_standard_constraints(
    ef_inst,
    constraints,
    lock_mode,
    apply_profile,
    risk_level_i,
    locked_assets,
    fixed_weights,
    asset_metadata,
    current_risk_buckets,
    eq_v,
    bd_v,
    cs_v,
    al_v,
    ra_v,
    ot_v,
    bucket_bounds_v1=None,
):
    """
    FASE 6: InyecciÃ³n de Restricciones Efectivas al Solver (PyPortfolioOpt).
    [PRECEDENCIA EFECTIVA EN SOLVER]:
    Toda restricciÃ³n inyectada aquÃ­ es matemÃ¡ticamente 'dura'. Si hay conflicto, el solver fallarÃ¡.
    JerarquÃ­a de construcciÃ³n de constraints:
    - Nivel 1: Locked Assets & Lock Mode (Bloqueos de peso por isin dictan lÃ­mites precisos)
    - Nivel 4: Restricciones adicionales (GeografÃ­as y grupos custom)
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

    # Canonical constraints_v1 bucket bounds (applied sobre exposure_v2 agregado).
    _v1_has_active_bounds = False
    if isinstance(bucket_bounds_v1, dict):
        vector_map = {
            "equity": eq_v,
            "bond": bd_v,
            "cash": cs_v,
            "alternative": al_v,
            "real_asset": ra_v,
            "other": ot_v,
        }
        for bucket_key, vec in vector_map.items():
            b_min, b_max = _read_bound(bucket_bounds_v1.get(bucket_key))
            if b_min is not None and b_min > 1e-6:
                ef_inst.add_constraint(lambda w, v=vec, m=b_min: w @ v >= m)
                _v1_has_active_bounds = True
            if b_max is not None and b_max < 1.0 - 1e-6:
                ef_inst.add_constraint(lambda w, v=vec, m=b_max: w @ v <= m)
                _v1_has_active_bounds = True

    if constraints and asset_metadata:
        try:
            eu_target = _sanitize_fraction((constraints.get("europe", 0.0) or 0.0))
            us_cap = _sanitize_fraction((constraints.get("americas", 1.0) or 1.0), 1.0)
            if eu_target > 0 or us_cap < 1.0:
                eu_vec_np = _build_group_vector(universe, asset_metadata, "regions", "europe")
                us_vec_np = _build_group_vector(universe, asset_metadata, "regions", "americas")

                if eu_target > 0:
                    ef_inst.add_constraint(lambda w: w @ eu_vec_np >= eu_target)
                if us_cap < 1.0:
                    ef_inst.add_constraint(lambda w: w @ us_vec_np <= us_cap)

            emerging_cap = _sanitize_fraction((constraints.get("emerging", 1.0) or 1.0), 1.0)
            if apply_profile and risk_level_i <= 3:
                emerging_cap = min(emerging_cap, 0.05)
            if emerging_cap < 1.0:
                em_vec_np = _build_group_vector(universe, asset_metadata, "regions", "emerging")
                ef_inst.add_constraint(lambda w: w @ em_vec_np <= emerging_cap)
        except Exception as e_geo:
            logger.info(f"âš ï¸ Geo Constraint Warning: {e_geo}")

    group_limits = constraints.get("group_limits", {})
    if group_limits and asset_metadata:
        try:
            for group_type, limits in group_limits.items():
                for group_name, bounds in limits.items():
                    min_val, max_val = _read_bound(bounds)
                    vec_np = _build_group_vector(universe, asset_metadata, group_type, group_name)
                    if min_val is not None and min_val > 0.001:
                        ef_inst.add_constraint(lambda w, v=vec_np, m=min_val: w @ v >= m)
                    if max_val is not None and max_val < 0.999:
                        ef_inst.add_constraint(lambda w, v=vec_np, m=max_val: w @ v <= m)
        except Exception as e_grp:
            logger.info(f"âš ï¸ Generic Group Constraint Warning: {e_grp}")

    if apply_profile and risk_level_i in current_risk_buckets and not _v1_has_active_bounds:
        bucket_cfg = current_risk_buckets[risk_level_i]
        profile_vectors = _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)
        for bucket_name, vec in profile_vectors.items():
            min_val, max_val = _read_bound(bucket_cfg.get(bucket_name))
            if min_val is not None:
                ef_inst.add_constraint(lambda w, v=vec, m=min_val: w @ v >= m)
            if max_val is not None:
                ef_inst.add_constraint(lambda w, v=vec, m=max_val: w @ v <= m)
    elif apply_profile and _v1_has_active_bounds:
        logger.info("ℹ️ [Optimizer] Profile bucket constraints SKIPPED: bucket_bounds_v1 already active")

def _check_feasibility_and_autoexpand(
    db, fetcher, price_data, universe, assets_list, apply_profile, equity_floor, max_weight, 
    eq_vec, locked_assets, constraints, asset_metadata, min_weight, gamma,
    bd_vec, cs_vec, al_vec, ra_vec, ot_vec, lock_mode, risk_level_i, fixed_weights, current_risk_buckets,
    candidate_funds=None, bucket_bounds_v1=None
):
    """
    FASE 7: PredicciÃ³n de Factibilidad (Floor Checks).
    [LEGADO]: Incluye lÃ³gica de inyecciÃ³n de fondos de alta RV si no se cumple el equity floor.
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
                }, None, None, None, None, None, None, None, None, None, None, None, None

            logger.info("âš ï¸ Auto-Expanding Universe...")
            if candidate_funds:
                candidates_list = list(candidate_funds.keys())
            else:
                candidates_list = FALLBACK_CANDIDATES_DEFAULT

            valid_added = []
            seen = set(universe) | set(assets_list)
            potential = [c for c in candidates_list if c not in seen]
            if potential:
                p_check, _ = fetcher.get_price_data(potential, resample_freq="D", strict=True)
                valid_added_with_len = []
                for isin, p_s in p_check.items():
                    if len(p_s) >= 756:
                        valid_added_with_len.append((isin, len(p_s)))
                
                # Sort by history length descending to prefer 5+ years
                valid_added = [isin for isin, _ in sorted(valid_added_with_len, key=lambda x: x[1], reverse=True)]

            if not valid_added:
                return False, {
                    "api_version": "optimizer_v4",
                    "status": "auto_expand_failed",
                    "message": "No se encontraron fondos válidos para expandir el universo. Pruebe con otros activos.",
                    "weights": {},
                }, None, None, None, None, None, None, None, None, None, None, None, None

            added_assets = valid_added[:6]
            price_data.update({k: p_check[k] for k in added_assets})

            for isin in added_assets:
                if candidate_funds and isin in candidate_funds:
                    asset_metadata[isin] = candidate_funds[isin]
                else:
                    asset_metadata[isin] = {
                        "metrics": {},
                        "asset_class": "UNKNOWN",
                        "regions": {},
                        "classification_v2": {},
                        "portfolio_exposure_v2": {},
                        "v2_identity": {},
                        "v2_exposure": {},
                        "v2_quality": {"identity_ready": False, "exposure_ready": False},
                    }

            df = pd.DataFrame(price_data).sort_index().ffill(limit=5)
            universe = list(df.columns)
            mu = get_expected_returns(df, method="ema")
            S = get_covariance_matrix(df)
            eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec = _build_exposure_vectors(universe, asset_metadata)

            ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
            if constraints.get("objective") != "min_deviation":
                ef.add_objective(objective_functions.L2_reg, gamma=gamma)
            
            _apply_standard_constraints(
                ef, constraints, lock_mode, apply_profile, risk_level_i, locked_assets, 
                fixed_weights, asset_metadata, current_risk_buckets, eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, bucket_bounds_v1
            )
            solver_path = "auto_expand_then_solve"
            
    return True, {}, added_assets, solver_path, ef, mu, S, universe, eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec

def _run_solver(
    ef,
    mu,
    S,
    constraints,
    risk_level_i,
    rf_rate,
    max_weight,
    gamma,
    apply_profile,
    universe,
    lock_mode,
    locked_assets,
    fixed_weights,
    asset_metadata,
    current_risk_buckets,
    eq_vec,
    bd_vec,
    cs_vec,
    al_vec,
    ra_vec,
    ot_vec,
    bucket_bounds_v1=None,
    objective=None,
    risk_budget=None,
):
    """
    FASE 8: Ejecución Matemática Final.
    [PRECEDENCIA CANÓNICA] Nivel 6: Objetivo del Solver.
    """
    solver_path = None
    raw_weights = None
    feasibility = {}
    risk_budget = risk_budget or {}
    objective = objective or constraints.get("objective") or (
        "efficient_risk" if apply_profile else "max_sharpe"
    )

    try:
        if objective == "min_deviation":
            solver_path = "min_deviation_custom"
            import cvxpy as cp
            target_dict = constraints.get("target_weights", {})
            target_arr = np.array([target_dict.get(t, 0.0) for t in universe])

            def tracking_error_objective(w, w_target):
                return cp.sum_squares(w - w_target)

            raw_weights = ef.convex_objective(tracking_error_objective, w_target=target_arr)
        elif objective == "efficient_risk":
            target_vol = _to_float(
                risk_budget.get("target_vol"),
                float(RISK_TARGETS.get(risk_level_i, 0.05)),
            )
            solver_path = f"efficient_risk_profile_{target_vol:.3f}"
            raw_weights = ef.efficient_risk(target_vol)
        elif objective == "max_sharpe":
            solver_path = "max_sharpe_custom"
            raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
        elif objective == "min_vol":
            solver_path = "min_vol_custom"
            raw_weights = ef.min_volatility()
        elif objective == "target_return":
            target_return = _to_float(risk_budget.get("target_return"), 0.0)
            solver_path = f"target_return_{target_return:.3f}"
            raw_weights = ef.efficient_return(target_return)
        else:
            solver_path = "max_sharpe_default"
            raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
    except Exception as e1:
        # Si efficient_risk falla, registrar diagnóstico pero permitir fallback.
        if objective == "efficient_risk":
            target_vol = _to_float(
                risk_budget.get("target_vol"),
                float(RISK_TARGETS.get(risk_level_i, 0.05)),
            )
            feasibility = {
                "status": "infeasible",
                "objective": "efficient_risk",
                "target_vol": target_vol,
                "reason": str(e1),
            }
            logger.info(f"⚠️ Efficient Risk infeasible (target_vol={target_vol}): {e1}. Intentando fallbacks...")

        logger.info(f"⚠️ Optimization Failed: {e1}. Trying Relaxed Fallbacks...")
        try:
            logger.info("⚠️ Fallback 1: Relaxed Sharpe")
            ef_relaxed = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
            ef_relaxed.add_objective(objective_functions.L2_reg, gamma=gamma)

            _apply_standard_constraints(
                ef_relaxed, constraints, lock_mode, apply_profile, risk_level_i,
                locked_assets, fixed_weights, asset_metadata, current_risk_buckets,
                eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, bucket_bounds_v1
            )

            raw_weights = ef_relaxed.max_sharpe(risk_free_rate=rf_rate)
            ef = ef_relaxed
            solver_path = "fallback_relaxed_sharpe"
        except Exception:
            try:
                logger.info("⚠️ Fallback 2: Min Volatility")
                ef_minvol = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))

                _apply_standard_constraints(
                    ef_minvol, constraints, lock_mode, apply_profile, risk_level_i,
                    locked_assets, fixed_weights, asset_metadata, current_risk_buckets,
                    eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, bucket_bounds_v1
                )

                raw_weights = ef_minvol.min_volatility()
                ef = ef_minvol
                solver_path = "fallback_min_vol"
            except Exception as e_crit:
                logger.info(f"❌ ALL PATHS FAILED: {e_crit}")
                solver_path = "fallback_equal_weight"
                raw_weights = None

    return ef, raw_weights, solver_path, feasibility


def _postprocess_weights(ef, raw_weights, cutoff, universe, apply_profile, risk_level_i, current_risk_buckets, eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, lock_mode, locked_assets, fixed_weights):
    """
    FASE 9: Limpieza, DegradaciÃ³n Graciosa y AsignaciÃ³n Final.
    [PRECEDENCIA CANÃ“NICA] Nivel 7: Fallbacks / Degradaciones.
    Si fallÃ³ el solver, entramos en fallback asumiendo pesos equitativos PONDERADOS:
    - Conserva Nivel 3 (Filtro por Risk Buckets lÃ³gicos).
    - Conserva Nivel 1 (Locked Assets mantienen su peso hardcoded).
    - Se pierden Nivel 4 y Nivel 5.
    """
    weights = {}
    if raw_weights is not None:
        cleaned = ef.clean_weights(cutoff=cutoff)
        weights = _normalize({t: float(cleaned.get(t, 0.0)) for t in universe})
    else:
        logger.info("âš ï¸ Applying Graceful Degradation (Filtered Equal-Weight)")
        allowed_universe = []
        score_by_isin = {}

        if apply_profile and risk_level_i in current_risk_buckets:
            bucket_cfg = current_risk_buckets[risk_level_i]
            profile_vectors = _build_profile_bucket_vectors(eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec)
            bucket_midpoints = {}
            bucket_caps = {}
            for bucket_name in ["RV", "RF", "Monetario", "Alternativos", "Otros"]:
                min_val, max_val = _read_bound(bucket_cfg.get(bucket_name))
                bucket_caps[bucket_name] = 1.0 if (min_val is not None and max_val is None) else (0.0 if max_val is None else max_val)
                if min_val is None and max_val is None:
                    continue
                midpoint_min = 0.0 if min_val is None else min_val
                midpoint_max = 1.0 if max_val is None else max_val
                bucket_midpoints[bucket_name] = max(0.0, (midpoint_min + midpoint_max) / 2.0)
            for idx, isin in enumerate(universe):
                allowed = any(
                    profile_vectors[bucket_name][idx] > 1e-9 and bucket_caps.get(bucket_name, 0.0) > 0
                    for bucket_name in profile_vectors.keys()
                )
                if allowed:
                    allowed_universe.append(isin)
                    score_by_isin[isin] = max(
                        0.0,
                        sum(
                            profile_vectors[bucket_name][idx] * bucket_midpoints.get(bucket_name, 0.0)
                            for bucket_name in profile_vectors.keys()
                        ),
                    )
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
        score_total = sum(score_by_isin.get(t, 0.0) for t in allowed_universe)
        w_fallback = remaining_budget / max(1, len(allowed_universe))
        
        for t in universe:
            if t not in weights:
                if t not in allowed_universe:
                    weights[t] = 0.0
                elif score_total > 1e-9:
                    weights[t] = remaining_budget * score_by_isin.get(t, 0.0) / score_total
                else:
                    weights[t] = w_fallback

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
    candidate_funds=None,
    constraints_v1=None,
):
    """Optimizer v4.2 (Institutional: Hard Cutoff + Black-Litterman)"""
    constraints = constraints or {}
    constraints_v1 = constraints_v1 or constraints.get("constraints_v1") or {}
    asset_metadata = asset_metadata or {}
    locked_assets = locked_assets or []
    logger.info(f"ðŸ“¥ [Optimizer] Risk: {risk_level}, Assets: {len(assets_list)}, Meta: {len(asset_metadata)}")

    try:
        # FASE 1: Contexto Global
        (apply_profile, optimization_mode, lock_mode, fixed_weights, 
         current_risk_buckets, equity_floor, bond_cap, cash_cap) = _build_optimization_context(db, constraints)
        locks_v1 = (constraints_v1 or {}).get("locks", {}) or {}
        flags_v1 = (constraints_v1 or {}).get("flags", {}) or {}
        bucket_bounds_v1 = (constraints_v1 or {}).get("bucket_bounds", {}) or {}
        construction_v1 = (constraints_v1 or {}).get("construction", {}) or {}
        risk_budget_v1 = (constraints_v1 or {}).get("risk_budget", {}) or {}

        if isinstance(locks_v1.get("positions"), dict):
            fixed_weights = {
                str(k): _sanitize_fraction(v)
                for k, v in locks_v1.get("positions", {}).items()
            }
        if locks_v1.get("mode") in {"keep_weight", "keep_money", "min_keep", "free"}:
            lock_mode = locks_v1.get("mode")
        if constraints_v1.get("optimization_mode"):
            optimization_mode = constraints_v1.get("optimization_mode")
        if "apply_profile" in flags_v1:
            apply_profile = bool(flags_v1.get("apply_profile"))
        if not locked_assets and fixed_weights:
            locked_assets = list(fixed_weights.keys())
        if (not tactical_views) and isinstance((constraints_v1.get("views", {}) or {}).get("by_isin"), dict):
            tactical_views = constraints_v1.get("views", {}).get("by_isin", {})

        # FASE 2: Suitability Filter
        assets_list = _apply_suitability_filter(assets_list, asset_metadata, risk_level, apply_profile, locked_assets)

        # FASE 3: Universe Construction (Price Data & Expansions)
        (fetcher, price_data, synthetic_used, df, universe, missing_assets, 
         eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec) = _build_candidate_universe(
             db, assets_list, asset_metadata, constraints, candidate_funds, locked_assets
         )

        if df.empty or len(df) < 60:
            actual_start_str = df.index[0].strftime('%Y-%m-%d') if not df.empty else "N/A"
            return {
                "api_version": "optimizer_v4",
                "status": "error",
                "message": f"El tramo comÃºn estricto encontrado es demasiado corto ({len(df)} dÃ­as). Se requieren al menos 60 dÃ­as laborables para optimizar.",
                "effective_start_date": actual_start_str,
                "observations": len(df)
            }

        effective_start_date = df.index[0].strftime('%Y-%m-%d')
        observations = len(df)

        # FASE 4: Returns & Covariances (Markowitz & BL)
        mu, S = _build_expected_returns_and_cov(df, universe, asset_metadata, tactical_views)
        
        # FASE 5: Efficient Frontier Reference
        frontier_points = _build_frontier_curve(mu, S)
        
        # Setup Constants
        rf_rate = float(fetcher.get_dynamic_risk_free_rate())
        max_weight = float(construction_v1.get("max_weight", constraints.get("max_weight", MAX_WEIGHT_DEFAULT)))
        min_weight = float(construction_v1.get("min_weight", constraints.get("min_weight", 0.0)))
        cutoff = float(construction_v1.get("cutoff", CUTOFF_DEFAULT))
        risk_level_i = int(risk_level)
        n_assets = len(universe)
        gamma = 1.0 if n_assets < 10 else (2.0 if n_assets <= 25 else 3.0)
        objective = constraints_v1.get("objective") or constraints.get("objective") or (
            "efficient_risk" if apply_profile else "max_sharpe"
        )

        # Main Base Solver Instantiation
        ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
        if objective != "min_deviation":
            ef.add_objective(objective_functions.L2_reg, gamma=gamma)
            
        # FASE 5.5: Reconcile bucket_bounds_v1 vs Risk Profile to avoid silent CVXPY infeasibility
        if apply_profile and bucket_bounds_v1 and risk_level_i in current_risk_buckets:
            current_risk_buckets = _reconcile_bucket_vs_profile(
                bucket_bounds_v1, current_risk_buckets, risk_level_i
            )

        # FASE 6: Constraints Injection
        _apply_standard_constraints(
            ef, constraints, lock_mode, apply_profile, risk_level_i, locked_assets, 
            fixed_weights, asset_metadata, current_risk_buckets, 
            eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, bucket_bounds_v1
        )
        
        # FASE 7: Feasibility & Auto-Expand Check
        (is_feasible, infeasible_ret_obj, added_assets, solver_path_override, 
         ef_override, mu_override, S_override, universe_override, 
         eq_vec_override, bd_vec_override, cs_vec_override, al_vec_override, ra_vec_override, ot_vec_override
        ) = _check_feasibility_and_autoexpand(
            db, fetcher, price_data, universe, assets_list, apply_profile, equity_floor, max_weight, 
            eq_vec, locked_assets, constraints, asset_metadata, min_weight, gamma,
            bd_vec, cs_vec, al_vec, ra_vec, ot_vec, lock_mode, risk_level_i, fixed_weights, current_risk_buckets, candidate_funds, bucket_bounds_v1
        )
        
        if not is_feasible:
            return infeasible_ret_obj
            
        if solver_path_override:
            solver_path = solver_path_override
            ef = ef_override
            mu = mu_override
            S = S_override
            universe = universe_override
            eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec = (
                eq_vec_override, bd_vec_override, cs_vec_override, al_vec_override, ra_vec_override, ot_vec_override
            )
        else:
            solver_path = None
            
        # FASE 8: Final Mathematical Run
        if not solver_path or solver_path == "auto_expand_then_solve":
            ef, raw_weights, solver_path, solver_feasibility = _run_solver(
                ef, mu, S, constraints, risk_level_i, rf_rate, max_weight, gamma, apply_profile, universe,
                lock_mode, locked_assets, fixed_weights, asset_metadata, current_risk_buckets,
                eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, bucket_bounds_v1, objective, risk_budget_v1
            )
        else:
            raw_weights = None
            solver_feasibility = {}

        if solver_path == "infeasible_efficient_risk":
            return {
                "api_version": "optimizer_v4",
                "status": "infeasible_constraints",
                "message": solver_feasibility.get("reason", "No se pudo construir una cartera óptima con las restricciones actuales."),
                "solver_path": solver_path,
                "feasibility": solver_feasibility,
                "weights": {},
                "warnings": [solver_feasibility.get("reason", "efficient_risk infeasible")],
            }

        # FASE 9: Post-Processing & Normalization
        weights = _postprocess_weights(
            ef, raw_weights, cutoff, universe, apply_profile, risk_level_i, current_risk_buckets, 
            eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec, lock_mode, locked_assets, fixed_weights
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
        ra_total = float(w_arr @ ra_vec)
        ot_total = float(w_arr @ ot_vec)
        s_sum = eq_total + bd_total + cs_total + al_total + ra_total + ot_total
        if s_sum > 0:
            eq_total, bd_total, cs_total, al_total, ra_total, ot_total = (
                eq_total/s_sum, bd_total/s_sum, cs_total/s_sum, al_total/s_sum, ra_total/s_sum, ot_total/s_sum,
            )

        requested = []
        seen = set()
        for a in assets_list:
            if a not in seen:
                requested.append(a)
                seen.add(a)
        weights_full = {a: float(weights.get(a, 0.0)) if a in universe else 0.0 for a in requested}

        v2_exposure_assets = sum(
            1
            for t in universe
            if ((asset_metadata or {}).get(t, {}) or {}).get("portfolio_exposure_v2")
        )
        v2_identity_assets = sum(
            1
            for t in universe
            if extract_v2_identity((asset_metadata or {}).get(t, {}) or {}).get("asset_type") not in {None, "unknown"}
        )
        legacy_only_assets = sum(
            1
            for t in universe
            if not ((asset_metadata or {}).get(t, {}) or {}).get("portfolio_exposure_v2")
            and extract_v2_identity((asset_metadata or {}).get(t, {}) or {}).get("asset_type") in {None, "unknown"}
        )

        binding_constraints = []
        if apply_profile: binding_constraints.append(f"Risk Profile ({risk_level_i}) caps applied on aggregated exposure")
        if locked_assets: binding_constraints.append(f"{len(locked_assets)} locked assets maintained")
        if (constraints and (float(constraints.get("europe", 0.0) or 0.0) > 0 or float(constraints.get("americas", 1.0) or 1.0) < 1.0)):
            binding_constraints.append("Geographic limits applied on V2-first region exposure")
        if apply_profile and risk_level_i <= 3: binding_constraints.append("Emerging markets capped at 5%")
        _v1_bounds_active = any(isinstance(v, dict) and (v.get("min") is not None or v.get("max") is not None) for v in (bucket_bounds_v1 or {}).values())
        if _v1_bounds_active:
            binding_constraints.append("constraints_v1 bucket_bounds applied on portfolio_exposure_v2 (canonical, profile buckets skipped)")
        elif apply_profile:
            binding_constraints.append("current_risk_buckets applied as legacy fallback (no bucket_bounds_v1)")

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
            "constraints_v1_enabled": bool(constraints_v1),
            "constraints_v1_profile_id": constraints_v1.get("profile_id"),
            "bucket_constraints_source": "bucket_bounds_v1" if _v1_bounds_active else "current_risk_buckets_legacy",
            "constraint_hierarchy": "portfolio_exposure_v2 > classification_v2 > seed/config > legacy",
            "data_readiness": {
                "universe_size": len(universe),
                "v2_exposure_assets": v2_exposure_assets,
                "v2_identity_assets": v2_identity_assets,
                "legacy_only_assets": legacy_only_assets,
            },
            
            # --- STRUCTURED EXPLAINABILITY (Phase 5) ---
            "solver_path": solver_path,
            "applied_constraints": binding_constraints,
            "relaxed_constraints": ["Objetivo matemÃ¡tico principal relajado"] if solver_path and "fallback" in solver_path else [],
            "locked_assets_impact": "Pesos forzados de manera determinista (sin optimizaciÃ³n) para los %d activos indicados" % len(locked_assets) if locked_assets else "Ninguno",
            "tactical_views_impact": "Matriz de covarianza y rendimientos esperados ajustados vÃ­a Black-Litterman posteriori" if tactical_views else "Ninguno",
        }

        # Status honesto: si el solver usó fallback, informar.
        is_fallback = (solver_path or "").startswith("fallback_")
        final_status = "fallback" if is_fallback else ("optimal" if raw_weights is not None else "fallback")

        # Transparencia: target_vol vs achieved_vol
        _target_vol = _to_float(risk_budget_v1.get("target_vol"), None)
        _achieved_vol = port_vol
        _vol_deviation = None
        if _target_vol is not None and _target_vol > 0:
            _vol_deviation = round(_achieved_vol - _target_vol, 6)

        result_metrics = {
            "return": port_ret, "volatility": port_vol, "sharpe": port_sharpe,
            "rf_rate": rf_rate, "portfolio": portfolio_point,
        }
        if _target_vol is not None and _target_vol > 0:
            result_metrics["target_vol"] = round(_target_vol, 6)
            result_metrics["achieved_vol"] = round(_achieved_vol, 6)
            result_metrics["vol_deviation"] = _vol_deviation

        return {
            "api_version": "optimizer_v4",
            "mode": "PROFILE_B_AGGRESSIVE" if apply_profile else "PROFILE_A",
            "status": final_status,
            "solver_path": solver_path,
            "added_assets": added_assets,
            "used_assets": universe,
            "missing_assets": missing_assets,
            "portfolio_allocation": {
                "equity": eq_total,
                "bond": bd_total,
                "cash": cs_total,
                "alternative": al_total,
                "real_asset": ra_total,
                "other": ot_total,
                "RV": eq_total, "RF": bd_total, "Monetario": cs_total,
                "Alternativos": al_total + ra_total, "Otros": ot_total,
            },
            "weights": weights_full,
            "metrics": result_metrics,
            "frontier": frontier_points,
            "portfolio": portfolio_point,
            "effective_start_date": effective_start_date,
            "observations": observations,
            "explainability": explainability,
            "warnings": [],
        }

    except Exception as e:
        logger.info(f"âŒ Critical Error: {e}")
        return {"api_version": "optimizer_v4", "status": "error", "message": str(e), "error": str(e)}

