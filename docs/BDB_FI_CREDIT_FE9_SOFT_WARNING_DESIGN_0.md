# BDB-FI-CREDIT-FE9-SOFT-WARNING-DESIGN-0

**Tipo:** Diseño/auditoría | **Fecha:** 2026-05-11 | **Bloque previo:** `1f418fb`
**Colección:** `funds_v3` | **Firestore writes:** 0 | **FE-9:** No activada | **Deploy:** No

---

## A. Resumen Ejecutivo

Diseño del contrato de warning no bloqueante para fondos con `fi_credit.low_quality >= 35%`
en escala `percent_of_bond_bucket`. Este bloque documenta el contrato, los textos y la
arquitectura futura del warning FE-9, sin activar ninguna regla ni modificar código productivo.

**Resultado:**

| Aspecto | Decisión |
|---------|---------|
| Tipo de regla | **Warning no bloqueante** (`blocking=False` siempre) |
| Activación | `fi_credit.low_quality >= 35%` + `coverage >= 0.8` + `source` presente + `scale = percent_of_bond_bucket` |
| Perfiles afectados | Informativo para todos; no bloquea ningún perfil |
| `compatible_profiles` | **No se modifica** |
| `suitability_engine.py` | **No se toca** en este bloque |
| FE-9 activada | **NO** |
| Deploy | **NO** |
| Tests creados | ✅ `test_fi_credit_fe9_warning_contract.py` |

---

## B. Motivación

### Por qué se necesita un warning

1. **`fi_credit` ya está poblado en 130 fondos** (`d28141f`) — los datos existen en Firestore.
2. **7 fondos con `FE9_POTENTIAL_NEW_GAP` auditados** (`1f418fb`):
   - 0 HARD_BLOCK confirmados
   - 4 SOFT_WARNING elegibles
   - 2 NEEDS_MANUAL_FACTSHEET (lq > 80%, sin avg_quality)
   - 1 NO_ACTION / candidato a revisión de subtype
3. **Hard block no justificado:** sin `average_credit_quality` en Morningstar para los 7 fondos,
   no hay base cuantitativa para bloqueo duro. Los fondos crossover con lq 39-62% son
   legítimamente accesibles para perfil 4.
4. **Rule 10 (HY/EM) ya cubre el 83%** de los casos high-lq (36/43). FE-9 solo añade valor
   para los 7 que son nominalmente `CORPORATE_BOND` pero con alta exposición sub-IG.
5. **El asesor necesita información, no restricciones automáticas:**
   - Los fondos crossover son instrumentos especializados que requieren validación humana.
   - Un warning informativo es el mecanismo adecuado para este perfil de riesgo.

---

## C. Contrato del Warning FE-9

### C.1 Trigger

El warning **se emite** si y solo si se cumplen **todas** las condiciones:

```python
fi_credit["scale"]    == "percent_of_bond_bucket"  # escala explícita
fi_credit["coverage"] >= 0.8                        # dato suficientemente completo
fi_credit["source"]   != None and != ""             # proveniencia obligatoria
fi_credit["low_quality"] >= 25.0                    # sobre umbre mínimo INFO
```

El warning **NO se emite** si:
- `fi_credit` es `None` o no existe en el fondo.
- `coverage < 0.8` (dato insuficiente para activar).
- `scale` es desconocido o `percent_of_total_portfolio`.
- `low_quality < 25%` (ningún nivel de severidad aplica).

### C.2 Severidad

| Rango `low_quality` | Severidad | Código |
|--------------------|----------|--------|
| 25% – <35%         | `INFO`    | `FI_CREDIT_LOW_QUALITY_OVER_25_BOND_BUCKET` |
| 35% – <70%         | `WARNING` | `FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET` |
| ≥ 70%              | `REVIEW`  | `FI_CREDIT_LOW_QUALITY_OVER_70_BOND_BUCKET` |

> [!IMPORTANT]
> Los umbrales exactos (especialmente el límite INFO/WARNING en 25% y WARNING/REVIEW en 70%)
> **requieren validación** con los equipos de gestión y compliance antes de implementación.
> Los valores aquí son un punto de partida propuesto, no umbrales definitivos.

### C.3 Estructura del Warning

```json
{
  "code":    "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET",
  "severity": "WARNING",
  "blocking": false,
  "low_quality": 39.1,
  "not_rated":   0.0,
  "scale":   "percent_of_bond_bucket",
  "bond_weight":  100.0,
  "low_quality_total_portfolio_estimate": 39.1,
  "source":  "morningstar_pdf",
  "as_of":   "2026-01-31",
  "coverage": 1.0,
  "message_advisor": "...",
  "message_client":  "...",
  "message_technical": "..."
}
```

