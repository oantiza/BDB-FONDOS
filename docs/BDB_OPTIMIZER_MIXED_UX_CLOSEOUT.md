# BDB_OPTIMIZER_MIXED_UX_CLOSEOUT

Informe de cierre del ciclo completo: Mixto / fallback / UX volatilidad.
Fecha: 2026-05-08

---

## 1. Resumen ejecutivo

Se ha completado un ciclo completo de mejora del optimizador de carteras en 5 commits consecutivos:

1. Auditoría del tratamiento de fondos Mixtos y constraints.
2. Plan técnico de corrección.
3. Tests de contrato que blindan las invariantes.
4. Fix backend mínimo: fallback 50/50 auditable con warnings.
5. UX frontend: transparencia de volatilidad objetivo vs lograda, y traducción de warnings técnicos.

El ciclo se cerró con un deploy de hosting (solo frontend) y una verificación postdeploy completa.

**Decisiones clave:**
- Mixto es clasificación comercial/reporting, NO un hard constraint del solver.
- El solver opera exclusivamente sobre exposición económica real (look-through).
- No se eliminó el fallback legacy 50/50, pero ahora es auditable y emite warnings.
- No se modificó la lógica matemática del optimizador.
- No se cambiaron perfiles de riesgo.
- Producción operativa y estable.

---

## 2. Estado Git y producción

| Campo | Valor |
|---|---|
| Rama | master |
| HEAD | cd86721 |
| origin/master | cd86721 |
| Último commit | `OPTIMIZER_UX: surface fallback volatility diagnostics` |
| Hosting URL | https://bdb-fondos.web.app |
| Hosting status | HTTP 200 |
| Working tree | Sin staged, sin modified tracked |
| Functions deploy | NO realizado |
| Firestore rules deploy | NO realizado |
| Storage rules deploy | NO realizado |

---

## 3. Bloques cerrados

| SHA | Commit | Descripción |
|---|---|---|
| 08d8d56 | OPTIMIZER_AUDIT | Auditoría de fondos Mixtos y doble inyección de constraints |
| 89f893f | OPTIMIZER_PLAN | Plan técnico de corrección Mixto/constraints |
| d99bcfc | OPTIMIZER_TESTS | Tests de contrato: mixed lookthrough, bucket dedup, fallback status |
| 144ac7f | OPTIMIZER_FIX | Fix backend mínimo: fallback 50/50 auditable con warnings |
| cd86721 | OPTIMIZER_UX | UX frontend: volatilidad objetivo/lograda, warnings traducidos |

Todos los commits están en master y sincronizados con origin/master.

---

## 4. Decisión canónica sobre Mixto

**Principio establecido:** La etiqueta "Mixto" (o MIXED/ALLOCATION) es una clasificación comercial para filtrado, UI y reporting. NO es un vector del solver ni un hard constraint.

**Implicaciones:**
- El solver no recibe un bucket "Mixto" como restricción.
- Las restricciones de perfil operan sobre exposición económica real (equity, bond, cash, other) obtenida mediante look-through de `portfolio_exposure_v2`.
- Los fondos Mixtos contribuyen a los buckets reales (RV, RF) proporcionalmente a su exposición económica interna.
- No se creó un vector Mixto en la matriz de constraints.
- No se modificaron los perfiles de riesgo (1-10).

**Documentación de referencia:**
- `docs/BDB_OPTIMIZER_MIXED_CONSTRAINTS_AUDIT.md`
- `docs/BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_PLAN.md`

---

## 5. Fix backend mínimo

**Archivo modificado:** `functions_python/optimizer/portfolio_optimizer.py`

**Cambios:**
- El fallback legacy 50/50 para fondos Mixtos sin `asset_mix` se mantiene por compatibilidad operativa.
- Ahora es auditable: emite warnings específicos en el array `warnings` de la respuesta.

**Warnings añadidos:**
| Warning code | Significado |
|---|---|
| `mixed_missing_asset_mix` | Un fondo Mixto no tiene datos de desglose de exposición |
| `mixed_legacy_50_50_fallback` | Se aplicó la heurística 50/50 equity/bond como fallback |
| `requires_exposure_review` | Se recomienda revisar la exposición real del fondo |

**Riesgos del fallback 50/50:**
- Es una heurística conservadora, no una verdad empírica.
- Puede subestimar o sobrestimar la exposición real a RV.
- Los fondos afectados deberían actualizarse con datos reales de `portfolio_exposure_v2` progresivamente.

---

## 6. Tests de contrato

### Backend (Python, pytest)

| Archivo | Tests | Estado |
|---|---|---|
| `test_optimizer_fallback_status_contract.py` | 2 | PASS |
| `test_mixed_funds_lookthrough_contract.py` | 4 | PASS |
| `test_bucket_constraints_dedup.py` | 14 | PASS |
| **Total backend** | **20** | **PASS** |

**Qué blindan:**
- El fallback NO se reporta como `optimal` (siempre `fallback_compliant` o `fallback_non_compliant`).
- `target_vol`, `achieved_vol`, `vol_deviation` están presentes cuando hay datos.
- El look-through de fondos Mixtos contribuye correctamente a equity y bond.
- La clasificación comercial NO inyecta hard constraints al solver.
- Los bucket bounds de perfil no se duplican cuando `portfolio_exposure_v2` está activo.
- Mixto no genera infeasibilidad artificial en perfiles 3-5.

### Frontend (Vitest)

