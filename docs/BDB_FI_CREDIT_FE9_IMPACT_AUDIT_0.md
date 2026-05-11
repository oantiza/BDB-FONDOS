# BDB-FI-CREDIT-FE9-IMPACT-AUDIT-0

**Tipo:** Auditoría read-only | **Fecha:** 2026-05-11 | **Bloque previo:** `d28141f`
**Colección:** `funds_v3` | **Firestore writes:** 0 | **FE-9:** No activada | **Deploy:** No

---

## A. Resumen Ejecutivo

Auditoría read-only de los **7 fondos** marcados como `FE9_POTENTIAL_NEW_GAP` tras poblar
`portfolio_exposure_v2.fi_credit` en los 130 fondos de `funds_v3`.

**Resultado:**

| Clasificación | Fondos |
|--------------|--------|
| `HARD_BLOCK_CANDIDATE` | **0** |
| `SOFT_WARNING_CANDIDATE` | **4** |
| `NO_ACTION_CANDIDATE` | **1** |
| `NEEDS_MANUAL_FACTSHEET` | **2** |

**FE-9 sigue sin activarse.** `compatible_profiles` no modificado. `suitability_engine.py` no tocado.

**Recomendación:** `FE9_SOFT_WARNING_ONLY` para los 4 fondos elegibles, y
`NEEDS_MANUAL_FACTSHEETS_FIRST` para los 2 fondos con muy alta sub-IG pero sin dato de
`average_credit_quality` en Morningstar.

---

## B. Estado Actual

### `fi_credit` en Firestore
- Poblado en **130 fondos** tras `BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0`.
- 0 fondos tenían el campo antes del write.
- Post-verification: 130/130 PASS.

### FE-9 landscape antes de este bloque

| Métrica | Valor |
|---------|-------|
| Fondos con `low_quality >= 35%` (bond bucket) | 43 |
| Ya bloqueados por HY/EM Rule 10 | 36 |
| **FE-9 potential new gap** | **7** |

Los 36 fondos HY/EM ya están **completamente cubiertos** por la regla cualitativa
`Rule 10` (bloqueo por subtype). FE-9 solo añadiría valor para los 7 fondos que son
`CORPORATE_BOND` (nominalmente IG) pero con alta exposición sub-IG real.

---

## C. Tabla de los 7 Fondos

| # | ISIN | Nombre | Subtype | lq_bond | ig | nr | profiles afectados <=4 | avg_quality | Recomendación |
|---|------|--------|---------|---------|----|----|----------------------|-------------|---------------|
| 1 | FR0011288513 | Sycomore Sélection Crédit R | CORPORATE_BOND | **60.0%** | 38.2% | 1.9% | [3, 4] | N/A | SOFT_WARNING |
| 2 | LU0151324935 | Candriam Bonds Credit Opportunities | CORPORATE_BOND | **79.4%** | 12.3% | 8.2% | [3, 4] | N/A | NO_ACTION* |
| 3 | LU0733673288 | Nordea 1 - European Cross Credit | CORPORATE_BOND | **62.1%** | 38.0% | 0.0% | [3, 4] | N/A | SOFT_WARNING |
| 4 | LU1623762843 | Carmignac Pf Credit A EUR Acc | CORPORATE_BOND | **39.1%** | 60.9% | 0.0% | [3, 4] | N/A | SOFT_WARNING |
| 5 | LU1919971074 | abrdn Frontier Markets Bond | CORPORATE_BOND | **86.9%** | 6.8% | 6.3% | [3, 4] | N/A | NEEDS_MANUAL_FACTSHEET |
| 6 | LU1951921383 | Allianz Credit Opportunities AT | CORPORATE_BOND | **58.0%** | 41.4% | 0.6% | [3, 4] | N/A | SOFT_WARNING |
| 7 | LU2002383896 | Allianz Credit Opport. Plus AT | CORPORATE_BOND | **83.9%** | 15.3% | 0.8% | [3, 4] | N/A | NEEDS_MANUAL_FACTSHEET |

**Nota:** Bond weight = 100% en todos — `lq_total_portfolio == lq_bond_bucket`.
Los perfiles [3,4] son los únicos afectados en todos los casos (todos tienen perfiles [3..10]).

