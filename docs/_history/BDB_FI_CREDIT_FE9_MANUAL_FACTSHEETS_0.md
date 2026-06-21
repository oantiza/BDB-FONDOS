# BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0

**Tipo:** Auditoría read-only | **Fecha:** 2026-05-11 | **HEAD:** `f336cdc`
**Colección:** `funds_v3` | **Firestore writes:** 0 | **FE-9:** No activada | **Deploy:** No

---

## A. Resumen Ejecutivo

Auditoría read-only de los **3 fondos en estado REVIEW** tras el bloque de impacto FE-9
(`1f418fb`). Todos tienen `low_quality >= 79%` en el bucket de renta fija y `average_credit_quality = None`
en Morningstar, lo que impedía una clasificación automática definitiva.

**Los datos live de Firestore revelan información clave nueva:**

| ISIN | Nombre | ms_category (live) | lq | Decisión provisional |
|------|--------|-------------------|----|--------------------|
| LU1919971074 | abrdn Frontier Markets Bond | **RF Global Emergente - Sesgo EUR** | 86.9% | **SUBTYPE_REVIEW → EMERGING_MARKETS_BOND** |
| LU2002383896 | Allianz Credit Opportunities Plus | **RF Flexible EUR** | 83.9% | **NEEDS_FACTSHEET + WARNING_REVIEW** |
| LU0151324935 | Candriam Bonds Credit Opportunities | **Global Flexible Bond EUR Hedged** | 79.4% | **SUBTYPE_REVIEW → HIGH_YIELD o FLEXIBLE** |

**Hallazgo principal:** `LU1919971074` tiene categoría Morningstar
`"RF Global Emergente - Sesgo EUR"` — confirma que debería ser **`EMERGING_MARKETS_BOND`**,
no `CORPORATE_BOND`. Si se reclasifica, queda cubierto por **Rule 10** sin necesidad de FE-9.

**FE-9 sigue sin activarse. `compatible_profiles` no modificado. 0 writes. 0 deploy.**

---

## B. Tabla de los 3 Fondos

| Campo | LU1919971074 | LU2002383896 | LU0151324935 |
|-------|-------------|-------------|-------------|
| **Nombre** | abrdn Frontier Markets Bond | Allianz Credit Opport. Plus | Candriam Bonds Credit Opport. |
| **Subtype actual** | CORPORATE_BOND | CORPORATE_BOND | CORPORATE_BOND |
| **ms_category (live)** | **RF Global Emergente** | RF Flexible EUR | Global Flexible Bond EUR Hdg |
| **compatible_profiles** | [3..10] | [3..10] | [3..10] |
| **lq bond bucket** | **86.9%** | **83.9%** | **79.4%** |
| **investment_grade** | 6.8% | 15.3% | 12.3% |
| **not_rated** | 6.3% | 0.8% | 8.2% |
| **avg_quality (MS)** | None | None | None |
| **coverage** | 1.0 | 1.0 | 1.0 |
| **bond_weight** | 100% | 100% | 100% |
| **lq_total_portfolio** | 86.9% | 83.9% | 79.4% |
| **Perfiles afectados <=4** | [3, 4] | [3, 4] | [3, 4] |
| **Decisión provisional** | SUBTYPE_REVIEW | NEEDS_FACTSHEET | SUBTYPE_REVIEW |

---

## C. Fondo 1 — LU1919971074 — abrdn Frontier Markets Bond

### Datos disponibles (live Firestore)

| Campo | Valor |
|-------|-------|
| Nombre completo | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR |
| Subtype actual | `CORPORATE_BOND` |
| ms_category (live) | **`RF Global Emergente - Sesgo EUR`** ← dato clave |
| low_quality | **86.9%** |
| investment_grade | 6.8% |
| not_rated | 6.3% |
| avg_quality | None |
| coverage | 1.0 |

### Análisis

La categoría Morningstar `"RF Global Emergente - Sesgo EUR"` es **determinante**:
este fondo pertenece a la categoría de renta fija emergente. Su nombre `Frontier Markets Bond`
también lo confirma explícitamente — los mercados frontera son un subconjunto de mercados
emergentes con mayor riesgo crediticio.

**La clasificación actual `CORPORATE_BOND` es incorrecta.** El subtype correcto debería ser:
- **`EMERGING_MARKETS_BOND`** — que lo cubriría por Rule 10 automáticamente.

Con `lq=86.9%` e `ig=6.8%`, la cartera es prácticamente toda sub-IG sobre un universo
emergente / frontera. Esto es coherente con la estrategia del fondo (bonos soberanos y
corporativos de mercados frontera en divisa fuerte).

### ¿Requiere ficha oficial para decidir?

**No es estrictamente necesaria** — la categoría MS y el nombre son suficientes para
confirmar que es un fondo emergente. Sin embargo, la ficha confirmaría:
- Si invierte en divisa dura (hard currency) o local.
- Si el universo es gobierno o corporativo.
- El rating medio real (sin dato MS).

