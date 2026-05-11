# BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0
## Informe Final de Auditoría — Contrato Hardcoded de Suitability/Elegibilidad

**Bloque:** `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0`  
**Fecha:** 2026-05-11  
**Modo:** Read-only audit (sin modificaciones, sin Firestore writes, sin deploy)  
**Base commit:** `5686d56` (EQUITY_FLOOR audit cerrado)  
**Tests ejecutados:** 62/62 PASS  
**Conclusión general:** ⚠️ WARNINGS — arquitectura funcional pero con deuda técnica en duplicación frontend/backend y `compatible_profiles` como campo potencialmente desactualizado.

---

## A. Resumen Ejecutivo

- **Auditoría:** Read-only total. 0 Firestore writes. 0 deploy. 0 cambios de código.
- **Estado del motor backend:** `suitability_engine.py` (112 líneas) — activo, compacto, con tests.
- **Estado del frontend:** `rulesEngine.ts` (683 líneas) — réplica de presentación con reglas duplicadas, autodeclarada como temporal.
- **Veredicto:** Las reglas de suitability backend están correctas y probadas. El riesgo real no es la lógica hardcoded en sí, sino la **duplicación frontend/backend** y el **estado desconocido de `compatible_profiles`** en Firestore tras la remediación MIXED.

---

## B. Mapa Backend — Reglas Hardcoded de Suitability

### B.1 Función principal: `is_fund_eligible_for_profile(asset_meta, risk_profile)` — `suitability_engine.py`

| # | Regla | Condición exacta (código) | Perfiles afectados | Campo(s) usados | Motivo aparente | Hardcoded | Test existente |
|---|-------|--------------------------|---------------------|-----------------|-----------------|-----------|----------------|
| 1 | Strict V2 requirement | `if not class_v2: return False` | 1-10 (todos) | `classification_v2` | Evitar fondos legacy sin clasificar en el motor | ✅ Sí | ✅ `TestAmbiguousNoV2` |
| 2 | Missing exposure → block conservadores | `if not has_v2_exposure and risk_profile <= 4: return False` | 1-4 | `portfolio_exposure_v2` | Sin datos → riesgo real desconocido, perfiles bajos más estrictos | ✅ Sí | ✅ `test_fund_with_only_metrics_high_equity` |
| 3 | is_suitable_low_risk=False → block p1-2 | `if is_suitable_low_risk is False: return False` | 1-2 | `classification_v2.is_suitable_low_risk` | Flag explícito de idoneidad conservadora | ✅ Sí | ✅ `TestBiotechSectorial` |
| 4 | risk_bucket=HIGH → block p1-2 | `if risk_bucket == "HIGH": return False` | 1-2 | `classification_v2.risk_bucket` | Fondos de alta volatilidad excluidos de perfiles conservadores extremos | ✅ Sí | ✅ `TestBiotechSectorial` |
| 5 | real_eq > 30% → block p1-2 | `if real_eq > 30: return False` | 1-2 | `portfolio_exposure_v2.economic_exposure.equity` | Cap de exposición RV real para perfiles muy conservadores | ✅ Sí | ✅ (implícito via `MOCK_GLOBAL_EQUITY` 95%) |
| 6 | risk_bucket=HIGH y no equity → block p3-4 | `if risk_bucket == "HIGH" and asset_type != "equity": return False` | 3-4 | `classification_v2.risk_bucket`, `asset_type` | Alto riesgo no-RV (HY, Alts) excluido de moderados; RF puro queda implícitamente excluido si HIGH | ✅ Sí | ✅ `TestHighYield` |
| 7 | real_eq > 45% → block p3 | `if risk_profile == 3 and real_eq > 45: return False` | 3 | `portfolio_exposure_v2.economic_exposure.equity` | Límite hard de exposición RV real para perfil conservador | ✅ Sí | ✅ `TestAllocationAggressive` (70% eq) |
| 8 | real_eq > 60% → block p4 | `if risk_profile == 4 and real_eq > 60: return False` | 4 | `portfolio_exposure_v2.economic_exposure.equity` | Límite hard de exposición RV real para perfil moderado-defensivo | ✅ Sí | ✅ `TestAllocationAggressive` (70% eq) |
| 9 | Sector funds → block p1-4 | `if is_sector_fund: return False` | 1-4 | `classification_v2.is_sector_fund`, `asset_subtype` | Fondos sectoriales concentrados excluidos de perfiles no agresivos | ✅ Sí | ✅ `TestBiotechSectorial` |
| 10 | EM_EQUITY / HY_BOND / COMMODITIES → block p1-4 | `if asset_subtype in {...} or asset_type == "commodities": return False` | 1-4 | `classification_v2.asset_subtype`, `asset_type` | Exclusión por tipo de activo de alto riesgo/baja liquidez | ✅ Sí | ✅ `TestSmallCapEM`, `TestHighYield` |
| 11 | Healthcare/Biotech → block p<6 | `if sector_focus == "HEALTHCARE" and risk_profile < 6: return False` | 5 (solo), 1-5 via regla 9 | `classification_v2.sector_focus` | Healthcare más volátil que sector genérico; accesible desde p6 | ✅ Sí | ✅ `TestBiotechSectorial::test_allowed_profile_7` |

