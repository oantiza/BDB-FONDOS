#!/usr/bin/env python3
"""
Offline dry-run: parses cached Firestore YAML output to generate the
mixed_exposure_fix_dry_run.json artifact without hitting Firestore.
"""
import json, re, sys, os
from pathlib import Path
from datetime import datetime, timezone

CACHE_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"C:\Users\oanti\.gemini\antigravity\brain\deaabece-9aa1-440f-862d-8c6edcf5d86b\.system_generated\steps\278\output.txt"
)
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix"
ARTIFACT_PATH = ARTIFACT_DIR / "mixed_exposure_fix_dry_run.json"

def safe_float(v, d=0.0):
    try: return float(v) if v is not None else d
    except: return d

def parse_funds(text):
    """Parse the YAML-like cached output into fund dicts."""
    funds = []
    current = None
    lines = text.split('\n')
    
    for line in lines:
        stripped = line.rstrip()
        if stripped.startswith('  - __path__: funds_v3/'):
            if current:
                funds.append(current)
            isin = stripped.split('funds_v3/')[1]
            current = {'isin': isin, 'lines': []}
        elif current is not None:
            current['lines'].append(stripped)
    if current:
        funds.append(current)
    return funds

def extract_field(lines, *path):
    """Simple YAML field extractor for known paths."""
    indent_stack = list(path)
    depth = 0
    target_indent = None
    
    for line in lines:
        stripped = line.lstrip()
        if not stripped or stripped.startswith('#'):
            continue
        curr_indent = len(line) - len(stripped)
        
        if depth < len(indent_stack):
            key = indent_stack[depth] + ':'
            if stripped.startswith(key):
                rest = stripped[len(key):].strip()
                if depth == len(indent_stack) - 1:
                    return rest if rest else None
                depth += 1
                target_indent = curr_indent
        elif target_indent is not None and curr_indent <= target_indent:
            break
    return None

def extract_block(lines, *path):
    """Extract a block of key-value pairs under a YAML path."""
    result = {}
    indent_stack = list(path)
    depth = 0
    block_indent = None
    in_block = False
    
    for line in lines:
        stripped = line.lstrip()
        if not stripped or stripped.startswith('#') or stripped.startswith('- '):
            if in_block:
                continue
            continue
        curr_indent = len(line) - len(stripped)
        
        if not in_block and depth < len(indent_stack):
            key = indent_stack[depth] + ':'
            if stripped.startswith(key):
                depth += 1
                if depth == len(indent_stack):
                    in_block = True
                    block_indent = None
        elif in_block:
            if block_indent is None:
                block_indent = curr_indent
            if curr_indent < block_indent:
                break
            if curr_indent == block_indent and ':' in stripped:
                parts = stripped.split(':', 1)
                k = parts[0].strip()
                v = parts[1].strip()
                try:
                    result[k] = float(v)
                except:
                    result[k] = v
    return result

