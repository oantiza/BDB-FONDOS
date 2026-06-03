# Unified Constraints Rollout Report - 2026-06-03

## Estado

Rollout activado y observado sin errores recientes.

- Repo: `oantiza/BDB-FONDOS`
- Rama desplegada: `master`
- Commit desplegado: `fbdef7b Remove Mixto from constraint vocabulary`
- Hosting live: `https://bdb-fondos.web.app`
- Flag: `system_settings/feature_flags.unified_constraints = true`
- Rollout status: `enabled`
- Activado en UTC: `2026-06-03T10:40:57.8834632Z`

## Cambios Previos Al Rollout

1. Snapshot previo de Firestore creado en `artifacts/rollout/20260603T100638Z`.
2. Flag pausado para despliegue conservador: `paused_for_deploy`.
3. Preview Hosting creado:
   `https://bdb-fondos--audit-rem3-preview-9ombo32a.web.app`
4. Drift bloqueante de `compatible_profiles` corregido mediante write gate de 6 ISINs:
   `artifacts/suitability/compatible_profiles_write_gate_remediation_20260603T101217Z`
5. Post-check de suitability:
   - `blocking_stale_count = 0`
   - `populated_stale_count = 0`
6. Functions desplegadas correctamente.
7. Hosting live desplegado correctamente.

## Evidencias

### Smoke Antes De Activar Flag

- Hosting live: HTTP 200
- Functions clave: `ACTIVE`
- Shadow/live post-deploy con flag pausado:
  - Total: 14
  - PASS: 7
  - EXPECTED: 7
  - FAIL: 0
  - INVESTIGATE: 0
  - Manifest: `artifacts/shadow/shadow_live_20260603T102435Z.json`

### Activacion Del Flag

- Snapshot previo del flag:
  `artifacts/rollout/flag_activation_20260603T104056Z`
- Smoke real sin override local:
  `artifacts/rollout/unified_flag_smoke_20260603T104245Z.json`

Resultados del smoke:

| Perfil | Status | Constraint source | Resultado |
| --- | --- | --- | --- |
| 5 | `optimal_compliant` | `unified_effective_bounds` | PASS |
| 8 | `infeasible_equity_floor` | `unified_effective_bounds` | EXPECTED |

### Shadow Con Flag ON

- Manifest: `artifacts/shadow/shadow_live_20260603T104348Z.json`
- Total: 14
- PASS: 7
- EXPECTED: 7
- FAIL: 0
- INVESTIGATE: 0

### Observacion Inmediata

- Hosting live: HTTP 200
- `optimize_portfolio_quant`: latest revision ready, 100% traffic
- `analyze_portfolio_endpoint`: latest revision ready, 100% traffic
- Cloud Logging, ventana reciente: sin entradas `ERROR`

### Prueba Manual UI

Tras prueba manual autenticada desde la UI:

- `getRiskRate`: POST 200
- `getEfficientFrontier`: POST 200
- `backtest_portfolio_multi`: POST 200
- `optimize_portfolio_quant`: POST 200, latencia aprox. 6.7s
- Cloud Logging, ventana posterior a la prueba: sin entradas `ERROR`

Logs observados como no bloqueantes:

- `STARTUP TCP probe succeeded`: arranque normal de contenedor.
- `Starting new instance. Reason: AUTOSCALING`: cold start/autoscaling normal.
- `[DataFetcher] Large daily variance (>15%) ... Proceeding with despiking`: warning de limpieza de datos para `FR0011170182`; no bloquea el rollout, pero queda como seguimiento de calidad de dato.
- `[Backtester] Period=...`: informativo.

## Cambios Esperados

Los perfiles 7-10 pueden cambiar de `fallback_non_compliant` a `infeasible_equity_floor`.
Esto es esperado por el contrato nuevo: el `equity_floor` deriva de los bounds efectivos de `RV`.

## Rollback

Rollback rapido del motor unificado:

1. Poner `system_settings/feature_flags.unified_constraints = false`.
2. Poner `system_settings/feature_flags.unified_constraints_rollout.status = "paused_for_rollback"`.
3. Repetir smoke de perfil 5.
4. Revisar logs `ERROR` en Cloud Logging.

Rollback de datos de los 6 fondos:

- Usar solo bajo instruccion explicita.
- Manifest disponible en:
  `artifacts/suitability/compatible_profiles_write_gate_remediation_20260603T101217Z/rollback_manifest.json`

Rollback de Hosting/Functions:

- Usar Firebase Console para volver a la version anterior si aparece fallo visible no mitigable por flag.

## Pendientes Recomendados

1. Ejecutar una optimizacion manual desde la UI con usuario autenticado, preferiblemente perfil 5.
2. Revisar logs justo despues de esa llamada real.
3. Mantener observacion durante las proximas horas.
4. En otro bloque, promover o alinear `risk_profiles` canonico con `risk_profiles_staging` para retirar definitivamente `Mixto` tambien del doc canonico.