### B.2 Función secundaria: `get_economic_bucket(asset_meta)` — `suitability_engine.py`

No produce bloques de elegibilidad directos; mapea `asset_type`/`asset_subtype` a etiquetas de universo económico usadas por `_apply_suitability_filter()` en `optimizer_core.py`. Totalmente hardcoded, totalmente testeada.

### B.3 Flujo de llamada en runtime

```
endpoint: optimize_portfolio_quant()
  ↓ (FASE 2): _apply_suitability_filter(assets_list, asset_metadata, risk_level, apply_profile, locked_assets)
      ↓ for cada isin:
          if isin in locked_set → bypass suitability (Nivel 1: Locked Assets)
          else → is_fund_eligible_for_profile(asset_metadata[isin], risk_level) → True/False
              → si False: isin excluido del universo del solver
```

**Punto clave:** Los activos bloqueados (`locked_assets`) **bypasan completamente** `is_fund_eligible_for_profile`. Esto es correcto operativamente (un activo ya en cartera no se puede rechazar sin instrucción explícita del usuario), pero significa que **un fondo UNSUITABLE puede estar en cartera si fue bloqueado antes de que se actualizara su clasificación**.

---

## C. Mapa Frontend — Reglas Duplicadas en `rulesEngine.ts`

### C.1 `isFundSuitableForProfile(fund, riskProfile)` — L402-456

| # | Regla frontend | Equivalente backend | Divergencia | Usa compatible_profiles | Fuente |
|---|----------------|--------------------|----|---|---|
| FE-0 | `compatible_profiles` array → delegación directa | N/A — backend es la fuente | Ninguna si el campo está actualizado | ✅ Primera prioridad | `classV2.compatible_profiles.includes(riskProfile)` |
| FE-1 | Fallback: sin classV2 → check equity puro (20%/50%) | Regla 1 bloquea todo sin V2 | **DIVERGENCIA**: backend bloquea todo sin V2; frontend acepta si equity bajo | ❌ N/A | L411-416 |
| FE-2 | is_suitable_low_risk=false → block p1-2 | Regla 3 — idéntica | ✅ Equivalente | ❌ N/A | L429 |
| FE-3 | risk_bucket=HIGH → block p1-2 | Regla 4 — idéntica | ✅ Equivalente | ❌ N/A | L430 |
| FE-4 | realEq > 30 → block p1-2 | Regla 5 — idéntica | ✅ Equivalente | ❌ N/A | L431 |
| FE-5 | risk_bucket=HIGH and not EQUITY → block p3-4 | Regla 6 — idéntica | ✅ Equivalente | ❌ N/A | L436 |
| FE-6 | realEq > 45 → block p3 | Regla 7 — idéntica | ✅ Equivalente | ❌ N/A | L437 |
| FE-7 | realEq > 60 → block p4 | Regla 8 — idéntica | ✅ Equivalente | ❌ N/A | L438 |
| FE-8 | isSectorFund → block p1-4 | Regla 9 — idéntica | ✅ Equivalente | ❌ N/A | L439 |
| FE-9 | EM_EQUITY / HY_BOND / lowQualityCredit>=35 / COMMODITIES → block p1-4 | Regla 10 — casi idéntica | ⚠️ **DIFERENCIA**: frontend añade `lowQualityCredit >= 35` que backend no tiene | ❌ N/A | L440-447 |
| FE-10 | HEALTHCARE y p<6 → block | Regla 11 — idéntica | ✅ Equivalente | ❌ N/A | L452 |

### C.2 Buckets de perfil en frontend — `RISK_PROFILES` (L39-160)

