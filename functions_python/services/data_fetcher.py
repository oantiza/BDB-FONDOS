from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import requests
import logging
from .config import PRICE_CACHE

logger = logging.getLogger(__name__)

# Global RAM Cache for Risk Free Rate
_rf_cache = {"rate": None, "timestamp": None}
_global_prices_cache = None


class DataFetcher:
    """
    Data Access Layer.
    Handles Firestore, Caching, and Pre-processing (Resampling).
    """

    def __init__(self, db_client):
        self.db = db_client

    def get_price_data(
        self, assets_list: list, resample_freq="D", strict=True
    ):
        """
        Fetches price history for assets.
        Standardizes to Daily Frequency ('D') and aligns to Business Day Calendar ('B').
        """
        global _global_prices_cache
        price_data = {}
        missing_assets = []
        synthetic_used = []

        # 1. RAM Cache Check
        for isin in assets_list:
            if isin in PRICE_CACHE:
                price_data[isin] = PRICE_CACHE[isin]
            else:
                missing_assets.append(isin)

        # 2. Try Fetching Global JSON Cache from Cloud Storage
        if missing_assets:
            try:
                import json
                from firebase_admin import storage
                from .config import BUCKET_NAME

                master_cache = None
                if _global_prices_cache is not None:
                    master_cache = _global_prices_cache
                    logger.info(
                        "⚡ [DataFetcher] Leyendo caché global desde RAM de la instancia (instantáneo)..."
                    )
                else:
                    bucket = storage.bucket(BUCKET_NAME)
                    blob = bucket.blob("cache/global_prices.json")
                    if blob.exists():
                        logger.info(
                            "⚡ [DataFetcher] Descargando caché global desde Cloud Storage..."
                        )
                        master_cache = json.loads(blob.download_as_string())
                        _global_prices_cache = master_cache

                if master_cache:
                    # Rellenar los missing_assets con el master_cache
                    still_missing = []
                    for isin in missing_assets:
                        if isin in master_cache:
                            series_clean = self._parse_doc_history(
                                {"history": master_cache[isin]}
                            )
                            if (
                                len(series_clean) > 20
                            ):  # Match history length constraint
                                price_data[isin] = series_clean
                                PRICE_CACHE[isin] = series_clean
                            else:
                                still_missing.append(isin)
                        else:
                            still_missing.append(isin)

                    logger.info(
                        f"🎯 [DataFetcher] Caché global proveyó {len(missing_assets) - len(still_missing)} fondos."
                    )
                    missing_assets = still_missing
            except Exception as e:
                logger.warning(f"⚠️ [DataFetcher] Fallo al leer caché de Storage: {e}")

        # 3. Batch Fetch from Firestore (Fallback for remaining missing assets)
        if missing_assets:
            logger.info(
                f"📥 [DataFetcher] Batch reading {len(missing_assets)} assets from Firestore..."
            )
            refs = [
                self.db.collection("historico_vl_v2").document(isin)
                for isin in missing_assets
            ]
            docs = self.db.get_all(refs)

            for doc in docs:
                isin = doc.id
                if not doc.exists:
                    logger.info(f"❌ {isin}: Not found in DB.")
                    continue

                try:
                    data = doc.to_dict()
                    series_clean = self._parse_doc_history(data)

                    if len(series_clean) > 20:
                        price_data[isin] = series_clean
                        PRICE_CACHE[isin] = series_clean
                    else:
                        logger.warning(f"⚠️ {isin}: Insufficient history ({len(series_clean)})")

                except Exception as e:
                    logger.warning(f"⚠️ Error parsing {isin}: {e}")

        if not price_data:
            return pd.DataFrame(), []

        # 3. Pandas Alignment & Professional Cleaning
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()

        # Step A: Resample to Daily to fill any missing calendar days
        df = df.resample("D").last()

        # Step B: Reindex to Business Day calendar ('B') to normalize series intersection
        if not df.empty:
            b_range = pd.date_range(start=df.index[0], end=df.index[-1], freq="B")
            df = df.reindex(b_range)

        # Step C1: Professional Despiking & Data-Quality Circuit Breakers
        # Prevents mathematical distortions like 2500% volatility caused by single-day db glitches or splits
        if not df.empty:
            ret = df.ffill(limit=5).pct_change(fill_method=None)

                        # --- 1) FATAL CIRCUIT BREAKER (>40%) ---
            critical_mask = np.abs(ret) > 0.40
            if critical_mask.any().any():
                bad_assets = critical_mask.columns[critical_mask.any()].tolist()
                raise ValueError(
                    f"DATA INTEGRITY BREACH: Daily absolute variance > 40% detected in assets: {bad_assets}. "
                    "Optimizer halted to prevent extreme allocation errors."
                )

            # --- 2) WARNING LOG (>15%) ---
            warning_mask = np.abs(ret) > 0.15
            if warning_mask.any().any():
                warning_assets = warning_mask.columns[warning_mask.any()].tolist()
                logger.warning(
                    f"⚠️ [DataFetcher] Large daily variance (>15%) detected in assets: {warning_assets}. Proceeding with despiking."
                )

            # --- 3) DESPIKING LOGIC (smoothing out anything > 15%)
            anomaly_mask = np.abs(ret) > 0.15

            if anomaly_mask.any().any():
                anomaly_count = anomaly_mask.sum().sum()
                logger.info(
                    f"🧹 [DataFetcher] Detached {anomaly_count} Anomalous 'Spike'/Split Points (>15% variance). Rebuilding series..."
                )

                original_notna = df.notna()
                # Cap the anomalous returns to 0.0 (assume no movement on split/glitch day)
                ret = ret.mask(anomaly_mask, 0.0)

                # Calculate cumulative growth from day 1
                cum_returns = (1 + ret.fillna(0)).cumprod()

                # Find the first valid price for each asset to use as a base
                first_valid_prices = df.apply(lambda col: col.dropna().iloc[0] if not col.dropna().empty else np.nan)

                # Rebuild prices: Base * Cumulative Growth
                df_rebuilt = cum_returns.multiply(first_valid_prices)

                # Restore NaNs for days before the asset actually existed
                df = df_rebuilt.where(original_notna)

        # Step C2: Fill Gaps (Professional ffill sequence)
        df = df.ffill(limit=5)

        # Step D: Strict vs Loose
        if strict:
            df_final = df.dropna()
            if len(df_final) < 60:
                logger.warning(f"⚠️ [DataFetcher] Tras dropna() estricto, la matriz común de {len(df_final.columns)} activos quedó en solo {len(df_final)} observaciones.")
        else:
            df_final = df

        return df_final, synthetic_used

    def _parse_doc_history(self, data: dict) -> dict:
        """Parses V3 history or legacy series."""
        clean_series = {}

        # Priority 1: 'history' (V3)
        history_list = data.get("history", [])
        if history_list and isinstance(history_list, list):
            for item in history_list:
                if not isinstance(item, dict):
                    continue
                d_val = item.get("date")
                n_val = item.get("nav")
                if d_val and n_val is not None:
                    clean_series[str(d_val)] = float(n_val)
            return clean_series

        # Priority 2: 'series' (Legacy)
        series = data.get("series", [])
        for p in series:
            if p.get("date") and p.get("price") is not None:
                d_val = p["date"]
                if hasattr(d_val, "strftime"):
                    d_str = d_val.strftime("%Y-%m-%d")
                else:
                    d_str = str(d_val).split("T")[0]
                clean_series[d_str] = float(p["price"])

        return clean_series

    def get_asset_metadata(self, assets_list: list):
        """Fetches metadata (asset_class, region) for constraints."""
        metadata = {}

        # Optimize: Fetch only what's needed.
        # For now, batch read funds_v3
        refs = [self.db.collection("funds_v3").document(isin) for isin in assets_list]
        docs = self.db.get_all(refs)

        for d in docs:
            if d.exists:
                dd = d.to_dict()
                metadata[d.id] = {
                    "asset_class": dd.get("classification_v2", {}).get("asset_type") or "UNKNOWN",
                    "region": dd.get("classification_v2", {}).get("region_primary") or "UNKNOWN",
                    "market_cap": dd.get("std_mcap", 1e9),  # Default for BL if missing
                    "classification_v2": dd.get("classification_v2", {}),
                    "portfolio_exposure_v2": dd.get("portfolio_exposure_v2", {}),
                }
        return metadata

    def get_dynamic_risk_free_rate(self):
        """
        Obtiene la Tasa Libre de Riesgo (ESTR) del BCE.
        Actualiza solo una vez al día a las 08:00 AM (aprox).
        Usa Firestore para persistencia.
        """
        global _rf_cache

        # Logic: Define "Current Validation Cycle".
        now = datetime.now()
        cutoff_hour = 8

        cycle_start = now.replace(hour=cutoff_hour, minute=0, second=0, microsecond=0)
        if now.hour < cutoff_hour:
            cycle_start = cycle_start - timedelta(days=1)

        # 1. Try Firestore Cache (Persistent)
        try:
            doc_ref = self.db.collection("system_settings").document("risk_free_rate")
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                last_update = data.get("updated_at")
                stored_rate = data.get("rate")

                # Check if valid for current cycle
                if last_update:
                    # localized or naive? assumes server time consistency
                    last_dt = (
                        last_update.replace(tzinfo=None)
                        if hasattr(last_update, "tzinfo")
                        else last_update
                    )
                    if last_dt >= cycle_start:
                        logger.info(
                            f"⚡ [CACHE DB] Using stored ESTR: {stored_rate * 100:.3f}% (from {last_dt})"
                        )
                        return float(stored_rate)
        except Exception as e:
            logger.warning(f"⚠️ Error checking DB cache: {e}")

        # 2. Try Memory Cache (Fallback / Optimization if DB fail)
        if _rf_cache["rate"] and _rf_cache["timestamp"]:
            if _rf_cache["timestamp"] >= cycle_start:
                return _rf_cache["rate"]

        # 3. Fetch from ECB (ESTR - Euro Short-Term Rate)
        url = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=10&format=jsondata"
        fallback_rate = 0.03

        try:
            logger.info("🌍 [ECB] Fetching Real Risk Free Rate (ESTR)...")
            headers = {
                "Accept": "application/json",
                "User-Agent": "bdb-fondos/1.0 (risk_free_rate_fetch)",
            }
            r = requests.get(url, headers=headers, timeout=8)
            r.raise_for_status()
            data = r.json()

            series_dict = data.get("dataSets", [{}])[0].get("series", {})
            if not series_dict:
                raise KeyError("No series")

            series_key = next(iter(series_dict.keys()))
            observations = series_dict[series_key].get("observations", {})
            if not observations:
                raise KeyError("No observations")

            obs_keys_sorted = sorted(observations.keys(), key=lambda x: int(x))
            last_obs_key = obs_keys_sorted[-1]
            val = observations[last_obs_key][0]
            rate = float(val) / 100.0

            logger.info(f"✅ [ECB] Rate updated: {rate * 100:.3f}%")

            # Update Memory Cache
            _rf_cache = {"rate": rate, "timestamp": now}

            # Update Firestore Cache
            try:
                self.db.collection("system_settings").document("risk_free_rate").set(
                    {
                        "rate": rate,
                        "updated_at": now,
                        "source": "ECB",
                        "cycle": cycle_start.isoformat(),
                    }
                )
            except Exception as w_err:
                logger.warning(f"⚠️ Error writing DB cache: {w_err}")

            return rate

        except Exception as e:
            logger.warning(f"⚠️ [ECB] Error fetching rate: {e}")

        logger.warning(f"⚠️ [ECB] Using Fallback Rate: {fallback_rate * 100:.1f}%")
        return float(fallback_rate)

    def generate_synthetic_series(self, days=1200, vol=0.12, ret=0.07, seed=None):
        if seed is not None:
            np.random.seed(seed)
        end_date = datetime.now()
        dates = pd.date_range(end=end_date, periods=days, freq="B")
        dt = 1 / 252
        mu = ret * dt
        sigma = vol * np.sqrt(dt)
        returns = np.random.normal(loc=mu, scale=sigma, size=days)
        price_path = 100 * (1 + returns).cumprod()
        return {
            d.strftime("%Y-%m-%d"): float(round(p, 2))
            for d, p in zip(dates, price_path)
        }
