# BDB - DECISION: candidatos auto-expand por tramo + vol bands 8-10 (2026-06-09)

**Fecha:** 2026-06-09
**Origen:** decisiones de negocio abiertas tras los fixes H2 y H8 de la
auditoria AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf.
**Criterios aprobados por el usuario:** coherentes, no bloqueantes de forma
innecesaria, y con margen para una base de ~700 fondos.
**Estado:** codigo aplicado en working tree; la escritura de bandas requiere
ejecutar el write-gate TRAS desplegar el backend.

## 1. Candidatos de auto-expand por perfil

Politica: la elegibilidad del perfil (is_fund_eligible_for_profile) es el UNICO
gate duro; la afinidad de tramo solo ORDENA; si el tramo preferente no llena el
pool minimo (6), se rellena con cualquier fondo elegible por Sharpe. Pool de
hasta 12 candidatos sobre una consulta top-150 por Sharpe (antes: top-50 y solo
equity>=90, inutilizable en perfiles <=4).

Afinidad por tramo (preferencia, con margen):
- P1-P2: monetarios y RF (el suelo de RV es 0; el auto-expand aqui es por historico).
- P3-P4: mixtos con RV 25-65% look-through (la via apta de aportar equity; el
  cap por fondo del perfil —45%/60%— sigue siendo el gate real).
- P5-P7: RV >=45% y mixtos.
- P8-P10: cuanta mas RV mejor; >=80% ya es preferente fuerte (margen sobre el
  eq>=90 anterior).

Implementacion: selector PURO en services/portfolio/autoexpand_candidates.py
(testeable sin firebase) + rework de _build_auto_expand_candidates(db,
risk_level) en endpoints_portfolio.py. El doc config/auto_complete_candidates
admite ahora listas por tramo (defensive_isins, moderate_isins, growth_isins,
equity90_isins) como fallback gobernado. El filtro del motor (FIX H2) queda
como red de seguridad final. Sin risk_level se conserva el criterio legado.

## 2. Bandas de volatilidad explicitas 8-10

Politica: railes de cordura ANCHOS con enforcement SOFT (no bloquean; solo
strict_feasibility las endurece). El riesgo de 8-10 lo gobiernan las bandas de
asset allocation; la banda de vol avisa de anomalias (fondos mal clasificados,
datos planos) o riesgo extremo:

    P8 : target 0.15, banda [0.08, 0.28]
    P9 : target 0.16, banda [0.09, 0.30]
    P10: target 0.17, banda [0.10, 0.35]

Almacenamiento: campo PARALELO 'vol_bands' en system_settings/risk_profiles
(no dentro del mapa de buckets: contaminaria el resolutor unificado y el
precheck). Soporte de codigo: merge_profile_vol_band (constraints_builder_v1,
puro) + merge en _load_canonical_profile (endpoint) + FIX H17-b en
optimizer_core (las claves no numericas del doc ya no degradan TODO a seeds —
prerequisito imprescindible).

Escritura: scripts/maintenance/set_aggressive_vol_bands.py — dry-run por
defecto; escribe solo con --execute y BDB_WRITE_GATE_AUTHORIZATION=
"AUTORIZO WRITE GATE VOL_BANDS 8-10". ORDEN OBLIGATORIO: desplegar backend
(H17-b + merge) ANTES de ejecutar el write-gate. Recomendado recalibrar railes
tras una pasada shadow/live (~0.7x / ~1.6x de la mediana realizada).

## Evidencia

tests/test_decision_candidates_vol_bands.py (9 tests): tramos P3/P9, exclusion
de no aptos (EM, equity>cap del perfil), relleno hasta pool minimo, descarte
por mala calidad de datos, criterio legado sin risk_level, merge de bandas,
builder auditando banda explicita de P9 con target realista, y H17-b (el campo
paralelo no invalida los perfiles). Barrido completo: 474 passed.
