# BDB-FONDOS: Script Directory

## Folder Structure

- `audit/`: Inspection and QA scripts (read-only).
- `migration/`: Structural changes and controlled bulk recalculations.
- `fixes/`: Corrective scripts for data.
- `reports/`: Scripts for generating or manipulating output reports/data.
- `debug/`: Manual diagnostic scripts.
- `tests/`: Technical system validation scripts.
- `sandbox/`: Experimental scripts.
- `archive/`: Legacy or inactive scripts.

## Script Catalog

| Script | Category | Status | Mutates Data | Description |
| :--- | :--- | :--- | :--- | :--- |
| `analyze_history_anomalies.py` | `audit` | `ACTIVE` | ❌ No | No description |
| `audit_fund_data.py` | `audit` | `ACTIVE` | ❌ No | No description |
| `audit_taxonomy_v2.py` | `audit` | `ACTIVE` | ❌ No | No description |
| `check_reports.py` | `audit` | `ACTIVE` | ❌ No | Verifica la integridad de los reportes generados. |
| `sample_taxonomy_review_50.py` | `audit` | `ACTIVE` | ❌ No | No description |
| `scoring_comparison.py` | `audit` | `ACTIVE` | ❌ No | Compara algoritmos de scoring de fondos. |
| `check_and_import_retrocesion.py` | `migration` | `ACTIVE` | ❌ No | No description |
| `migrate_reports.py` | `migration` | `ACTIVE` | ❌ No | No description |
| `populate_taxonomy_v2.py` | `migration` | `ACTIVE` | ❌ No | No description |
| `cleanup_dummy_reports.py` | `fixes` | `ACTIVE` | ✅ Yes | Elimina reportes de prueba del sistema. |
| `fix_anomalies.py` | `fixes` | `ACTIVE` | ❌ No | No description |
| `fix_data_anomalies.py` | `fixes` | `ACTIVE` | ❌ No | No description |
| `trim_last_anomaly.py` | `fixes` | `ACTIVE` | ❌ No | No description |
| `generate_benchmarks.py` | `reports` | `ACTIVE` | ❌ No | No description |
| `insert_dummy_reports.py` | `reports` | `ACTIVE` | ✅ Yes | Inserta reportes ficticios para pruebas de UI. |
| `insert_report_function.py` | `reports` | `ACTIVE` | ❌ No | No description |
| `insert_user_report.py` | `reports` | `ACTIVE` | ❌ No | No description |
| `recalc_metrics_batch.py` | `reports` | `ACTIVE` | ❌ No | No description |
| `recalc_metrics_single.py` | `reports` | `ACTIVE` | ❌ No | No description |
| `debug_fondibas.py` | `debug` | `ACTIVE` | ❌ No | No description |
| `debug_reports.py` | `debug` | `ACTIVE` | ❌ No | No description |
| `find_fund_by_isin.py` | `debug` | `ACTIVE` | ❌ No | Localiza y muestra todos los datos de un fondo por su ISIN. |
| `inspect_anomaly_dates.py` | `debug` | `ACTIVE` | ❌ No | No description |
| `inspect_categories.py` | `debug` | `ACTIVE` | ❌ No | No description |
| `inspect_fund_data.py` | `debug` | `ACTIVE` | ❌ No | Inspecciona estructura interna de documentos de fondos. |
| `inspect_ter.py` | `debug` | `ACTIVE` | ❌ No | Inspecciona datos de TER y comisiones. |
| `test_gemini_models.py` | `tests` | `ACTIVE` | ❌ No | Verifica conectividad y respuesta de modelos Gemini. |
| `test_optimizer.py` | `tests` | `ACTIVE` | ❌ No | No description |
| `test_research.py` | `tests` | `ACTIVE` | ❌ No | No description |
| `test_smart_portfolio.py` | `tests` | `ACTIVE` | ❌ No | No description |
| `debug_frontier_local.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `debug_test.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `inspect_fund_debug.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `reproduce_frontier.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `temp_fetch_hcz61.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `temp_func.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `test_optimizer_crash.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `test_real_frontier.py` | `sandbox` | `ACTIVE` | ❌ No | No description |
| `populate_taxonomy_v2_FINAL_STABLE.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `populate_taxonomy_v2_STABLE_31conflicts.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `populate_taxonomy_v2_STABLE_71conflicts.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `populate_taxonomy_v2_backup.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `sample_taxonomy_review_50_FINAL_STABLE.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `sample_taxonomy_review_50_STABLE_31conflicts.py` | `archive` | `ACTIVE` | ❌ No | No description |
| `sample_taxonomy_review_50_STABLE_71conflicts.py` | `archive` | `ACTIVE` | ❌ No | No description |