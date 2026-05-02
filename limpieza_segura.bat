@echo off
setlocal enabledelayedexpansion
echo ========================================================
echo BDB-FONDOS: LIMPIEZA Y REORGANIZACION SEGURA DEL REPO
echo ========================================================
echo.
echo Este script reorganizara los archivos sueltos y movera 
echo la basura/legacy a _backup_old sin eliminar tu codigo.
echo.
pause

:: Crear directorios si no existen
if not exist "_backup_old" mkdir "_backup_old"
if not exist "_backup_old\audits_and_dumps" mkdir "_backup_old\audits_and_dumps"
if not exist "_backup_old\legacy_scripts" mkdir "_backup_old\legacy_scripts"
if not exist "_backup_old\pytest_cache" mkdir "_backup_old\pytest_cache"
if not exist "scripts" mkdir "scripts"

echo [1/5] Moviendo archivos JSON y volcados CSV/MD antiguos...
move /Y funds_v3.json _backup_old\audits_and_dumps\ 2>nul
move /Y funds_v3_backup.json _backup_old\audits_and_dumps\ 2>nul
move /Y funds_v3_repaired.json _backup_old\audits_and_dumps\ 2>nul
move /Y funds_v3_region_inferred.json _backup_old\audits_and_dumps\ 2>nul
move /Y funds_eligibility.json _backup_old\audits_and_dumps\ 2>nul
move /Y audit_funds_v3_details.jsonl _backup_old\audits_and_dumps\ 2>nul
move /Y audit_funds_v3_summary.json _backup_old\audits_and_dumps\ 2>nul
move /Y audit_inconsistent_derived.csv _backup_old\audits_and_dumps\ 2>nul
move /Y audit_unknown_subtypes.csv _backup_old\audits_and_dumps\ 2>nul
move /Y no_fill_report.md _backup_old\audits_and_dumps\ 2>nul
move /Y memory_graph.jsonl _backup_old\audits_and_dumps\ 2>nul
move /Y BDB-FONDOS_backup.zip _backup_old\audits_and_dumps\ 2>nul
move /Y limpieza_bdb_fondos.bat _backup_old\legacy_scripts\ 2>nul

echo [2/5] Moviendo scripts y pruebas legacy...
move /Y cargador_lotes.js _backup_old\legacy_scripts\ 2>nul
move /Y cargador_lotes_CORREGIDO.js _backup_old\legacy_scripts\ 2>nul
move /Y scratch_*.cjs _backup_old\legacy_scripts\ 2>nul

echo [3/5] Moviendo utilidades satelite a la carpeta scripts/ ...
move /Y infer_region_primary_bdb.py scripts\ 2>nul
move /Y populate_taxonomy_v2_FINAL.py scripts\ 2>nul
move /Y seed_emulator_data.py scripts\ 2>nul
move /Y test_v2_refinement.py scripts\ 2>nul
move /Y convert_font.py scripts\ 2>nul
move /Y create_fonts_ts.py scripts\ 2>nul
move /Y recalculate_derived_fields.js scripts\ 2>nul
move /Y validate_manual_overrides.js scripts\ 2>nul
move /Y audit_derived_unknowns.js scripts\ 2>nul
move /Y ISIN_Nombres.csv scripts\ 2>nul

echo [4/5] Moviendo caches antiguas de pytest a _backup_old...
for /D %%p in (pytest-cache-files-*) do (
    echo Moviendo %%p
    move "%%p" "_backup_old\pytest_cache\" >nul 2>nul
)

echo [5/5] Reorganizacion completada.
echo.
echo NOTA: cargador_lotes_v_2.js, las carpetas CORE y todo tu codigo productivo
echo se mantienen INTACTOS en la raiz.
echo.
pause