| Archivo | Tests | Estado |
|---|---|---|
| `v2Helpers.test.ts` | 35 | PASS |
| `optimizerP0Contract.test.ts` | 3 | PASS |
| `mixedFunds.test.ts` | 16 | PASS |
| **Total frontend** | **54** | **PASS** |

**Qué blindan:**
- Normalización canónica V2 (tipo, subtipo, región, risk bucket, flags).
- Traducción de warnings técnicos (`translateTechnicalWarning`).
- Gating de fallback: `fallback_non_compliant` NO abre flujo de aplicación.
- Extracción de métricas UX (`target_vol`, `achieved_vol`, `warnings`) en el hook.
- Filtrado de Mixto en sidebar, autocomplete y search.
- Look-through para `getAssetClass` en el rules engine local.

---

## 7. UX frontend

### Cambios en `OptimizationReviewModal.tsx`

- **Título dinámico:** "Propuesta de Cartera Alternativa" cuando `isFallback === true`, vs "Resultado Optimización" cuando es óptimo.
- **Caja de advertencia (amber):** Muestra "Propuesta de Mejor Esfuerzo" con:
  - Mensaje contextual sobre restricciones.
  - Motivo del fallback (`fallback_reason`).
  - Comparativa numérica: Volatilidad Objetivo, Volatilidad Lograda, Desviación (2 decimales, porcentaje).
  - Sección "Consideraciones adicionales" con warnings traducidos al español comercial.

### Cambios en `usePortfolioActions.ts`

- El objeto `enhancedExplainability` ahora incluye `warnings: result.warnings || []`.
- Esto asegura que las advertencias del solver viajan hasta el componente visual.

### Cambios en `normalizer.ts`

- Nueva función exportada `translateTechnicalWarning(code)` que mapea los 3 códigos de warning a texto legible.
- Reutilizable por cualquier otro componente que necesite mostrar warnings del solver.

---

## 8. Deploy y validación postdeploy

| Aspecto | Resultado |
|---|---|
| Deploy type | `firebase deploy --only hosting` |
| HTML | 200 |
| JS | 200 |
| CSS | 200 |
| Login visible | Sí |
| Functions deploy | NO |
| Firestore rules deploy | NO |
| Storage rules deploy | NO |
| Firestore writes | 0 |
| Post-deploy check | `BDB-POST-DEPLOY-STATE-CHECK-UX-0_READY` |

---

## 9. Qué NO se hizo

- NO se desplegaron functions (el backend Python no fue redeployeado).
- NO se desplegaron firestore.rules ni storage.rules.
- NO se realizaron Firestore writes.
- NO se usó Gemini real.
- NO se ejecutó el parser contra PDFs.
- NO se tocó BDB-FONDOS-CORE.
- NO se cambiaron perfiles de riesgo (1-10).
- NO se creó un vector Mixto en el solver.
- NO se rediseñaron las constraints de perfil (solo se documentó la dedup).
- NO se eliminó el fallback 50/50 (se mantiene por compatibilidad, ahora auditable).
- NO se modificó la lógica matemática del optimizador (objetivos, covarianza, etc.).

---

## 10. Riesgos pendientes

| Riesgo | Severidad | Mitigación actual |
|---|---|---|
| Fallback 50/50 sigue existiendo para fondos sin `asset_mix` | MEDIA | Auditable con warnings; no produce infeasibilidad |
| Constraints canonical cleanup pendiente | MEDIA | Dedup funciona; docs creados |
| Payload frontend/backend no limpio (campos legacy + V2) | BAJA | Funcional; audit report existe |
| Pre-check de factibilidad antes de enviar al solver | BAJA | Fallback cubre; no es bloqueante |
| Admin console no existe | BAJA | Operaciones manuales viables vía scripts |
| Retrocesiones reales pendientes de archivo actualizado | MEDIA | Excel de referencia generado; dry-run no ejecutado |

---

## 11. Próximos caminos recomendados

| Prioridad | Camino | Descripción |
|---|---|---|
| A | Retrocesiones dry-run real | Cuando haya archivo actualizado del distribuidor. Usar gate de escritura controlada. |
| B | Constraints canonical cleanup | Limpiar la capa de constraints para que use solo `portfolio_exposure_v2` sin fallback legacy de perfil. |
| C | Payload/contract cleanup | Unificar campos legacy y V2 en el contrato frontend-backend. Eliminar campos muertos. |
| D | Admin console design | Diseñar interfaz administrativa para operaciones de mantenimiento de fondos. |
| E | Parser writes siguientes | Solo con write gate, ceremonia de revisión, y batch confirmado. |

---

## 12. Recomendación profesional

1. **No tocar más la lógica del optimizador en caliente.** El ciclo actual ha estabilizado el tratamiento de Mixto y la transparencia UX. Cualquier cambio adicional al solver debe ir precedido de tests de contrato.

2. **Si se continúa con el optimizador**, la prioridad debería ser el constraints canonical cleanup (camino B), que eliminaría la dependencia del fallback legacy de perfil y simplificaría el pipeline.

3. **Priorizar retrocesiones dry-run** (camino A) si hay archivo actualizado disponible, ya que es un valor de negocio directo con bajo riesgo técnico.

4. **Mantener la disciplina de no deploy de functions** hasta que el constraints cleanup esté completo y testeado.

---

## 13. Decisión final

**Estado:**

```
BDB_OPTIMIZER_MIXED_UX_CLOSEOUT_READY
```

El bloque Mixto / fallback / UX volatilidad queda cerrado documentalmente.
Producción operativa. Tests verdes. Hosting desplegado.
Listo para commit documental y posterior avance al siguiente bloque.
