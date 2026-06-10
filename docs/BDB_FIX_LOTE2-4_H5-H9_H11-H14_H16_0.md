# BDB - FIX lotes 2-4: H5p, H6p, H7, H8, H9, H11, H12p, H13, H14, H16 (auditoria 2026-06-09)

**Fecha:** 2026-06-09
**Origen:** AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf.
**Estado:** aplicado en working tree; pendiente de commit/PR, CI completa, shadow/live y deploy.
**Previos:** H1-H4 ya aplicados (docs BDB_FIX_H1..H4).

## MEDIA

### H9 — precheck legacy con claves canonicas (optimizer_core.py, feasibility_precheck.py)
La ruta legacy (flag OFF) pasaba bounds del perfil con claves canonicas
(RV/RF/...) y vectores con claves v1 (equity/bond/...): BLOCK-6/7/9 quedaban
INERTES en silencio. Ahora la exposicion del precheck expone AMBOS vocabularios
(mismo criterio que BLOCK-8) y los mapas de etiquetas de BLOCK-6/7 incluyen las
claves canonicas. Test e2e: perfil 9 con universo de bonos+mixto bloquea en
precheck (BLOCK_BUCKET_MIN_UNATTAINABLE bucket RV) en vez de llegar al solver.
Nota: el test test_run_optimization_flag_off_precheck_keeps_legacy_v1_bounds
fijaba el desalineamiento ('RV' ausente) y se actualizo al contrato vigente.

### H7 — last-known-good del feature flag (feature_flags.py)
Un fallo de lectura devolvia False ("OFF"), revirtiendo la peticion a la ruta
legacy (otra semantica de buckets y precheck degradado). Ahora un fallo
transitorio conserva la ultima lectura valida del proceso; sin lectura previa,
OFF como antes. El override por entorno sigue teniendo prioridad. Nuevo
reset_unified_constraints_cache() para tests.

### H6 (parcial) — visibilidad de la politica aplicada
(a) optimizer_core: nueva clave explainability.risk_profiles_source
("firestore:risk_profiles", "firestore:risk_profiles_staging",
"seed_auto_initialized_write", "seed_fallback_read_error") y warning
'risk_profiles_seed_fallback' cuando la politica aplicada NO es la canonica.
(b) Nuevo scripts/audit/check_risk_profiles_seed_drift.py: comparador READ-ONLY
seed vs canonico (exit 1 si drift; apto para CI/cron con credenciales).
PENDIENTE (requiere lectura live): regenerar los VALORES de las seeds
(config.py y rulesEngine.ts) desde el canonico — el script lista el diff exacto.

### H8 — sin banda de volatilidad sintetica para perfiles 8-10 (constraints_builder_v1.py)
El builder cambia el objetivo a max_sharpe en 8-10 porque el target_vol del
seed es inalcanzable, pero sintetizaba igualmente la banda +-2pp centrada en
ese target (P10: minimo 28% vs vol realista 15-18%): warning permanente
VOL_BAND_MIN_VIOLATION y bloqueo casi sistematico en modo estricto. Ahora, sin
banda EXPLICITA (override o perfil), no se sintetiza ninguna para 8-10; los
perfiles 1-7 conservan el default. Bandas explicitas se respetan siempre.
Decision de negocio pendiente: definir vol_band explicita por perfil en el doc
canonico si se desea auditoria de banda en 8-10.

### H5 (parcial) — umbral %/fraccion alineado (utils.py)
_as_fraction usaba umbral 1.5 (un 1.2 porcentual se leia como 120%->100%);
alineado al criterio del resto del backend (>1.0 -> /100), igual que
_sanitize_fraction y bounds_resolver._coerce_bound. Datos canonicos verificados
en fraccion 0..1: sin impacto en V2; corrige porcentajes legacy en (1.0, 1.5].
PENDIENTE (H5 completo): parser unico compartido BE+TS y validador de escala en
ingesta; persiste la divergencia FE/BE en esa banda sin datos reales hoy.

## BAJA

### H11 — codigo de bloqueo correcto en FE (usePortfolioActions.ts)
getMinAssetsNeededFromResult buscaba 'UNIVERSE_TOO_SMALL'; el backend emite
'BLOCK_UNIVERSE_TOO_SMALL' (funcionaba de rebote por regex del mensaje). Ahora
acepta ambos codigos.

### H12 (parcial) — contrato de respuesta
El retorno bloqueado por precheck incluye 'frontier' (alias de
'frontier_points', la clave que lee el FE en exitos); el retorno
infeasible_equity_floor de FASE 7 incluye metrics/applicable/usable; los
retornos auto_expand_failed ya incluian applicable/usable desde el FIX H2.
Pendiente: unificacion completa de claves duplicadas (violations vs
constraint_violations) — requiere coordinar FE.

### H13 — punto de cartera de la frontera (frontier_engine.py)
Se normalizaba sobre TODA la cartera y los pesos de activos excluidos por
historial se perdian despues: vector sin sumar 1 y punto (vol, ret)
infraestimado. Ahora se normaliza solo sobre los activos presentes.

### H14 — 'ytd' real (frontier_engine.py, backtester.py)
frontier_engine aproximaba ytd con 252 dias; backtester ni lo mapeaba y caia en
silencio a 3 anios. Ambos calculan ahora desde el 1 de enero del anio en curso.

### H16 — presupuesto real de locks en auto-expand (optimizer_core.py)
La estimacion de equity alcanzable asumia que cada lock consumia
max(0.03, max_weight); con locks pequenos sobre-consumia presupuesto y podia
declarar inalcanzable un floor alcanzable (infeasible_equity_floor espurio).
Ahora usa el peso real del lock cuando existe.

## Evidencia

- tests/test_fix_batch2_resilience.py (14 tests: H5, H6, H7, H8, H9+H12).
- tests/test_fix_batch4_low_findings.py (5 tests: H13, H14, H16).
- Tests de contrato actualizados con justificacion: test_unified_constraints_contract
  (H9) y test_regression_coverage::test_optimizer_short_history (H3).
- Barrido completo del arbol tests/ ejecutable en sandbox: 465 passed, 0 failed
  (excluidos solo los ficheros que requieren firebase_functions y tests/xray,
  que corren en CI). Sintaxis FE verificada (typescript, 0 diagnosticos).

## Quedan abiertos (del informe)

- H5 completo (parser unico BE+TS + validador de ingesta) — esfuerzo medio.
- H6 valores (regenerar seeds desde canonico con lectura live; usar el script).
- H8 negocio (bandas explicitas por perfil si se desean en 8-10).
- H10 (pure_markowitz via v1 re-aplica perfil; latente, FE no lo usa),
  H12 resto, H15 (metodologia backtest vs benchmarks + clipping visible),
  H17 (escritura colateral del seed + claves no numericas),
  H18 (casos borde de la degradacion equal-weight),
  H19 (marcar origen de metadata de cliente).
