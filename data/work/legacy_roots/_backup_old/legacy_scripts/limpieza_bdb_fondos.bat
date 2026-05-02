@echo off
echo ===============================
echo LIMPIEZA BDB-FONDOS (SEGURA)
echo ===============================

REM Crear carpeta backup
set BACKUP=_backup_old

if not exist %BACKUP% (
    mkdir %BACKUP%
)

echo.
echo Moviendo carpetas de test y ruido...

REM Tests Python
if exist pytest-cache-files-* (
    move pytest-cache-files-* %BACKUP% >nul
)

if exist tests (
    move tests %BACKUP% >nul
)

REM Carpetas dudosas (NO borrar, mover)
if exist docs (
    move docs %BACKUP% >nul
)

if exist schemas (
    move schemas %BACKUP% >nul
)

if exist services (
    move services %BACKUP% >nul
)

echo.
echo Limpiando entradas duplicadas...

REM Mantener solo test_input
if exist ENTRADA (
    move ENTRADA %BACKUP% >nul
)

if exist ENTRADA_TEST (
    move ENTRADA_TEST %BACKUP% >nul
)

echo.
echo Moviendo scripts no necesarios...

if not exist scripts (
    mkdir scripts
)

if exist apply_manual_overrides.js (
    move apply_manual_overrides.js scripts >nul
)

for %%f in (audit_*.js) do (
    move %%f scripts >nul
)

echo.
echo ===============================
echo LIMPIEZA COMPLETADA
echo ===============================
echo.

echo Estructura recomendada:
echo - test_input  (entrada)
echo - PROCESADOS  (salida)
echo - cargador_lotes_v_2.js (core)

echo.
pause