| Perfil | RV min/max (frontend) | RV equivalente backend `RISK_BUCKETS_LABELS` |
|--------|----------------------|---------------------------------------------|
| 1 | 0% / 10% | [0.00, 0.10] — ✅ alineado |
| 2 | 0% / 15% | [0.00, 0.15] — ✅ alineado |
| 3 | 10% / 25% | [0.00, 0.30] — ⚠️ frontend más restrictivo en min (10 vs 0) |
| 4 | 20% / 40% | [0.00, 0.50] — ⚠️ frontend más restrictivo en max (40 vs 50) |
| 5 | 40% / 60% | [0.30, 0.65] — ⚠️ frontend max más permisivo (60 vs 65) |
| 6 | 50% / 75% | [0.40, 0.80] — ⚠️ divergencia en ambos extremos |
| 7 | 70% / 90% | [0.50, 1.00] — ⚠️ frontend más restrictivo en max |
| 8 | 85% / 100% | [0.65, 1.00] — ⚠️ frontend más restrictivo en min |
| 9 | 95% / 100% | [0.70, 1.00] — ✅ razonablemente alineado |
| 10 | 95% / 100% | [0.80, 1.00] — ⚠️ frontend más restrictivo en min |

> **Nota:** `RISK_BUCKETS_LABELS` es la fuente del solver backend. Los buckets de frontend son presentación visual (`seed_local`), pueden ser sobrescritos por `syncRiskProfilesFromDB()` o `syncBusinessRulesFromBackend()`, pero si esas funciones no se invocan, el frontend opera con la seed local desalineada.

### C.3 `compatible_profiles` — mecanismo de delegación

El frontend, cuando `classV2.compatible_profiles` tiene valores, **los usa directamente como fuente de verdad** (FE-0). Esto es el mecanismo de delegación correcto: el backend calcula, Firestore almacena, el frontend obedece.

**Problema:** `compatible_profiles` solo existe en Firestore si `migrate_suitability_v2.py` fue ejecutado. No hay evidencia en el repositorio de que este script se haya ejecutado en producción (`suitability_version` solo aparece en ese script, en ningún otro lado del código). Si el campo está vacío o ausente, el frontend cae al fallback (FE-1 a FE-10), que diverge del backend en FE-9.

---

## D. Contrato Actual Frontend/Backend

### D.1 ¿Quién decide la elegibilidad real?

```
BACKEND (autoritativo):
  optimizer_core.py → _apply_suitability_filter() → is_fund_eligible_for_profile()
  Resultado: el fondo entra o no al universo del solver.

FRONTEND (presentación):
  rulesEngine.ts → isFundSuitableForProfile()
  Resultado: el fondo se muestra u oculta en el selector de fondos de la UI.
  
ÁRBITRO: compatible_profiles en Firestore (si está calculado y actualizado)
```

### D.2 ¿Puede el frontend mostrar un fondo como apto que backend bloqueará?

**SÍ.** El caso más claro:

1. Fondo sin `compatible_profiles` en Firestore.
2. Frontend fallback FE-1: si `equity <= 50%` y `risk_profile <= 4`, el frontend lo acepta.
3. Backend regla 1: cualquier fondo sin `classification_v2` completo → bloqueado.
4. El usuario selecciona el fondo, lo envía al optimizer → el optimizer lo excluye silenciosamente del universo.

**Riesgo UX:** El usuario ve el fondo como "apto" en la UI, lo incluye en su cartera propuesta, y el optimizer simplemente lo elimina sin notificación visible para el usuario.

### D.3 ¿Puede el frontend ocultar un fondo que backend aceptaría?

**SÍ.** Regla FE-9: el frontend añade `lowQualityCredit >= 35` como criterio de exclusión para p1-4. El backend no tiene esta regla. Un fondo con crédito de baja calidad pero `asset_subtype != HIGH_YIELD_BOND` podría ser aceptado por el backend y rechazado por el frontend.

### D.4 Estado de `compatible_profiles`

| Dimensión | Estado |
|-----------|--------|
| Definido en modelo | ✅ `canonical_types.py` L197: `compatible_profiles: List[int]` |
| Script de cálculo | ✅ `migrate_suitability_v2.py` — EXISTE pero es un script de escritura manual |
| Evidencia de ejecución | ❌ No hay evidencia de ejecución en producción (`suitability_version` ausente del código de lectura) |
| Leído por backend runtime | ❌ `is_fund_eligible_for_profile()` NO lee `compatible_profiles` — calcula siempre en tiempo real |
| Leído por frontend | ✅ Primera prioridad en `isFundSuitableForProfile()` si el array está presente |
| Riesgo post-MIXED | ⚠️ Si `migrate_suitability_v2.py` se ejecutó antes de la remediación MIXED, los valores de `compatible_profiles` reflejan `real_eq` incorrectos (fallback 50/50) |

