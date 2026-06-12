# BDB - RUNBOOK de despliegue: remediacion auditoria 2026-06-09

Rama: audit/remediation-batch-2026-06-09 (commit local, pendiente de push).
Contenido: fixes H1-H4 (ALTA+1), H5p/H6p/H7/H8/H9 (MEDIA), H11/H12p/H13/H14/H16/H17b
(BAJA) + decision de candidatos por tramo y vol_bands 8-10. 474 tests verdes en local.

EJECUTAR EN ESTE ORDEN (desde tu maquina, con credenciales):

## 1. Push + PR + CI
    git push -u origin audit/remediation-batch-2026-06-09
    # Abrir PR hacia master; esperar CI completa (incluye tests de endpoints
    # con firebase_functions que no son ejecutables en sandbox).

## 2. Gate shadow/live (OBLIGATORIO antes de deploy)
    # Procedimiento habitual del repo (scripts/audit/shadow_compare_optimizer.py).
    # Atencion especial a:
    #  - H1: carteras con locks > max_weight cambian de equal-weight a optimas
    #    (diferencias ESPERADAS y deseadas; clasificar como EXPECTED).
    #  - H2: perfiles <=4 con auto-expand ahora pueden devolver auto_expand_failed
    #    honesto (EXPECTED).
    #  - H3: el caso historico-insuficiente pasa de status 'error' a 'infeasible'.

## 3. Merge + deploy
    firebase deploy --only functions      # backend (REQUISITO para el paso 4)
    firebase deploy --only hosting        # frontend (H3/H11 tocan usePortfolioActions)

## 4. Write-gate de vol_bands 8-10 (SOLO tras desplegar el backend del paso 3)
    cd functions_python
    # Dry-run (read-only):
    python scripts/maintenance/set_aggressive_vol_bands.py
    # Escritura con gate:
    BDB_WRITE_GATE_AUTHORIZATION="AUTORIZO WRITE GATE VOL_BANDS 8-10" \
        python scripts/maintenance/set_aggressive_vol_bands.py --execute
    # NUNCA antes del paso 3: el backend antiguo (sin H17-b) degradaria TODOS
    # los perfiles a seeds al encontrar la clave 'vol_bands'.

## 5. Post-deploy
    # a) Smoke del optimizador (caso normal + caso con lock >20%).
    # b) Drift de seeds (read-only):
    python scripts/audit/check_risk_profiles_seed_drift.py
    #    Si reporta drift en P5-P10 (esperado segun la auditoria), regenerar
    #    las seeds de config.py y rulesEngine.ts desde el canonico (H6 valores).
    # c) Telemetria: dashboards que cuenten status 'error' vs 'infeasible'.
    # d) (opcional, recomendado tras unos dias) recalibrar railes de vol_bands
    #    con la mediana realizada de carteras 8-10 (~0.7x / ~1.6x).

## Opcional
    # Poblar listas por tramo en config/auto_complete_candidates
    # (defensive_isins / moderate_isins / growth_isins) via write-gate propio.
