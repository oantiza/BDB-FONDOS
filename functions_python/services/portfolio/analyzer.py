import logging
logger = logging.getLogger(__name__)
import pandas as pd

from firebase_admin import firestore

from services.data_fetcher import DataFetcher
from services.portfolio.utils import _to_float


def analyze_portfolio(portfolio_weights: dict, db) -> dict:
    """
    Analyzes a given portfolio.

    Args:
        portfolio_weights: Dictionary of {isin: weight} where weights sum to 1.
        db: Firestore db instance.

    Returns:
        dict: Analysis results including metrics, correlations, opinion, and alternatives.
    """
    assets_list = list(portfolio_weights.keys())
    if not assets_list:
        return {"error": "Portfolio is empty"}

    # 1. Fetch data
    fetcher = DataFetcher(db)
    price_data, _ = fetcher.get_price_data(
        assets_list, resample_freq="D", strict=False
    )

    df = pd.DataFrame(price_data)
    if df.empty or len(df) < 50:
        return {"error": "Insufficient historical data for the requested assets"}

    df.index = pd.to_datetime(df.index)

    # Adaptive Time Horizon
    target_years = 3
    ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * target_years)
    first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
    actual_start_date = (
        first_valid_indices.max() if not first_valid_indices.empty else ideal_start_date
    )
    final_start_date = max(ideal_start_date, actual_start_date)
    df = df[df.index >= final_start_date]
    df = df.sort_index().ffill().dropna()

    if df.empty or len(df) < 60:
        actual_start_str = df.index[0].strftime('%Y-%m-%d') if not df.empty else "N/A"
        return {
            "error": f"El tramo común de análisis es demasiado corto ({len(df)} días). Se requieren al menos 60 días laborables para un cálculo de riesgo válido.",
            "effective_start_date": actual_start_str,
            "observations": len(df)
        }

    # Ensure all requested assets are in the dataframe
    universe = list(df.columns)
    valid_weights = {
        isin: w for isin, w in portfolio_weights.items() if isin in universe
    }

    if sum(valid_weights.values()) == 0:
        return {"error": "None of the provided assets have valid historical data."}

    # Normalize valid weights
    total_w = sum(valid_weights.values())
    valid_weights = {isin: w / total_w for isin, w in valid_weights.items()}

    from services.quant_core import get_covariance_matrix, get_expected_returns, calculate_portfolio_metrics

    # 2. Compute Metics
    mu = get_expected_returns(df, method="mean")
    S = get_covariance_matrix(df)

    rf_rate = float(fetcher.get_dynamic_risk_free_rate())

    # Ensure weights align with mu and S
    w_dict = {isin: valid_weights.get(isin, 0.0) for isin in universe}

    metrics = calculate_portfolio_metrics(
        w_dict, mu, S, rf_rate=rf_rate
    )
    port_ret = metrics.get("return", 0.0)
    port_vol = metrics.get("volatility", 0.0)
    port_sharpe = metrics.get("sharpe", 0.0)

    # 3. Compute Correlation
    corr_matrix = df.corr()

    high_corr_pairs = []
    for i in range(len(corr_matrix.columns)):
        for j in range(i + 1, len(corr_matrix.columns)):
            val = corr_matrix.iloc[i, j]
            if val > 0.8:  # threshold for high correlation
                high_corr_pairs.append(
                    {
                        "asset1": corr_matrix.columns[i],
                        "asset2": corr_matrix.columns[j],
                        "correlation": float(val),
                    }
                )

    # Format correlation matrix for JSON response
    corr_json = {}
    for col in corr_matrix.columns:
        corr_json[col] = {
            row: float(corr_matrix.loc[row, col]) for row in corr_matrix.index
        }

    # Fetch metadata for generating opinion and searching alternatives
    asset_metadata = {}
    try:
        refs = [db.collection("funds_v3").document(isin) for isin in universe]
        docs = db.get_all(refs)
        for d in docs:
            if d.exists:
                dd = d.to_dict() or {}
                asset_metadata[d.id] = dd
    except Exception as e:
        logger.warning(f"Error fetching metadata: {e}")

    # 4. Generate Opinion
    opinion = []
    if port_sharpe < 0.5:
        opinion.append(
            "El ratio de Sharpe actual de la cartera es bajo. Sugiere que el retorno ajustado por riesgo podría mejorarse considerablemente."
        )
    elif port_sharpe > 1.0:
        opinion.append(
            "La cartera muestra una excelente eficiencia histórica en términos de rentabilidad-riesgo."
        )
    else:
        opinion.append(
            "La cartera tiene un rendimiento histórico aceptable en términos de rentabilidad-riesgo."
        )

    if high_corr_pairs:
        pairs_str = ", ".join(
            [
                f"{p['asset1']} y {p['asset2']} ({p['correlation']:.2f})"
                for p in high_corr_pairs
            ]
        )
        opinion.append(
            f"Alerta de concentración: Hemos detectado fondos con alta correlación entre sí (>0.80): {pairs_str}. Esto significa que tienden a moverse en la misma dirección y reducen el beneficio de la diversificación. Considera sustituir uno de ellos."
        )
    else:
        opinion.append(
            "La cartera presenta una buena diversificación; no se han detectado fondos con correlaciones excesivamente altas entre sí."
        )

    # 5. Find Alternatives
    # For funds with high correlation or low individual Sharpe, suggest alternatives from the same category
    alternatives = []
    processed_categories = set()

    for pair in high_corr_pairs:
        asset1 = pair["asset1"]
        asset2 = pair["asset2"]

        # Decide which one to replace (the one with lower Sharpe)
        meta1 = asset_metadata.get(asset1, {})
        meta2 = asset_metadata.get(asset2, {})

        std_perf1 = meta1.get("std_perf") or {}
        std_perf2 = meta2.get("std_perf") or {}

        sharpe1 = _to_float(std_perf1.get("sharpe", 0.0), 0.0)
        sharpe2 = _to_float(std_perf2.get("sharpe", 0.0), 0.0)

        asset_to_replace = asset1 if sharpe1 < sharpe2 else asset2
        target_meta = meta1 if sharpe1 < sharpe2 else meta2
        
        # [V2-FIRST INTENT]
        # In a strict V2 environment, alternatives should be queried using:
        # classification_v2.asset_subtype + classification_v2.region_primary
        # However, querying these fields alongside order_by("std_perf.sharpe")
        # requires a NEW composite index in Firestore.
        
        # [COMPATIBILITY FALLBACK]
        # We retain 'categoryId' (Morningstar ID) for the database query
        # to guarantee index stability and avoid runtime errors in production.
        target_cat = target_meta.get("categoryId")
        
        # Extracted V2 paths for future localized filtering or reporting
        class_v2 = target_meta.get("classification_v2", {})
        target_type_v2 = class_v2.get("asset_type", "UNKNOWN")

        if not target_cat:
            continue

        if target_cat in processed_categories:
            continue  # already suggested for this category

        processed_categories.add(target_cat)

        # Query DB for better alternatives
        try:
            alt_query = (
                db.collection("funds_v3")
                .where("categoryId", "==", target_cat)
                .order_by("std_perf.sharpe", direction=firestore.Query.DESCENDING)
                .limit(5)
                .get()
            )

            found_alts = []
            for doc in alt_query:
                if doc.id not in universe:  # Do not suggest what they already have
                    alt_data = doc.to_dict() or {}
                    alt_std_perf = alt_data.get("std_perf") or {}
                    found_alts.append(
                        {
                            "isin": doc.id,
                            "name": alt_data.get("name", "Unknown Fund"),
                            "sharpe": _to_float(
                                alt_std_perf.get("sharpe", 0.0), 0.0
                            ),
                            "reason": f"Sugerido como alternativa a {asset_to_replace} en la categoría '{target_cat}' por tener mejor rendimiento ajustado por riesgo.",
                        }
                    )

            if found_alts:
                alternatives.append(
                    {
                        "target_replacement": asset_to_replace,
                        "category": target_cat,
                        "suggestions": found_alts[:3],  # Top 3
                    }
                )
        except Exception as e:
            logger.warning(f"Error querying alternatives: {e}")

    # Build response return
    result = {
        "status": "success",
        "portfolio_metrics": {
            "expected_return": round(port_ret, 4),
            "volatility": round(port_vol, 4),
            "sharpe_ratio": round(port_sharpe, 4),
            "effective_start_date": df.index[0].strftime("%Y-%m-%d"),
            "target_years": target_years,
            "observations": len(df),
        },
        "correlation_matrix": corr_json,
        "high_correlation_pairs": high_corr_pairs,
        "opinion_text": " ".join(opinion),
        "alternatives": alternatives,
    }

    return result