### Decisión provisional

**`SUBTYPE_REVIEW → EMERGING_MARKETS_BOND`**

> [!IMPORTANT]
> Si se reclasifica a `EMERGING_MARKETS_BOND`, este fondo quedaría cubierto por
> **Rule 10** (`suitability_engine.py` línea 64) y dejaría de ser un FE-9 gap.
> No se necesitaría activar FE-9 para él.

---

## D. Fondo 2 — LU2002383896 — Allianz Credit Opportunities Plus

### Datos disponibles (live Firestore)

| Campo | Valor |
|-------|-------|
| Nombre completo | Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR |
| Subtype actual | `CORPORATE_BOND` |
| ms_category (live) | **`RF Flexible EUR`** |
| low_quality | **83.9%** |
| investment_grade | 15.3% |
| not_rated | 0.8% |
| avg_quality | None |
| coverage | 1.0 |

### Análisis

`"RF Flexible EUR"` es la categoría de renta fija sin restricciones de benchmark — fondos
que pueden mover libremente entre IG, HY, EM y deuda subordinada. El nombre `Credit Opportunities Plus`
es característico de fondos HY/crossover de crédito oportunístico.

Con `lq=83.9%` e `ig=15.3%`, el fondo está estructuralmente posicionado en crédito sub-IG.
Esto es un comportamiento habitual de los fondos "Credit Opportunities" — son fondos de hecho
similares a HIGH_YIELD_BOND pero clasificados como flexible por su benchmark libre.

**La categoría `CORPORATE_BOND` es demasiado genérica** para capturar el riesgo real de este fondo.
Sin embargo, `"RF Flexible EUR"` tampoco mapea directamente a `HIGH_YIELD_BOND` — son fondos
con mayor latitud táctica.

### ¿Requiere ficha oficial para decidir?

**Sí, recomendada** — porque:
1. Sin `average_credit_quality`, no podemos confirmar rating medio sub-IG.
2. El subtype `FLEXIBLE_BOND` podría ser más correcto que `HIGH_YIELD_BOND` (si no existe en
   nuestro schema, `HIGH_YIELD_BOND` sería la aproximación conservadora).
3. La ficha confirmaría si el fondo tiene benchmark HY explícito o free mandate.

### Decisión provisional

**`NEEDS_FACTSHEET`** — con indicación `WARNING_REVIEW` mientras llega la ficha.

El warning FE-9 de severidad `REVIEW` es adecuado para este fondo en el estado actual.
Si la ficha confirma mandato HY, reclasificar a `HIGH_YIELD_BOND` → cubierto por Rule 10.

---

## E. Fondo 3 — LU0151324935 — Candriam Bonds Credit Opportunities

### Datos disponibles (live Firestore)

| Campo | Valor |
|-------|-------|
| Nombre completo | Candriam Bonds Credit Opportunities Class N EUR Cap |
| Subtype actual | `CORPORATE_BOND` |
| ms_category (live) | **`Global Flexible Bond - EUR Hedged`** |
| low_quality | **79.4%** |
| investment_grade | 12.3% |
| not_rated | **8.2%** |
| avg_quality | None |
| coverage | 1.0 |

### Análisis

`"Global Flexible Bond - EUR Hedged"` es similar al caso anterior — fondo de renta fija
flexible global sin restricción de rating. El nombre `Credit Opportunities` es análogo al
de Allianz — estrategia oportunista de crédito.

Con `lq=79.4%`, `ig=12.3%` y `nr=8.2%`, la cartera tiene solo ~20% en IG o asimilables.
El 79.4% sub-IG más el 8.2% no calificado configura un perfil de facto HY.

**`CORPORATE_BOND` es el subtype incorrecto para este perfil.** Las opciones son:
- `HIGH_YIELD_BOND` — si el mandato es explícitamente HY.
- Mantener `CORPORATE_BOND` pero con FE-9 warning activo (si no se reclasifica).

El `not_rated=8.2%` es también relevante — posiblemente deuda no calificada de mercados
menos líquidos, coherente con una estrategia "credit opportunities" global.

### ¿Requiere ficha oficial para decidir subtype?

**Sí** — para confirmar si el mandato es explícitamente HY o si el posicionamiento HY es
táctico (lo que afecta si `HIGH_YIELD_BOND` es el subtype correcto o si se necesita una nueva
categoría `FLEXIBLE_BOND` en el schema).

### Decisión provisional

**`SUBTYPE_REVIEW`** — candidato a `HIGH_YIELD_BOND` o introducción de `FLEXIBLE_BOND`.

> [!NOTE]
> Si se reclasifica a `HIGH_YIELD_BOND`, queda cubierto por Rule 10 y deja de ser FE-9 gap.
> El warning `REVIEW` es apropiado mientras no se cierre la revisión de subtype.

---

## F. Decisión Recomendada por Fondo