### C.4 Invariantes del contrato

| Invariante | Regla |
|-----------|-------|
| `blocking` | **Siempre `false`** — sin excepciones |
| `not_rated` | Reportado **separadamente**, nunca sumado a `low_quality` |
| `compatible_profiles` | **No se modifica** bajo ninguna circunstancia |
| `scale` | Debe coincidir con `fi_credit.scale` — nunca asumir |
| `lq_total_portfolio_estimate` | `= low_quality * bond_weight / 100` |
| `source` + `coverage` | Requeridos antes de emitir cualquier warning |

---

## D. Ubicación Recomendada del Warning

### Opciones evaluadas

| Opción | Pros | Contras | Evaluación |
|--------|------|---------|-----------|
| **A. `portfolio_exposure_v2.fi_credit.warnings`** | Cerca del dato fuente; autocontenido | Warning técnico, no suitability; persiste en Firestore innecesariamente | ❌ No recomendado como final |
| **B. `classification_v2.suitability_warnings`** | Ligado a elegibilidad | Mezcla clasificación estática con warnings dinámicos | ❌ Riesgo de confusión de responsabilidades |
| **C. Respuesta runtime backend (no persistido)** | No contamina Firestore; calculado on-demand | Frontend necesita llamada backend adicional | ✅ **Recomendado medio plazo** |
| **D. Frontend-only desde `fi_credit`** | Rápido de implementar | Duplica lógica; mantiene la divergencia conocida | ⚠️ Solo como solución temporal |

### Recomendación

**Corto plazo:** El warning puede ser calculado por el **frontend** directamente desde
`portfolio_exposure_v2.fi_credit` (el campo ya existe). Esto es rápido y no require
cambios en backend.

**Medio plazo:** Migrar a **módulo backend separado** (`fi_credit_warnings.py`) que
compute los warnings en la respuesta del endpoint de suitability, sin persistirlos en
Firestore. El frontend los muestra sin calcularlos.

**Principio:** `suitability_engine.py` NO debe modificarse para warnings de fi_credit —
los warnings son una capa separada, no reglas de bloqueo de elegibilidad.

---

## E. Textos Propuestos

### E.1 Mensaje Asesor
> "Este fondo presenta una proporción relevante de crédito sub-investment grade dentro de su
> cartera de renta fija. No implica bloqueo automático, pero requiere revisión de idoneidad,
> duración, volatilidad y objetivo del cliente."

### E.2 Mensaje Cliente / PDF
> "El fondo incorpora exposición significativa a crédito de menor calidad crediticia.
> Puede aumentar la sensibilidad a ampliaciones de diferenciales y episodios de estrés
> de mercado."

### E.3 Mensaje Técnico / Auditoría
> `low_quality = BB + B + below_B (percent_of_bond_bucket). not_rated tratado separadamente.
> lq_total_portfolio_estimate = low_quality × bond_weight / 100.`

> [!NOTE]
> Los textos definitivos requieren revisión legal/compliance antes de su uso en producción.
> Los textos aquí son propuestas técnicas de diseño.

---

## F. Análisis de los 7 Fondos

| # | ISIN | Nombre | lq_bond | profiles actuales | Warning propuesto | Requiere ficha |
|---|------|--------|---------|------------------|------------------|---------------|
| 1 | FR0011288513 | Sycomore Sélection Crédit R | 60.0% | [3..10] | ✅ WARNING | No |
| 2 | LU0733673288 | Nordea 1 European Cross Credit | 62.1% | [3..10] | ✅ WARNING | No |
| 3 | LU1951921383 | Allianz Credit Opportunities | 58.0% | [3..10] | ✅ WARNING | No |
| 4 | LU1623762843 | Carmignac Pf Credit | 39.1% | [3..10] | ✅ WARNING | No |
| 5 | LU1919971074 | abrdn Frontier Markets Bond | 86.9% | [3..10] | ✅ REVIEW | **Sí** |
| 6 | LU2002383896 | Allianz Credit Opport. Plus | 83.9% | [3..10] | ✅ REVIEW | **Sí** |
| 7 | LU0151324935 | Candriam Bonds Credit Opport. | 79.4% | [3..10] | ✅ REVIEW | **Sí (subtype)** |