*\* Candriam: lq=79% pero no se tienen datos de `average_credit_quality`. El script lo clasifica como NO_ACTION por la lógica de fallback (no sub-IG avg confirmado), pero candidato a revisión manual.*

---

## D. Interpretación Profesional

### Hallazgo clave: todos son `CORPORATE_BOND`, bond_weight=100%
Los 7 fondos son **fondos de crédito corporativo puro** (100% RF). Esto significa:
- `lq_bond_bucket == lq_total_portfolio` — no hay dilución por renta variable.
- La exposición sub-IG es directamente proporcional al portfolio total.

### Por qué `avg_quality = None` en todos
Morningstar no tiene el campo `average_credit_quality` poblado para ninguno de los 7
en nuestra colección. Esto es un gap de datos que limita la clasificación automática.
Sin rating medio confirmado, el script no puede afirmar con certeza que el fondo
es "sub-IG por promedio" (aunque la distribución sugiere que la mayoría lo son).

### Diferenciación por nivel de riesgo real

| Grupo | Fondos | Perfil crediticio real |
|-------|--------|----------------------|
| **Borderline alto** | LU1919971074, LU2002383896 | lq 84-87%, ig < 15% — muy probablemente sub-IG medio |
| **Alto** | LU0151324935 | lq 79%, ig 12% — estructura similar a HY pero subtype CORPORATE |
| **Medio-alto** | FR0011288513, LU0733673288, LU1951921383 | lq 58-62%, ig 38-41% — crossover real |
| **Borderline bajo** | LU1623762843 | lq 39%, ig 61% — fondos "investment grade plus" con componente sub-IG |

### Fondos "crossover" vs fondos de facto HY
- `Nordea European Cross Credit` y `Sycomore Sélection Crédit` son fondos
  **explícitamente crossover** — mezclan IG y sub-IG por diseño. Su presencia en el gap
  es esperable y no indica error de clasificación.
- `abrdn Frontier Markets Bond` y `Allianz Credit Opportunities Plus` son fondos con
  estructura de facto similar a HY Emergentes, aunque clasificados como CORPORATE_BOND.
  Estos merecen revisión de subtype (pueden ser candidatos a reclasificación como
  `HIGH_YIELD_BOND` o `EMERGING_MARKETS_BOND`, lo que los cubriría con Rule 10).

### Carmignac Pf Credit: caso especial
`LU1623762843` tiene `lq=39%` pero `ig=61%`. Es el menos preocupante del grupo.
Un fondo con mayoría IG real y ~39% sub-IG puede ser adecuado para perfil 4
dependiendo de su volatilidad y rating medio real. FE-9 aquí sería over-blocking.

---

## E. Opciones Evaluadas

### Opción 1: Hard block perfil <=4 si lq bond bucket >= 35%
- **Impacto:** Bloquea perfiles [3, 4] en los 7 fondos.
- **Problemas:** Over-blocking evidente en Carmignac (lq=39%, ig=61%). Los fondos
  crossover de baja lq son accesibles para perfil 4 en cualquier framework profesional.
- **Evaluación:** RECHAZADA para aplicación directa.

### Opción 2: Hard block solo si lq total portfolio >= 35%
- **Impacto:** Idéntico al anterior aquí (bond_weight=100% en todos).
- **Evaluación:** Mismos problemas. Solo mejoraría para fondos mixtos.

### Opción 3: Soft warning para perfil <=4
- **Impacto:** Muestra advertencia en pantalla pero no bloquea suscripción.
- **Ventajas:** No impide acceso, informa al asesor/cliente, no requiere reclasificación.
- **Evaluación:** PREFERIDA para los 4 fondos con datos suficientes.

### Opción 4: Ajuste de risk_bucket
- Los 7 fondos tienen `compatible_profiles` que incluyen perfil 3 y 4.
  Si el `risk_bucket` fuera elevado, el bloqueo sería por risk_bucket, no por FE-9.
- Requeriría auditoría separada de risk_bucket vs subtype vs LQ real.
- **Evaluación:** Viable a futuro, pero requiere bloque dedicado.

### Opción 5: No action
- **Justificación posible:** Los fondos CORPORATE_BOND con alto sub-IG que deberían
  estar bloqueados ya deberían tener subtype `HIGH_YIELD_BOND` (eso fue un error de
  clasificación original, no de FE-9). FE-9 no es el mecanismo correcto para corregir
  errores de subtype.
