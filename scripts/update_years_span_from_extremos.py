# update_years_span_from_extremos.py
import argparse, csv
from datetime import datetime
from firebase_admin import initialize_app, firestore
import firebase_admin

def parse_date(s: str):
    return datetime.strptime(s.strip(), "%Y-%m-%d")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project_id", required=True)
    ap.add_argument("--csv", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--out", default="funds_v2_extremos_update_report.csv")
    args = ap.parse_args()

    if not firebase_admin._apps:
        initialize_app(options={"projectId": args.project_id})
    db = firestore.client()

    updated = 0
    missing_doc = 0
    errors = 0

    batch = db.batch()
    batch_ops = 0

    with open(args.out, "w", newline="", encoding="utf-8") as f_out:
        writer = csv.DictWriter(f_out, fieldnames=[
            "isin","status","years_span","first_date","last_date","reason"
        ])
        writer.writeheader()

        with open(args.csv, "r", encoding="utf-8") as f_in:
            reader = csv.DictReader(f_in, delimiter=";")
            for row in reader:
                isin = (row.get("ISIN") or "").strip()
                fd = (row.get("FIRST_DATE") or "").strip()
                ld = (row.get("LAST_DATE") or "").strip()

                if not isin or not fd or not ld:
                    errors += 1
                    writer.writerow({
                        "isin": isin,
                        "status": "error",
                        "years_span": "",
                        "first_date": fd,
                        "last_date": ld,
                        "reason": "missing_required_fields"
                    })
                    continue

                try:
                    d0 = parse_date(fd)
                    d1 = parse_date(ld)
                    if d1 < d0:
                        raise ValueError("last_date_before_first_date")
                    days = (d1 - d0).days
                    years_span = round(days / 365.25, 3)
                    span_ok = years_span >= 2.0
                except Exception as e:
                    errors += 1
                    writer.writerow({
                        "isin": isin,
                        "status": "error",
                        "years_span": "",
                        "first_date": fd,
                        "last_date": ld,
                        "reason": f"date_parse_error:{e}"
                    })
                    continue

                doc_ref = db.collection("funds_v2").document(isin)
                doc = doc_ref.get()
                if not doc.exists:
                    missing_doc += 1
                    writer.writerow({
                        "isin": isin,
                        "status": "skipped",
                        "years_span": years_span,
                        "first_date": fd,
                        "last_date": ld,
                        "reason": "missing_fund_doc"
                    })
                    continue

                writer.writerow({
                    "isin": isin,
                    "status": "ok" if args.apply else "dry_run_ok",
                    "years_span": years_span,
                    "first_date": fd,
                    "last_date": ld,
                    "reason": ""
                })

                if args.apply:
                    data_quality = doc.to_dict().get("data_quality") or {}
                    std_extra = doc.to_dict().get("std_extra") or {}
                    std_extra["firstDate"] = fd
                    std_extra["lastDate"] = ld
                    std_extra["yearsHistory_span"] = years_span
                    data_quality["history_span_ok_2y"] = span_ok
                    data_quality["last_checked_at"] = datetime.utcnow()

                    batch.update(doc_ref, {
                        "std_extra": std_extra,
                        "data_quality": data_quality,
                        "schema_version": 3,
                    })
                    batch_ops += 1
                    updated += 1

                    if batch_ops >= 450:
                        batch.commit()
                        batch = db.batch()
                        batch_ops = 0

        if args.apply and batch_ops > 0:
            batch.commit()

    print("DONE")
    print("updated:", updated)
    print("missing_doc:", missing_doc)
    print("errors:", errors)
    print("report:", args.out)

if __name__ == "__main__":
    main()
