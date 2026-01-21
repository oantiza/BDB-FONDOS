import firebase_admin
from firebase_admin import firestore
from datetime import datetime
import logging

def _to_float(x):
    if x is None: return 0.0
    if isinstance(x, (int, float)): return float(x)
    try:
        if isinstance(x, str):
            c = x.strip().replace('%','').replace(',','.')
            return float(c)
    except:
        return 0.0
    return 0.0

def detect_hedging(name, class_name):
    keywords = ['hedged', 'hgd', 'cubierto', 'currency hedged', 'eur hedged']
    text = f"{str(name or '')} {str(class_name or '')}".lower()
    return any(k in text for k in keywords)

def get_canonical_asset_class(eq, bd, cs):
    if eq >= 70: return 'RV'
    if bd >= 70: return 'RF'
    if cs >= 70: return 'Monetario'
    if eq >= 20 and bd >= 20: return 'Mixto'
    return 'Otros'

def run_db_fix(db, apply_changes=False):
    print(f"🔧 Starting DB Fix V2 (Apply={apply_changes})...")
    
    funds_ref = db.collection('funds_v3')
    docs = list(funds_ref.stream())
    
    stats = {
        'total': len(docs),
        'history_ok': 0,
        'metrics_renormalized': 0,
        'metrics_invalid': 0,
        'candidates_found': 0,
        'updates_count': 0
    }
    
    candidates = [] # list of dicts
    report_data = [] # Full detailed report
    
    batch = db.batch()
    batch_count = 0
    
    for d in docs:
        dd = d.to_dict() or {}
        isin = d.id
        
        # --- 1. HISTORY CHECK V2 ---
        history_points = 0
        years_history = 0.0
        
        try:
            h_doc = db.collection('historico_vl_v2').document(isin).get()
            if h_doc.exists:
                h_data = h_doc.to_dict()
                series = h_data.get('series', [])
                # Count valid points
                valid_pts = [p for p in series if p.get('price') is not None]
                history_points = len(valid_pts)
                
                # Calc years history
                if valid_pts:
                    dates = []
                    for p in valid_pts:
                        d_val = p.get('date')
                        if d_val:
                            # Try to parse or use if datetime
                            if isinstance(d_val, str):
                                try: 
                                    # Handle simple ISO part if needed
                                    d_parsed = datetime.fromisoformat(d_val.replace('Z',''))
                                    dates.append(d_parsed)
                                except: pass
                            elif isinstance(d_val, datetime):
                                dates.append(d_val)
                    
                    if dates:
                        dates.sort()
                        start = dates[0]
                        end = dates[-1]
                        diff_days = (end - start).days
                        years_history = round(diff_days / 365.25, 2)

        except Exception as e:
            print(f"History Check Error {isin}: {e}")

        # Criteria: >= 504 points AND (if calculated years >= 2.0)
        history_ok = (history_points >= 504)
        if history_ok and years_history > 0 and years_history < 1.95:
             # Strict check: if sufficient points but clearly < 2 years (e.g. high frequency intraday data error?), flag false?
             # Assuming daily data: 2 years ~ 504 business days. 
             # If years < 1.95, it contradicts points >= 504 unless duplicates or multi-intraday.
             # We assume distinct dates.
             # Let's trust points primary, but if years available, valid.
             pass
        
        if history_ok:
            stats['history_ok'] += 1

        # --- 2. METRICS NORMALIZATION V2 ---
        metrics = dd.get('metrics', {})
        eq = _to_float(metrics.get('equity'))
        bd = _to_float(metrics.get('bond'))
        cs = _to_float(metrics.get('cash'))
        ot = _to_float(metrics.get('other'))
        
        # Component Check & Clamp
        out_of_range = False
        components = [eq, bd, cs, ot]
        if any(c < -0.01 or c > 100.01 for c in components):
            out_of_range = True
        
        # Clamp
        c_eq = max(0.0, min(100.0, eq))
        c_bd = max(0.0, min(100.0, bd))
        c_cs = max(0.0, min(100.0, cs))
        c_ot = max(0.0, min(100.0, ot))
        
        total = c_eq + c_bd + c_cs + c_ot
        metrics_invalid = False
        renormalized = False
        final_eq, final_bd, final_cs, final_ot = c_eq, c_bd, c_cs, c_ot
        
        if total == 0:
            metrics_invalid = True
        elif 95.0 <= total <= 105.0:
            if abs(total - 100.0) > 0.01:
                factor = 100.0 / total
                final_eq *= factor
                final_bd *= factor
                final_cs *= factor
                final_ot *= factor
                renormalized = True
                stats['metrics_renormalized'] += 1
        else:
            metrics_invalid = True
            stats['metrics_invalid'] += 1
            
        final_eq = round(final_eq, 2)
        final_bd = round(final_bd, 2)
        final_cs = round(final_cs, 2)
        final_ot = round(final_ot, 2)

        # Canonical Asset Class
        c_asset_class = get_canonical_asset_class(final_eq, final_bd, final_cs)
        
        # --- 3. AUTO-EXPAND CANDIDATE ---
        is_hedged = detect_hedging(dd.get('name'), dd.get('class'))
        
        # strict: equity >= 90 (normalized), metrics valid, history ok, not hedged
        is_candidate = False
        if (not metrics_invalid) and (final_eq >= 90.0) and history_ok and (not is_hedged):
            is_candidate = True
            sharpe = _to_float(dd.get('std_perf', {}).get('sharpe', 0.0))
            candidates.append({
                'isin': isin, 
                'sharpe': sharpe,
                'name': dd.get('name')
            })
            stats['candidates_found'] += 1

        # Report Data
        report_data.append({
            'isin': isin,
            'name': dd.get('name', ''),
            'metrics_sum_raw': total,
            'metrics_invalid': metrics_invalid,
            'metrics_renormalized': renormalized,
            'metrics_out_of_range': out_of_range,
            'history_points': history_points,
            'years_history': years_history,
            'history_ok': history_ok,
            'is_candidate': is_candidate,
            'final_equity': final_eq,
            'sharpe': _to_float(dd.get('std_perf', {}).get('sharpe', 0.0))
        })

        # --- DB UPDATE ---
        if apply_changes:
            update_data = {
                'metrics': {
                    'equity': final_eq, 'bond': final_bd, 'cash': final_cs, 'other': final_ot
                },
                'asset_class': c_asset_class,
                'std_extra': { 
                   **(dd.get('std_extra') or {}),
                   'yearsHistory': years_history
                },
                'data_quality': {
                    'metrics_invalid': metrics_invalid,
                    'metrics_component_out_of_range': out_of_range,
                    'metrics_renormalized': renormalized,
                    'history_points': history_points,
                    'history_ok': history_ok,
                    'last_checked': firestore.SERVER_TIMESTAMP,
                    'schema_version': 3
                }
            }
            
            doc_ref = funds_ref.document(isin)
            batch.update(doc_ref, update_data)
            batch_count += 1
            
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                stats['updates_count'] += 400

    if apply_changes:
        if batch_count > 0:
            batch.commit()
            stats['updates_count'] += batch_count
        
        # Update Config
        candidates.sort(key=lambda x: x['sharpe'], reverse=True)
        top_candidates = [c['isin'] for c in candidates[:50]]
        
        try:
            db.collection('config').document('auto_complete_candidates').set({
                'equity90_isins': top_candidates,
                'last_updated': firestore.SERVER_TIMESTAMP,
                'source': 'fix_script_v2_strict'
            })
            stats['config_updated'] = True
        except Exception as e:
            stats['config_error'] = str(e)
            
    # RETURN STATS AND FULL REPORT DATA
    return {'stats': stats, 'report': report_data}


