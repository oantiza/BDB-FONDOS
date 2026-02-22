import numpy as np
import pandas as pd
from datetime import datetime
from firebase_admin import firestore

def update_daily_metrics(db):
    """
    Iterates all funds in funds_v3, calculates metrics from returns_history,
    and updates std_perf.
    """
    print("🚀 Starting Daily Metrics Update...")
    
    # 1. Fetch all funds
    funds_ref = db.collection('funds_v3')
    docs = funds_ref.stream()
    
    batch = db.batch()
    count = 0
    updated_count = 0
    BATCH_SIZE = 400
    
    for doc in docs:
        try:
            fund = doc.to_dict()
            history_data = []
            
            # 1. Try Embedded History (Map format check)
            embedded = fund.get('returns_history')
            if embedded and isinstance(embedded, dict) and len(embedded) > 10:
                # Convert Map { '2023-01-01': 100 } to List for consistency
                for k, v in embedded.items():
                    history_data.append({'date': k, 'nav': v})
                    
            # 2. Try External History (historico_vl_v2)
            if not history_data:
                try:
                    h_doc = db.collection('historico_vl_v2').document(doc.id).get()
                    if h_doc.exists:
                        h_d = h_doc.to_dict()
                        # Prefer canonical 'history'
                        raw_list = h_d.get('history') or h_d.get('series') or []
                        for item in raw_list:
                            # Normalize fields
                            d_val = item.get('date')
                            p_val = item.get('nav') if item.get('nav') is not None else item.get('price')
                            if d_val and p_val is not None:
                                history_data.append({'date': d_val, 'nav': p_val})
                except Exception:
                    pass
            
            if len(history_data) < 10:
                continue

            # Convert to DataFrame
            # Format: [{'date': '...', 'nav': 123}]
            df = pd.DataFrame(history_data)
            
            # Normalize Date
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            df['nav'] = pd.to_numeric(df['nav'], errors='coerce')
            df.dropna(inplace=True)
            df = df.sort_index()
            
            # Use 'nav' column as series
            df = df['nav'] 

            # Clean zeroes or nulls
            df = df[df > 0]
            if len(df) < 10: continue

            # Calculate Daily Returns: (P_t / P_t-1) - 1
            returns = df.pct_change().dropna()
            
            if len(returns) < 5: continue
            
            # 1. Volatility (Annualized) - Assuming Daily
            vol = returns.std() * np.sqrt(252)
            
            # 2. CAGR (3 Years or Max)
            days = (df.index[-1] - df.index[0]).days
            years = days / 365.25
            if years < 0.5: continue # Too short

            total_ret = (df.iloc[-1] / df.iloc[0]) - 1
            cagr = (1 + total_ret) ** (1 / years) - 1
            
            # 3. Sharpe (Assuming Rf=0 for simple storage, adjusted in frontend)
            sharpe = 0
            if vol > 0:
                sharpe = cagr / vol

            # 4. Max Drawdown (Historical)
            # Calculate running max
            rolling_max = df.cummax()
            drawdown = (df / rolling_max) - 1.0
            max_dd = drawdown.min()

            # 5. Value at Risk (VaR) & CVaR (Historical Method, 95% Confidence)
            # "How much could I lose in a bad day?"
            # We use the 5th percentile of daily returns
            var_95_daily = np.percentile(returns, 5)
            
            # CVaR (Average of losses exceeding VaR)
            cvar_returns = returns[returns <= var_95_daily]
            cvar_95_daily = cvar_returns.mean() if len(cvar_returns) > 0 else var_95_daily
            
            # Prepare Update
            update_data = {
                'std_perf.return': float(round(cagr, 4)),
                'std_perf.volatility': float(round(vol, 4)),
                'std_perf.sharpe': float(round(sharpe, 4)),
                'std_perf.cagr3y': float(round(cagr, 4)) if years >= 3 else fund.get('std_perf', {}).get('cagr3y'),
                'std_perf.max_drawdown': float(round(max_dd, 4)),
                'std_perf.var95': float(round(var_95_daily, 4)), # Daily VaR
                'std_perf.cvar95': float(round(cvar_95_daily, 4)), # Daily CVaR
                'std_perf.last_updated': datetime.now()
            }
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}

            batch.update(doc.reference, update_data)
            count += 1
            
            if count >= BATCH_SIZE:
                batch.commit()
                batch = db.batch()
                updated_count += count
                count = 0
                print(f"📦 Committed batch of {BATCH_SIZE} updates...")

        except Exception as e:
            print(f"⚠️ Error updating fund {doc.id}: {e}")

    # Commit remaining
    if count > 0:
        batch.commit()
        updated_count += count
    
    print(f"✅ Daily Update Complete. Updated {updated_count} funds.")
    return {'success': True, 'updated': updated_count}

def build_global_price_cache(db):
    """
    Consolidates all history from historico_vl_v2 into a single JSON file
    in Cloud Storage to drastically reduce Firestore read costs.
    """
    import json
    from firebase_admin import storage
    from .config import BUCKET_NAME

    print("🛠️ Construyendo caché global de precios...")
    try:
        bucket = storage.bucket(BUCKET_NAME)
        
        master_dict = {}
        docs = db.collection('historico_vl_v2').stream()
        
        for doc in docs:
            data = doc.to_dict()
            history = data.get('history') or data.get('series') or []
            if history:
                master_dict[doc.id] = history
                
        json_data = json.dumps(master_dict)
        blob = bucket.blob("cache/global_prices.json")
        blob.upload_from_string(json_data, content_type='application/json')
        
        print(f"✅ Caché global construida con éxito. {len(master_dict)} fondos cacheados.")
        return {'success': True, 'funds_cached': len(master_dict)}
    except Exception as e:
        print(f"⚠️ Error construyendo caché global: {e}")
        return {'success': False, 'error': str(e)}
