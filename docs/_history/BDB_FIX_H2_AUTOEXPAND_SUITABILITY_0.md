# BDB - FIX H2: suitability en auto-expand (auditoria 2026-06-09)

**Fecha:** 2026-06-09
**Origen:** AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf, hallazgo H2 (ALTA).
**Estado:** aplicado en working tree; pendiente de commit/PR y deploy controlado.
**Depende de:** FIX H3 (retorno estructurado de historico insuficiente), ya aplicado.

## Problema

El filtro regulatorio de idoneidad (Nivel 2, `is_fund_eligible_for_profile`) se
ejecutaba solo en FASE 2 sobre los activos solicitados. Los dos puntos de
auto-expand inyectaban candidatos al universo DESPUES del filtro:

- **FASE 7 (equity floor):** hasta 6 candidatos de `_build_auto_expand_candidates`
  (filtrados solo por equity>=90% y Sharpe) o de `FALLBACK_CANDIDATES_DEFAULT`.
  Un perfil 3 podia acabar con RV emergente/sectorial vetada, sin disclosure.
- **FASE 3 (historico insuficiente):** misma omision; ademas los candidatos
  anadidos no llevaban su metadata al universo y computaban como 100% 'Otros'
  en los vectores de exposicion.
- Los `recovery_candidates` ofrecidos al usuario tampoco se filtraban.

## Cambio (solo optimizer_core.py)

1. Nuevo helper `_filter_autoexpand_candidates_by_suitability(...)`: aplica el
   MISMO filtro de Nivel 2 a los candidatos, usando la metadata de
   `candidate_funds` o `asset_metadata`. Sin `classification_v2` utilizable el
   candidato se EXCLUYE (prudente). Con `apply_profile=False` o sin
   `risk_level` no se filtra (coherente con FASE 2). Devuelve
   `(aptos, excluidos[{isin, reason}])`.
2. **FASE 7:** filtro antes de inyectar; si no quedan candidatos aptos se
   devuelve `auto_expand_failed` con mensaje claro ("No hay fondos candidatos
   aptos para el perfil...") en lugar de inyectar fondos vetados. Los retornos
   `auto_expand_failed` incluyen ahora `applicable/usable: false`.
3. **FASE 3:** filtro antes de la expansion por historico y tambien sobre los
   `recovery_candidates` del retorno estructurado `infeasible`. Si ningun
   candidato es apto, se degrada a la ruta estructurada de historico
   insuficiente (recovery vacio). Anexo: los candidatos anadidos llevan su
   metadata real al universo (antes computaban como 'Otros').
4. **Divulgacion:** las exclusiones se exponen en
   `explainability.auto_expand_suitability_excluded` (exito, fallo y retorno
   estructurado de historico) y en logs.

Firmas: `_build_candidate_universe` y `_check_feasibility_and_autoexpand`
ganan kwargs opcionales (`risk_level`, `apply_profile`,
`autoexpand_diagnostics`) — compatibles hacia atras (tests existentes pasan
sin cambios, salvo el contrato H3 actualizado descrito abajo).

## Cambios de comportamiento a vigilar

- **Perfiles <=4 con suelo de RV y auto_expand:** los candidatos equity>=90 del
  endpoint estan tipicamente vetados por el limite de equity por fondo del
  perfil (45%/60%): el sistema ahora devuelve `auto_expand_failed` honesto en
  vez de inyectar fondos no aptos. La UX guia a anadir fondos compatibles
  manualmente (el FE ya tiene ese dialogo).
- **`recovery_candidates`** puede llegar vacio si ningun candidato es apto; el
  FE ya cubre ese caso con su propia busqueda (`selectAutoExpandCandidates`).
- El test de contrato H3 `test_short_history_exposes_default_recovery_candidates`
  se sustituyo por dos: con perfil activo los 5 hardcoded sin metadata se
  excluyen y divulgan; con `apply_profile=False` se conserva el contrato previo.

## Evidencia

- Nuevo `tests/test_optimizer_autoexpand_suitability.py` (9 tests): unidad del
  filtro (EM equity vetado en P3 / apto en P7, sin metadata, bypass sin perfil),
  FASE 7 (exclusion + corte temprano divulgado) y FASE 3 (recovery filtrado y
  divulgado, recovery vacio).
- Suite de motor: `337 passed` en local (26 ficheros de tests, incluye H3+H2).
- Sin cambios en endpoints ni frontend: el filtrado en el motor cubre todos los
  callers (endpoint, scripts shadow, e2e).

## Pendiente opcional (no bloqueante)

- `_build_auto_expand_candidates` (endpoint) podria pre-filtrar por perfil para
  ofrecer candidatos utiles a perfiles bajos (hoy solo equity>=90). Decision de
  producto: que candidatos ofrecer a perfiles 1-4 (mixtos/RF en lugar de RV90).
- Pasar el gate shadow/live habitual antes del deploy.