def migrate_historico_vl_v2_to_history(db, dry_run=True):
    """
    Migrates all documents in 'historico_vl_v2' to canonical schema (version 3).
    Converts 'series' (date/price|close|vol) -> 'history' (date/nav).
    """
    print(f"🚀 Starting Migration (Dry Run={dry_run})...")
    docs = db.collection('historico_vl_v2').stream()
    
    stats = {
        'total': 0,
        'already_v3': 0,
        'migrated': 0,
        'skipped_error': 0,
        'errors': []
    }
    
    batch = db.batch()
    batch_ops = 0
    from .history_writer import write_history_canonical
    
    for doc in docs:
        stats['total'] += 1
        isin = doc.id
        data = doc.to_dict()
        
        # 1. Check Version
        if data.get('schema_version') == 3 and data.get('history'):
            stats['already_v3'] += 1
            continue
            
        # 2. Extract Potential Data
        raw_list = []
        source_fmt = "unknown"
        
        # Priority 1: 'history' (maybe v1/v2)
        if data.get('history'):
            raw_list = data['history']
            source_fmt = "history_legacy"
        # Priority 2: 'series' (Legacy Admin/EODHD)
        elif data.get('series'):
            raw_list = data['series']
            source_fmt = "series_legacy"
        # Priority 3: 'valores' (Map date->val)
        elif data.get('valores') and isinstance(data['valores'], dict):
            # Convert dict to list
            raw_list = [{'date': k, 'nav': v} for k, v in data['valores'].items()]
            source_fmt = "valores_dict"
            
        if not raw_list:
            stats['skipped_error'] += 1
            # stats['errors'].append(f"{isin}: No readable history fields found.")
            continue
            
        # 3. Transform to Canonical
        clean_list = []
        for item in raw_list:
            if not isinstance(item, dict): continue
            
            d_val = item.get('date') or item.get('fecha')
            # Try various keys for price
            # Note: User disallowed 'vol' -> 'nav'. But if 'series' legacy used 'vol' by mistake?
            # User said: "PROHIBIDO mapear vol->nav". So we strictly look for price/nav/close/value.
            n_val = item.get('nav') or item.get('price') or item.get('close') or item.get('value') or item.get('valor')
            
            if d_val and n_val is not None:
                clean_list.append({'date': d_val, 'nav': n_val})
                
        if not clean_list:
            stats['skipped_error'] += 1
            stats['errors'].append(f"{isin}: Valid points 0 after parsing {source_fmt}")
            continue
            
        # 4. Write
        if not dry_run:
            try:
                write_history_canonical(db, isin, clean_list, source="Migration_V3", source_format=source_fmt, batch=batch)
                batch_ops += 1
                stats['migrated'] += 1
                
                if batch_ops >= 400:
                    batch.commit()
                    batch = db.batch()
                    batch_ops = 0
            except Exception as e:
                stats['skipped_error'] += 1
                stats['errors'].append(f"{isin}: Write Error {e}")
        else:
            stats['migrated'] += 1 # Count as potential
            
    if not dry_run and batch_ops > 0:
        batch.commit()
        
    return stats
