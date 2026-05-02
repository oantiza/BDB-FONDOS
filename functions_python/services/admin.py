from datetime import datetime
import re


def clean_duplicates_logic(db):
    try:
        docs = db.collection("funds_v3").stream()
        all_funds = []
        for d in docs:
            data = d.to_dict()
            data["doc_id"] = d.id
            all_funds.append(data)

        print(f"Cleaner: Scanning {len(all_funds)} funds...")

        by_isin = {}
        for f in all_funds:
            isin = f.get("isin", "").strip().upper()
            if not isin:
                continue
            if isin not in by_isin:
                by_isin[isin] = []
            by_isin[isin].append(f)

        deleted_count = 0
        preserved_count = 0

        batch = db.batch()
        batch_limit = 400
        batch_ops = 0

        def commit_if_full():
            nonlocal batch, batch_ops
            if batch_ops >= batch_limit:
                batch.commit()
                batch = db.batch()
                batch_ops = 0
                print("Batch committed.")

        def calculate_score(fund_data):
            score = 0
            for k, v in fund_data.items():
                if v and str(v).strip() and k != "std_extra":
                    score += 1
            extra = fund_data.get("std_extra", {})
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if v and str(v).strip():
                        score += 1
            return score

        for isin, group in by_isin.items():
            if len(group) > 1:
                group.sort(key=lambda x: calculate_score(x), reverse=True)

                winner = group[0]
                losers = group[1:]

                preserved_count += 1

                for loser in losers:
                    ref = db.collection("funds_v3").document(loser["doc_id"])
                    batch.delete(ref)
                    batch_ops += 1
                    deleted_count += 1
                    commit_if_full()

        if batch_ops > 0:
            batch.commit()

        response_msg = {
            "success": True,
            "scanned": len(all_funds),
            "deleted": deleted_count,
            "preserved": preserved_count,
            "message": f"Limpieza completada: {deleted_count} duplicados eliminados.",
        }
        return response_msg

    except Exception as e:
        print(f"❌ Clean Error: {e}")
        return {"success": False, "error": str(e)}


def restore_historico_logic(db):
    try:
        # The previous implementation details of restore_historico_logic have been removed.
        # This function now serves as a placeholder or needs a new implementation.
        # For now, it returns a success message or an error if the try block is empty.
        return {
            "status": "success",
            "message": "restore_historico_logic executed (no operation performed as per edit instruction).",
        }
    except Exception as e:
        print(f"❌ Error crítico restaurando histórico: {e}")
        return {"status": "error", "message": str(e)}


def analyze_isin_health_logic(db, bucket):

    print("🔍 Starting ISIN Health Check...")

    funds_ref = db.collection("funds_v3")
    docs = funds_ref.stream()

    total = 0
    corrupted_ids = []
    corrupted_data = []

    isin_pattern = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}\d$")

    for doc in docs:
        total += 1
        d = doc.to_dict()
        fid = doc.id

        is_bad = False
        reasons = []

        # Check ID
        if len(fid) != 12:
            is_bad = True
            reasons.append("ID Length != 12")

        if not isin_pattern.match(fid):
            # Soft check
            if len(fid) > 15:  # Suspicious long ID
                is_bad = True
                reasons.append("ID Pattern Invalid")

        # Check Fields
        if not d.get("eod_ticker"):
            reasons.append("Missing eod_ticker")  # Not corruption per se but issue

        if is_bad:
            corrupted_ids.append(fid)
            corrupted_data.append(
                {"id": fid, "name": d.get("name", "Unknown"), "reasons": reasons}
            )

    print(f"Found {len(corrupted_ids)} potential issues out of {total} funds.")

    # Save Report
    report = {
        "total_scanned": total,
        "issues_found": len(corrupted_ids),
        "timestamp": datetime.now().isoformat(),
        "details": corrupted_data,
    }

    import json

    blob = bucket.blob("reports/isin_health_report.json")
    blob.upload_from_string(
        json.dumps(report, indent=2), content_type="application/json"
    )

    return report