---

## E. Impacto Post-Remediación MIXED

### E.1 Qué cambió

La remediación MIXED (59/60 fondos) corrigió `portfolio_exposure_v2.economic_exposure` para fondos mixtos que tenían el fallback 50/50. Por ejemplo:

- **Carmignac Patrimoine (FR0010306142):** `real_eq` pasa de 50% (fallback) a ~30-35% (Morningstar real).
- **Allianz Dynamic MA SRI 75 (LU1594335520):** `real_eq` pasa de 50% a ~75%.
- **Allianz Dynamic MA SRI 15 (LU1548496022):** `real_eq` pasa de 50% a ~15%.

### E.2 Efecto en reglas de suitability backend

Las reglas backend **se calculan en tiempo real** con el dato actual de `real_eq`. Por tanto, tras la remediación, automáticamente son correctas.

**Ejemplos concretos:**

| Fondo | real_eq antes | real_eq después | Elegibilidad p3 antes | Elegibilidad p3 después |
|-------|--------------|-----------------|----------------------|-------------------------|
| Carmignac Patrimoine | 50% | ~32% | ❌ (>45%) | ✅ (<45%) |
| Allianz DMA SRI 75 | 50% | ~75% | ❌ (>45%) | ❌ (>45%, correcto: es agresivo) |
| Allianz DMA SRI 15 | 50% | ~15% | ✅ (<45%) | ✅ (<45%, ahora correctamente defensivo) |

### E.3 Efecto en `compatible_profiles` almacenados (si existen)

Si `migrate_suitability_v2.py` se ejecutó en algún momento con datos pre-remediation, los `compatible_profiles` almacenados en Firestore son incorrectos para todos los fondos MIXED remediados. El frontend estaría usando valores stale.

### E.4 Efecto en reglas de suitability frontend

El frontend lee `real_eq` de `portfolio_exposure_v2.economic_exposure.equity` en tiempo real también, excepto para fondos con `compatible_profiles` populated (que usa el array sin recalcular). Por tanto:

- **Si `compatible_profiles` ausente:** frontend calcula correcto post-MIXED.
- **Si `compatible_profiles` presente y stale:** frontend muestra eligibilidad incorrecta.

---

## F. Riesgos Clasificados

| Severidad | Riesgo | Descripción | Impacto |
|-----------|--------|-------------|---------|
| ⚠️ WARNING | **Divergencia FE-9** | `lowQualityCredit >= 35` en frontend no existe en backend. Fondos RF con crédito low-quality pueden ser ocultos por UI pero aceptados por el optimizer. | UX: usuario no ve el fondo disponible aunque matemáticamente puede entrar. |
| ⚠️ WARNING | **compatible_profiles stale post-MIXED** | Si el campo fue populado antes de la remediación, los valores son incorrectos para 59 fondos MIXED. Frontend delegaría en datos incorrectos. | UX: elegibilidad incorrecta en la presentación de fondos disponibles. |
| ⚠️ WARNING | **Locked assets bypass suitability** | Fondos bloqueados pasan directamente al solver sin verificación de suitability. Un fondo reclasificado como UNSUITABLE después del lock permanece en cartera. | Riesgo regulatorio potencial si hay revisión de clasificaciones sin revisión de carteras. |
| ℹ️ INFO | **Fallback divergence (FE-1)** | Frontend sin classV2 acepta fondos si equity < 50% para p<=4. Backend los bloquea todos. | Solo aplica a fondos sin V2 (que no deberían llegar en producción con V2 obligatorio). |
| ℹ️ INFO | **Bucket seeds desalineados** | Los buckets de `RISK_PROFILES` en frontend difieren de `RISK_BUCKETS_LABELS` backend en perfiles 3-8. | Solo presentación visual (no afectan al solver), pero pueden crear expectativas UX incorrectas. |
| ℹ️ INFO | **migrate_suitability_v2.py no archivado** | El script de escritura de `compatible_profiles` no está archivado y no tiene banner DO_NOT_RUN. Podría reejecutarse con datos post-MIXED. | Bajo riesgo si se añade guardia; alto riesgo si se ejecuta accidentalmente antes de entender el impacto. |
| ℹ️ INFO | **suitability_version no leída** | Se escribe en migrate script pero ningún código la lee. Es campo informacional sin efecto. | Deuda documental. |

---

## G. Decisión Recomendada