**Notas:**
- Los 4 SOFT_WARNING reciben warning de severidad `WARNING` por contrato.
- Los 2 NEEDS_MANUAL_FACTSHEET reciben warning de severidad `REVIEW` por regla automática,
  pero la decisión final sobre su elegibilidad requiere ficha oficial.
- LU0151324935 es candidato a reclasificación de subtype a `HIGH_YIELD_BOND` —
  si se confirma, quedará cubierto por Rule 10 y el warning FE-9 sería redundante.
- **Ninguno de los 7 es bloqueado** en este bloque.

---

## G. Lo que NO se Hará

| Restricción | Estado |
|-------------|--------|
| Hard block automático perfil <=4 | ✅ NO — no hay base cuantitativa suficiente |
| Modificar `compatible_profiles` | ✅ NO — es invariante de este contrato |
| Activar regla en `suitability_engine.py` | ✅ NO — en este bloque ni en el futuro inmediato |
| Implementar warning en frontend como solución permanente | ✅ NO — solo temporal |
| Persistir warnings en Firestore como campo nuevo | ✅ NO — warnings calculados on-demand |
| Activar FE-9 | ✅ NO |
| Deploy | ✅ NO |
| BDB-FONDOS-CORE | ✅ NO |
| `firestore.rules` | ✅ NO |
| `optimizer_core.py` | ✅ NO |

---

## H. Tests de Diseño

### Archivo creado
`functions_python/tests/test_fi_credit_fe9_warning_contract.py`

### Secciones

| Sección | Tests | Tipo |
|---------|-------|------|
| Section 1: Core invariants | 9 tests | PASS (helper local, sin Firestore) |
| Section 2: Severity thresholds | 5 tests | PASS (helper local) |
| Section 3: Los 7 gap funds | 7 tests | PASS (datos reales sintéticos) |
| Section 4: Hard-block prohibition | 3 tests | xfail(strict=False) — contrato arquitectónico |
| Section 5: Schema contract | 4 tests | PASS (helper local) |

**Total:** 28 tests | Los de Sección 1-3 y 5 son PASS directos (helper local puro).
Los de Sección 4 son `xfail(strict=False)` porque documentan contratos arquitectónicos
que no pueden verificarse hasta que exista el módulo de producción.

### Resultado esperado
```
==== X passed, 3 xfailed, Y xpassed ====
```

---

## I. Próximos Bloques

### 1. `BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0`
Diseñar el módulo backend `fi_credit_warnings.py`:
- Función `compute_fi_credit_warnings(fund_data) -> list[dict]`.
- Integración con el endpoint de suitability (respuesta enriquecida, no persistida).
- Tests unitarios reales (no xfail).

### 2. `BDB-FI-CREDIT-FE9-WARNING-FRONTEND-0` (Corto plazo)
Implementar el warning en frontend calculado desde `portfolio_exposure_v2.fi_credit`:
- Lectura de `fi_credit.low_quality` y `fi_credit.scale`.
- Display del mensaje asesor en la ficha del fondo.
- No modificar `rulesEngine.ts` — añadir capa de warnings separada.

### 3. `BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0`
Para `LU1919971074` (abrdn Frontier Markets) y `LU2002383896` (Allianz Credit Opportunities Plus):
- Solicitar fichas oficiales y prospectos.
- Verificar si `average_credit_quality` puede obtenerse de otra fuente.
- Decidir si reclasificar como `HIGH_YIELD_BOND` (los cubriría Rule 10).

### 4. `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0`
Diseño de la arquitectura de warnings de suitability como capa separada del engine:
- `suitability_engine.py` → solo bloqueos (bool, str).
- `suitability_warnings.py` → warnings informativos calculados en runtime.
- Frontend consume ambas capas pero no implementa la lógica.

---

## J. Confirmaciones

| Restricción | Estado |
|-------------|--------|
| Firestore writes | ✅ NO |
| Deploy | ✅ NO |
| `suitability_engine.py` modificado | ✅ NO |
| FE-9 activada | ✅ NO |
| Frontend runtime tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `compatible_profiles` modificado | ✅ NO |
| `classification_v2` modificado | ✅ NO |
| Ningún campo de Firestore creado/modificado | ✅ Confirmado |

### Archivos creados
- `functions_python/tests/test_fi_credit_fe9_warning_contract.py` — Tests de contrato [NEW]
- `docs/BDB_FI_CREDIT_FE9_SOFT_WARNING_DESIGN_0.md` — Este documento [NEW]