- **Evaluación:** Aceptable para los 2 fondos candidatos a reclasificación de subtype.

---

## F. Decisión Recomendada

### Recomendación: `FE9_SOFT_WARNING_ONLY` + `NEEDS_MANUAL_FACTSHEETS_FIRST` para 2 fondos

**Motivo:**
1. Ninguno de los 7 fondos es un `HARD_BLOCK_CANDIDATE` confirmado — la falta de
   `average_credit_quality` en Morningstar impide el diagnóstico definitivo.
2. Los fondos crossover (lq 39-62%) son legítimamente accesibles para perfil 4 con
   información adecuada — hard block sería paternalista.
3. Los 2 fondos con lq > 80% (`abrdn Frontier Markets`, `Allianz Credit Opport. Plus`)
   merecen revisión de su subtype — si se reclasifican como `HIGH_YIELD_BOND`,
   quedarían cubiertos por Rule 10 sin necesitar FE-9.

**Plan por grupo:**

| Grupo | Fondos | Acción |
|-------|--------|--------|
| SOFT_WARNING | FR0011288513, LU0733673288, LU1951921383, LU1623762843 | FE-9 como soft warning (bloque futuro) |
| NEEDS_MANUAL | LU1919971074, LU2002383896 | Solicitar fichas + verificar subtype |
| NO_ACTION | LU0151324935 | Revisar si debería ser HIGH_YIELD_BOND (Rule 10 lo cubriría) |

> [!IMPORTANT]
> Antes de activar cualquier FE-9, se necesita:
> 1. Obtener `average_credit_quality` para los 7 fondos (o consultar ficha oficial).
> 2. Revisar si los 2 fondos con lq > 80% son candidatos a reclasificación de subtype.
> 3. Diseñar el mensaje de warning para el asesor (no bloqueo duro).

---

## G. Próximo Bloque

Según la recomendación `FE9_SOFT_WARNING_ONLY`:

### Inmediato: `BDB-FI-CREDIT-SUBTYPE-REVIEW-0` (opcional)
Revisar si `LU1919971074` (abrdn Frontier Markets) y `LU2002383896` (Allianz Credit
Opportunities Plus) deberían reclasificarse como `HIGH_YIELD_BOND` o
`EMERGING_MARKETS_BOND`. Si se confirma, quedarían cubiertos por Rule 10 y FE-9
no sería necesaria para ellos.

### Principal: `BDB-FI-CREDIT-FE9-SOFT-WARNING-DESIGN-0`
- Diseñar el mensaje de warning para el asesor/plataforma.
- Definir threshold exacto (35% bond bucket vs total portfolio).
- Definir perfiles afectados (<=4 o solo <=3).
- Implementar como warning no bloqueante en frontend o backend.
- Tests de contrato para el warning.

### Alternativo (si se prefiere no action): Cierre definitivo FE-9
Documentar que FE-9 no se implementa porque:
- Rule 10 cubre el 83% de los casos (36/43).
- Los 7 restantes son fondos crossover legítimos o candidatos a reclasificación.
- La métrica aislada de LQ sin rating medio es insuficiente para hard block.

---

## H. Tests Ejecutados

### Comando
```bash
.\functions_python\venv\Scripts\python.exe -m pytest \
  functions_python\tests\test_fi_credit_data_model_contract.py \
  functions_python\tests\test_suitability_contract_parity.py \
  functions_python\tests\test_suitability_v2.py \
  -v --tb=short
```

### Resultado
**85 PASS + 5 xfailed + 29 xpassed — EXIT 0** ✅

Sin regresiones. Suite completa pasa sin cambios.

---

## I. Confirmaciones

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
| `migrate_suitability_v2.py` ejecutado | ✅ NO |
| `compatible_profiles` modificado | ✅ NO |
| `classification_v2` modificado | ✅ NO |

### Archivos creados
- `scripts/maintenance/bdb_fi_credit_fe9_impact_audit.py` — Script read-only [NEW]
- `artifacts/suitability/fi_credit_fe9_impact_audit_0.json` — Artifact [NEW]
- `docs/BDB_FI_CREDIT_FE9_IMPACT_AUDIT_0.md` — Este documento [NEW]