| ISIN | Nombre | Decisión | Acción requerida |
|------|--------|---------|-----------------|
| **LU1919971074** | abrdn Frontier Markets | **SUBTYPE_REVIEW** | Reclasificar → `EMERGING_MARKETS_BOND`. No necesita FE-9. |
| **LU2002383896** | Allianz Credit Opport. Plus | **NEEDS_FACTSHEET** | Warning REVIEW activo. Ficha confirma subtype. |
| **LU0151324935** | Candriam Bonds Credit Opport. | **SUBTYPE_REVIEW** | Reclasificar → `HIGH_YIELD_BOND` o `FLEXIBLE_BOND`. |

**Si se aprueban las dos reclasificaciones de subtype:**
- `LU1919971074` → `EMERGING_MARKETS_BOND` → cubierto por Rule 10 ✅
- `LU0151324935` → `HIGH_YIELD_BOND` → cubierto por Rule 10 ✅
- Solo queda `LU2002383896` como FE-9 gap real si no se reclasifica.

---

## G. Qué Pedir al Usuario

### Fichas oficiales (PDF o KIID actualizado)

| Fondo | ISIN | Dato prioritario a verificar |
|-------|------|---------------------------|
| abrdn Frontier Markets Bond | LU1919971074 | Confirmar universo emergente/frontera + rating medio |
| Allianz Credit Opport. Plus | LU2002383896 | Benchmark: ¿HY explícito o free mandate? + rating medio |
| Candriam Bonds Credit Opport. | LU0151324935 | ¿Mandato HY explícito o flexible? + composición por rating |

### Datos clave a revisar en cada ficha

Para cada uno de los 3 fondos, confirmar:

| Dato | Importancia | Para qué sirve |
|------|------------|----------------|
| **Categoría Morningstar oficial** | Alta | Confirmar ms_category en Firestore vs ficha actual |
| **Objetivo de inversión** | Alta | Determinar si es HY explícito, EM explícito, o flexible sin restricción |
| **Benchmark** | Alta | Si referencia un índice HY → `HIGH_YIELD_BOND`; si EM → `EMERGING_MARKETS_BOND` |
| **Rating medio (average credit quality)** | Alta | Confirmar si el fondo es sub-IG por mandato o tácticamente |
| **Distribución por rating** | Media | Comparar con los datos MS que ya tenemos |
| **Duración modificada** | Media | Contexto de riesgo de tipos (duración alta + HY = mayor riesgo) |
| **Volatilidad anualizada (1/3 años)** | Media | Proxy de riesgo real vs perfil |
| **Si invierte en deuda subordinada / AT1 / CoCo** | Alta | Subordinada puede justificar REVIEW aunque el nombre no lo diga |
| **Divisa base y política de cobertura** | Baja | Confirmar hedge EUR |

---

## H. Próximo Bloque

### Si el usuario aporta las fichas → `BDB-FI-CREDIT-FE9-FACTSHEET-DECISION-0`
Procesar el contenido de las fichas, confirmar subtypes y decidir:
- Reclasificaciones controladas (write gate + write controlado para subtype).
- Confirmación de warning REVIEW para los que permanezcan como CORPORATE_BOND.

### Si no se aportan fichas en el corto plazo → `BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0`
Continuar con el diseño del runtime de warnings, manteniendo los 3 fondos en estado REVIEW:
- El warning de severidad `REVIEW` es adecuado y no requiere fichas para implementarse.
- Los fondos siguen accesibles para todos los perfiles — sin bloqueo.
- La revisión de subtypes queda pendiente para un bloque futuro dedicado.

### Alternativa inmediata → `BDB-FI-CREDIT-SUBTYPE-REVIEW-0`
Dado que **2 de los 3 fondos son SUBTYPE_REVIEW**, y uno de ellos (LU1919971074) tiene
confirmación suficiente desde la categoría MS, se podría iniciar una revisión de subtype
sin esperar fichas adicionales.

---

## I. Confirmaciones

| Restricción | Estado |
|-------------|--------|
| Firestore writes | ✅ NO |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| BDB-FONDOS-CORE | ✅ NO |
| `suitability_engine.py` | ✅ NO |
| FE-9 activada | ✅ NO |
| `compatible_profiles` modificado | ✅ NO |
| `migrate_suitability_v2.py` | ✅ NO |

### Archivos creados
- `scripts/maintenance/bdb_fi_credit_fe9_manual_factsheets_audit.py` — Script read-only [NEW]
- `artifacts/suitability/fi_credit_fe9_manual_factsheets_audit_0.json` — Artifact [NEW]
- `docs/BDB_FI_CREDIT_FE9_MANUAL_FACTSHEETS_0.md` — Este documento [NEW]

### Tests
Tests no ejecutados — bloque de solo documentación.
Suite de referencia: **110 PASS + 5 xfailed + 32 xpassed — EXIT 0** (último estado conocido).
