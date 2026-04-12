from firebase_admin import firestore


def write_history_canonical(
    db: firestore.Client,
    isin: str,
    history_list: list,
    source="EODHD",
    source_format="canonical",
    batch=None,
):
    """
    Writes historical data to 'historico_vl_v2' using the strict canonical schema (v3).

    Args:
        db: Firestore client
        isin: Fund ISIN (Document ID)
        history_list: List of dicts, must contain 'date' (YYYY-MM-DD string) and 'nav' (float).
        source: Origin of data.
        source_format: Original format description.
        batch: Optional Firestore batch object.
    """
    if not isin:
        raise ValueError("Invalid ISIN")

    if not history_list or not isinstance(history_list, list):
        raise ValueError(f"Invalid history_list for {isin}: Must be a non-empty list.")

    clean_history = []

    for item in history_list:
        if not isinstance(item, dict):
            continue

        date_str = item.get("date")
        nav_val = item.get("nav")

        # Validation: Date
        if not date_str or not isinstance(date_str, str) or len(date_str) != 10:
            continue  # Skip invalid dates

        # Validation: NAV (Must be float)
        if nav_val is None:
            continue
        try:
            nav_float = float(nav_val)
        except (ValueError, TypeError):
            continue  # Skip invalid NAVs

        clean_history.append({"date": date_str, "nav": nav_float})

    if not clean_history:
        raise ValueError(
            f"No valid history items found for {isin} after validation (input size: {len(history_list)})."
        )

    # Sort by date ascending
    clean_history.sort(key=lambda x: x["date"])

    doc_ref = db.collection("historico_vl_v2").document(isin)

    # ---------------------------------------------------------
    # ATOMIC MERGE LOGIC (Phase 2 Fix)
    # Instead of blindly overwriting, we fetch existing history
    # and merge it. This prevents dropping years of data if a
    # partial update (e.g., last 30 days) is sent.
    # ---------------------------------------------------------
    existing_doc = doc_ref.get()
    if existing_doc.exists:
        existing_data = existing_doc.to_dict()
        existing_history = existing_data.get("history", [])

        # Create a dictionary for O(1) merging by date
        merged_dict = {
            item["date"]: item
            for item in existing_history
            if isinstance(item, dict) and "date" in item and "nav" in item
        }

        # Overwrite/Add new data
        for item in clean_history:
            merged_dict[item["date"]] = item

        # Re-sort the completely merged list
        final_history = list(merged_dict.values())
        final_history.sort(key=lambda x: x["date"])
    else:
        final_history = clean_history

    # Metadata calculation on the FINAL merged dataset
    min_date = final_history[0]["date"]
    max_date = final_history[-1]["date"]
    count = len(final_history)

    doc_data = {
        "history": final_history,
        "schema_version": 3,
        "source": source,
        "source_format": source_format,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "metadata": {"count": count, "min_date": min_date, "max_date": max_date},
    }

    # We still use set() but now we are writing the *merged* secure dataset.
    # Using merge=True on set() wouldn't merge arrays natively in Firestore
    # the way we want (by date). It just replaces the 'history' array.
    if batch:
        batch.set(doc_ref, doc_data)
        # print(f"📝 Added to Batch: {isin}")
    else:
        doc_ref.set(doc_data)
        print(
            f">> Canonical Write Success: {isin} ({count} total points post-merge, v3)"
        )

    return count