**Decisión:** `DOCUMENT_AND_TEST` (corto plazo) + `MIGRATE_TO_SYSTEM_SETTINGS_LATER` (medio plazo) + `FRONTEND_BACKEND_PARITY_TESTS_NEEDED` (crítico)

### Detalle por plazo

**Corto plazo (sin tocar código):**
1. Este documento como fuente de verdad del contrato actual.
2. Añadir banner `DO_NOT_RUN` a `migrate_suitability_v2.py` (igual que los scripts MIXED).
3. Verificar en Firestore si `compatible_profiles` está populated en algún fondo (read-only query).

**Medio plazo (gate de código, requiere autorización):**
4. Añadir test de paridad frontend/backend: para cada regla, verificar que `isFundSuitableForProfile` y `is_fund_eligible_for_profile` producen el mismo resultado para los mismos inputs.
5. Resolver divergencia FE-9: o añadir la regla al backend o eliminarla del frontend.
6. Decidir si `compatible_profiles` debe ser campo vivo (recalculado por backend y escrito en Firestore tras cada reclasificación) o eliminarse del modelo.

**Largo plazo (diseño de sistema):**
7. Endpoint `get_business_rules` ya existe en `rulesEngine.ts` (`syncBusinessRulesFromBackend`). Implementar el endpoint real en backend que exponga las reglas de suitability como configuración, eliminando la duplicación.
8. Migrar umbrales hardcoded (30%, 45%, 60%, p<6 para healthcare) a `system_settings/suitability_rules` para que sean configurables sin código.

---

## H. Próximo Bloque Propuesto

**Recomendado:** `BDB-SUITABILITY-CONTRACT-TESTS-0`

**Objetivo:** Crear tests de paridad frontend/backend para el contrato de suitability, verificar el estado de `compatible_profiles` en Firestore (read-only), y añadir banner al script de migración. Sin tocar lógica de negocio.

**Alternativa de mayor impacto:** `BDB-RISK-BUCKETS-PARITY-TESTS-0` — auditar y testear las divergencias entre los buckets de presentación frontend y los buckets del solver backend.

---

## I. Tests Ejecutados

```
Comando:
  .\venv\Scripts\python.exe -m pytest tests\test_suitability_v2.py 
    tests\test_mixed_funds_lookthrough_contract.py 
    tests\test_mixed_exposure_ms_portfolio.py -v --tb=short

Resultado:
  62/62 PASS
  0 FAIL · 0 ERROR · 0 SKIP

Tests cubiertos:
  test_suitability_v2.py:
    - 10 fund mocks × múltiples perfiles = 47 tests de suitability + buckets + edge cases
  test_mixed_funds_lookthrough_contract.py:
    - 4 tests de contrato lookthrough (post-MIXED)
  test_mixed_exposure_ms_portfolio.py:
    - 11 tests de exposición Morningstar vs fallback

Tests frontend:
  rulesEngine.test.ts: NO ejecutados (requiere entorno Vite/Node; fuera del alcance read-only).
  Cobertura frontend: 3 tests de generación de portfolio local (no de suitability).
  ⚠️ No existe test de paridad frontend/backend de suitability.
```

---

## J. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore writes | ✅ CERO |
| Deploy | ✅ NO |
| Código de producción modificado | ✅ NINGUNO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Scripts write históricos reeejecutados | ✅ NO |
| Scripts temporales creados | ✅ NINGUNO |
| Tests relevantes | ✅ 62/62 PASS |

---

## K. Archivos Auditados

| Archivo | Rol | Hardcoded | Testeado |
|---------|-----|-----------|----------|
| `services/portfolio/suitability_engine.py` | Motor backend — autoridad | ✅ Sí (11 reglas) | ✅ Sí (47 tests) |
| `frontend/src/utils/rulesEngine.ts` | Réplica presentación | ✅ Sí (10 reglas + buckets) | ⚠️ Parcial (3 tests de generación, 0 de suitability) |
| `services/portfolio/optimizer_core.py` | Consumidor de suitability | N/A | ✅ Via p0 contracts |
| `models/canonical_types.py` | Definición de `compatible_profiles` | N/A | N/A |
| `scripts/maintenance/migrate_suitability_v2.py` | Calculador de `compatible_profiles` | N/A | ⚠️ Sin banner DO_NOT_RUN |
| `tests/test_suitability_v2.py` | Suite de tests backend | N/A | ✅ 47/47 PASS |
| `frontend/src/utils/rulesEngine.test.ts` | Suite de tests frontend | N/A | ⚠️ Solo generación de portfolio |