def analyze_fund(isin, lines):
    # Extract name
    name = ""
    for line in lines:
        s = line.lstrip()
        if s.startswith("name:"):
            name = s.split(":", 1)[1].strip()
            break
    
    # Extract subtype
    subtype = ""
    for line in lines:
        s = line.lstrip()
        if s.startswith("asset_subtype:"):
            subtype = s.split(":", 1)[1].strip()
            break
    
    # Extract old economic_exposure
    old_econ = extract_block(lines, "economic_exposure")
    old_eq = safe_float(old_econ.get("equity"))
    old_bd = safe_float(old_econ.get("bond"))
    old_ca = safe_float(old_econ.get("cash"))
    old_ot = safe_float(old_econ.get("other"))
    
    # Extract confidence
    old_conf = 0.45
    for line in lines:
        s = line.lstrip()
        if s.startswith("exposure_confidence:"):
            old_conf = safe_float(s.split(":", 1)[1].strip(), 0.45)
            break
    
    # Extract ms.portfolio.asset_allocation
    ms_alloc = extract_block(lines, "portfolio", "asset_allocation")
    ms_eq = safe_float(ms_alloc.get("equity"))
    ms_bd = safe_float(ms_alloc.get("bond"))
    ms_ca = safe_float(ms_alloc.get("cash"))
    ms_ot = safe_float(ms_alloc.get("other"))
    ms_total = ms_eq + ms_bd + ms_ca + ms_ot
    
    has_ms = ms_total >= 10.0
    is_fallback = (
        (abs(old_eq - 50.0) < 0.5 and abs(old_bd - 50.0) < 0.5) or
        (abs(old_eq - 20.0) < 0.5 and abs(old_bd - 80.0) < 0.5) or
        (abs(old_eq - 80.0) < 0.5 and abs(old_bd - 20.0) < 0.5)
    )
    
    if has_ms:
        factor = 100.0 / ms_total if ms_total > 0 else 1.0
        prop_eq = round(ms_eq * factor, 1)
        prop_bd = round(ms_bd * factor, 1)
        prop_ca = round(ms_ca * factor, 1)
        prop_ot = round(ms_ot * factor, 1)
        source = "ms_portfolio_asset_allocation"
        conf_after = 0.85
        write_rec = is_fallback
        reason = "Morningstar real data replaces classification fallback" if is_fallback else "Morningstar data matches or current already adequate"
    else:
        prop_eq, prop_bd, prop_ca, prop_ot = old_eq, old_bd, old_ca, old_ot
        source = "fallback"
        conf_after = 0.55
        write_rec = False
        reason = "No Morningstar portfolio data available"
    
    review = has_ms and is_fallback and abs(prop_eq - old_eq) > 10.0
    
    return {
        "isin": isin,
        "name": name,
        "subtype": subtype,
        "old_economic_exposure": {"equity": old_eq, "bond": old_bd, "cash": old_ca, "other": old_ot},
        "ms_portfolio_asset_allocation": {"equity": ms_eq, "bond": ms_bd, "cash": ms_ca, "other": ms_ot, "sum": round(ms_total, 2)} if has_ms else None,
        "proposed_economic_exposure": {"equity": prop_eq, "bond": prop_bd, "cash": prop_ca, "other": prop_ot},
        "delta_equity": round(prop_eq - old_eq, 2),
        "delta_bond": round(prop_bd - old_bd, 2),
        "delta_cash": round(prop_ca - old_ca, 2),
        "delta_other": round(prop_ot - old_ot, 2),
        "source_used": source,
        "confidence_before": old_conf,
        "confidence_after": conf_after,
        "write_recommended": write_rec,
        "review_required": review,
        "reason": reason,
    }

def main():
    gen = datetime.now(timezone.utc).isoformat()
    print(f"{'='*60}")
    print(f"  BDB-MIXED-EXPOSURE-FIX — OFFLINE DRY-RUN")
    print(f"  Source: cached Firestore data")
    print(f"  Generated: {gen}")
    print(f"  Mode: READ-ONLY (no Firestore access)")
    print(f"{'='*60}\n")
    
    text = CACHE_PATH.read_text(encoding="utf-8")
    funds = parse_funds(text)
    print(f"  Parsed {len(funds)} MIXED funds from cache\n")
    
    patches = []
    stats = {"total_mixed": len(funds), "using_ms_portfolio": 0, "using_fallback": 0, "write_recommended": 0, "review_required": 0}
    
    for f in funds:
        r = analyze_fund(f['isin'], f['lines'])
        patches.append(r)
        if r["source_used"] == "ms_portfolio_asset_allocation":
            stats["using_ms_portfolio"] += 1
        else:
            stats["using_fallback"] += 1
        if r["write_recommended"]:
            stats["write_recommended"] += 1
        if r["review_required"]:
            stats["review_required"] += 1
        
        flag = ">> WRITE" if r["write_recommended"] else "   OK   "
        print(f"  [{flag}] {f['isin']} | old_eq={r['old_economic_exposure']['equity']:5.1f} -> new_eq={r['proposed_economic_exposure']['equity']:5.1f} | d_eq={r['delta_equity']:+6.1f} | {r['source_used']}")
    
    patches.sort(key=lambda p: (-int(p["write_recommended"]), -abs(p["delta_equity"])))
    
    artifact = {
        "audit_id": "BDB-MIXED-EXPOSURE-FIX-DRY-RUN",
        "generated_at_utc": gen,
        "mode": "dry-run",
        "data_source": "cached_firestore_snapshot",
        "write_executed": False,
        "firestore_read_executed": False,
        "firestore_write_executed": False,
        "stats": stats,
        "patches": patches,
    }
    
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(json.dumps(artifact, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    
    print(f"\n{'='*60}")
    print(f"  DRY-RUN COMPLETE")
    print(f"{'='*60}")
    print(f"  Total MIXED:         {stats['total_mixed']}")
    print(f"  Using ms.portfolio:  {stats['using_ms_portfolio']}")
    print(f"  Using fallback:      {stats['using_fallback']}")
    print(f"  Write recommended:   {stats['write_recommended']}")
    print(f"  Review required:     {stats['review_required']}")
    print(f"\n  Artifact: {ARTIFACT_PATH}")

if __name__ == "__main__":
    main()
