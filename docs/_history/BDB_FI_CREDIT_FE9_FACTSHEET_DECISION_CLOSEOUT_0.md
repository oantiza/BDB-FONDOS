# BDB-FI-CREDIT-FE9-FACTSHEET-DECISION-CLOSEOUT-0

**Tipo:** Documento de cierre | **Fecha:** 2026-05-11 | **HEAD:** `ec1e583`
**Firestore writes:** 0 | **FE-9 activada:** No | **Deploy:** No | **Código modificado:** No

---

## A. Resumen Ejecutivo

Cierre de la revisión manual de los 7 fondos `FE9_POTENTIAL_NEW_GAP` con los datos
disponibles (fichas, ms_category live, perfil crediticio observado).

**Resultado final:**

| Clasificación | Fondos | Acción |
|--------------|--------|--------|
| **SUBTYPE_REVIEW** | 2 | Reclasificar subtype; quedarán cubiertos por Rule 10 |
| **WARNING** | 3 | Warning no bloqueante cuando se implemente runtime |
| **WARNING_PROVISIONAL** | 1 | Warning hasta ficha actual disponible |
| **DATA_MISMATCH_REVIEW** | 1 | No aplicar warning; revisar discrepancia datos |
| **NEEDS_FACTSHEET** | 1 | Pendiente — mantener REVIEW hasta ficha |

**FE-9 hard block: NO activado en ningún caso.**
**`compatible_profiles`: NO modificado.**
**`suitability_engine.py`: NO modificado.**

---

## B. Tabla de los 7 Fondos — Decisión Final

| # | ISIN | Nombre | lq_bond | Decisión | Estado |
|---|------|--------|---------|---------|--------|
| 1 | LU1919971074 | abrdn Frontier Markets Bond | 86.9% | **SUBTYPE_REVIEW** | → `EMERGING_MARKETS_BOND`; cubierto Rule 10 |
| 2 | LU0151324935 | Candriam Bonds Credit Opport. | 79.4% | **SUBTYPE_REVIEW** | → `HIGH_YIELD_BOND`; cubierto Rule 10 |
| 3 | LU0733673288 | Nordea European Cross Credit | 62.1% | **WARNING** | Warning informativo; no bloqueo |
| 4 | LU1623762843 | Carmignac Portfolio Credit | 39.1% | **WARNING** | Warning informativo; no bloqueo |
| 5 | FR0011288513 | Sycomore Sélection Crédit R | 60.0% | **WARNING_PROVISIONAL** | Warning hasta ficha actual |
| 6 | LU1951921383 | Allianz Credit Opportunities | 58.0% | **DATA_MISMATCH_REVIEW** | No warning automático; revisar datos |
| 7 | LU2002383896 | Allianz Credit Opport. Plus | 83.9% | **NEEDS_FACTSHEET** | REVIEW pendiente; sin ficha suficiente |

---

## C. Decisión por Fondo — Detalle

### C.1 LU1919971074 — abrdn Frontier Markets Bond → **SUBTYPE_REVIEW**

- **Decisión:** Reclasificar a `EMERGING_MARKETS_BOND`.
- **Motivo:** Fondo de mercados frontera/emergentes confirmado por ms_category live
  (`"RF Global Emergente - Sesgo EUR"`) y nombre explícito. Exposición masiva a deuda
  sub-investment grade es estructural al mandato del fondo, no un desvío táctico.
- **Consecuencia:** Si se aprueba la reclasificación de subtype, queda cubierto por
  **Rule 10** (`suitability_engine.py` línea 64 — `EMERGING_MARKETS_BOND` excluido para <=4).
- **FE-9 necesaria:** No.
- **Bloque requerido:** `BDB-FI-CREDIT-SUBTYPE-REVIEW-0` (write gate + controlled write en `classification_v2.asset_subtype`).

---

### C.2 LU0151324935 — Candriam Bonds Credit Opportunities → **SUBTYPE_REVIEW**

- **Decisión:** Reclasificar a `HIGH_YIELD_BOND` o equivalente flexible high yield.
- **Motivo:** Perfil crediticio de facto HY — `lq=79.4%`, `ig=12.3%`, `nr=8.2%`.
  ms_category `"Global Flexible Bond - EUR Hedged"`. Estrategia credit opportunities
  con mandato de crédito oportunista sin restricción de rating.
- **Consecuencia:** Si se reclasifica a `HIGH_YIELD_BOND`, cubierto por Rule 10.
- **FE-9 necesaria:** No (si se reclasifica).
- **Bloque requerido:** `BDB-FI-CREDIT-SUBTYPE-REVIEW-0` (junto con LU1919971074).

---

### C.3 LU0733673288 — Nordea European Cross Credit → **WARNING**

- **Decisión:** Warning no bloqueante de severidad `WARNING`.
- **Motivo:** Fondo cross-credit BBB/BB/B por diseño explícito. La mezcla IG/sub-IG
  es el mandato del fondo — no un error de clasificación. `lq=62.1%`, `ig=38.0%`.
- **Acción:** Emitir warning `FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET` cuando se
  implemente el runtime de warnings. No bloquear perfiles [3, 4].
- **FE-9 hard block:** No justificado — fondo cross-credit es un instrumento legítimo
  para perfil 4 con asesoramiento adecuado.

---

### C.4 LU1623762843 — Carmignac Portfolio Credit → **WARNING**

- **Decisión:** Warning no bloqueante de severidad `WARNING`.
- **Motivo:** Flexible credit con rating medio BBB según datos. `lq=39.1%`, `ig=60.9%`.
  El componente IG es dominante (61%); la exposición sub-IG es relevante pero secundaria.
  Es el fondo con menor riesgo crediticio del grupo — borderline entre INFO y WARNING.
- **Acción:** Emitir warning `FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET` en el runtime.
  No bloquear.
- **FE-9 hard block:** No justificado — IG dominante, perfil 4 con warning es apropiado.

---

### C.5 FR0011288513 — Sycomore Sélection Crédit R → **WARNING_PROVISIONAL**

- **Decisión:** Warning provisional — mantener hasta disponer de ficha actual.
- **Motivo:** Ficha disponible es antigua. El perfil de crédito es oportunista con
  `lq=60.0%`, `ig=38.2%`. Sin dato actualizado no se puede confirmar si el
  posicionamiento actual justifica WARNING o REVIEW.
- **Acción:** Emitir warning `WARNING` en el runtime con flag `provisional=true`.
  Revisar con ficha actual cuando esté disponible.
- **FE-9 hard block:** No.

---

### C.6 LU1951921383 — Allianz Credit Opportunities → **DATA_MISMATCH_REVIEW**

- **Decisión:** No aplicar warning automático por ahora. Revisar discrepancia de datos.
- **Motivo:** Los datos aportados muestran rating medio **BBB**, duración baja y
  `low_quality` aparente muy inferior al dato en Firestore (`lq=58.0%` según fi_credit).
  Hay discrepancia entre los datos de Morningstar en Firestore y la ficha/fuente manual.
- **Acción:** Antes de emitir warning, verificar qué dato es correcto:
  - ¿La ficha muestra distribución de rating diferente a la de Morningstar?
  - ¿El campo `as_of` de fi_credit es reciente o hay drift temporal?
  - ¿Hay recomposición de cartera reciente que justifique la diferencia?
- **FE-9 warning:** En pausa hasta resolver mismatch.
- **Bloque requerido:** `BDB-FI-CREDIT-DATA-MISMATCH-AUDIT-0` (read-only, comparar MS vs ficha).

---

### C.7 LU2002383896 — Allianz Credit Opportunities Plus → **NEEDS_FACTSHEET**

- **Decisión:** Pendiente — mantener en estado REVIEW.
- **Motivo:** Sin ficha suficiente para decidir subtype ni confirmar mandato HY explícito.
  ms_category `"RF Flexible EUR"`. `lq=83.9%`, `ig=15.3%`.
- **Acción:** Solicitar ficha/KIID actualizado. Mientras tanto, el warning REVIEW es
  apropiado si se implementa el runtime.
- **FE-9 hard block:** No — insuficiente información para justificar hard block.

---

## D. Estado Consolidado Post-Revisión

### FE-9 gap reducido

Antes de este bloque:
- 7 fondos con `FE9_POTENTIAL_NEW_GAP`

Después de las decisiones adoptadas:
- **2 → SUBTYPE_REVIEW** (cubiertos por Rule 10 si se reclasifican — salen del gap)
- **3 → WARNING** (gap gestionado con warning informativo)
- **1 → WARNING_PROVISIONAL** (gap temporal hasta ficha)
- **1 → DATA_MISMATCH** (en pausa hasta verificar datos)
- **1 → NEEDS_FACTSHEET** (gap abierto)

**Gap real restante sin gestión activa: 1 fondo** (LU2002383896).

### Lo que NO ha cambiado

| Campo | Estado |
|-------|--------|
| `portfolio_exposure_v2.fi_credit` | 130 fondos — sin cambios en este bloque |
| `compatible_profiles` | Sin modificaciones |
| `classification_v2.asset_subtype` | Sin modificaciones — SUBTYPE_REVIEW pendiente |
| `suitability_engine.py` | Sin modificaciones |
| FE-9 regla | No activada |
| Deploy | No ejecutado |

---

## E. FE-9 Hard Block — Confirmación de No Activación

> [!IMPORTANT]
> **FE-9 hard block NO se activa en ninguno de los 7 fondos.**
>
> Los motivos por fondo:
> - LU1919971074: cubierto por Rule 10 si se reclasifica → no necesita FE-9.
> - LU0151324935: cubierto por Rule 10 si se reclasifica → no necesita FE-9.
> - LU0733673288: fondo crossover legítimo → warning, no bloqueo.
> - LU1623762843: IG dominante → warning, no bloqueo.
> - FR0011288513: ficha desactualizada → warning provisional, no bloqueo.
> - LU1951921383: data mismatch → en pausa, no bloqueo automático.
> - LU2002383896: sin ficha → sin base para bloqueo.
>
> **Ningún caso presenta base suficiente para hard block automático.**

---

## F. Pendientes Abiertos

| Pendiente | Fondos afectados | Prioridad |
|-----------|-----------------|-----------|
| Reclasificación subtype (SUBTYPE_REVIEW) | LU1919971074, LU0151324935 | Alta |
| Resolución data mismatch | LU1951921383 | Media |
| Ficha oficial | LU2002383896, FR0011288513 | Media |
| Implementación runtime warning | LU0733673288, LU1623762843, FR0011288513 | Media |

---

## G. Próximos Pasos Recomendados

### Opción A — Continuar inmediatamente

**`BDB-FI-CREDIT-SUBTYPE-REVIEW-0`**
Reclasificar `LU1919971074` → `EMERGING_MARKETS_BOND` y `LU0151324935` → `HIGH_YIELD_BOND`.
Con estos 2 cambios, Rule 10 cubre a ambos y el FE-9 gap se reduce de 7 a 5 fondos.

### Opción B — Parar aquí

El estado actual es estable y seguro:
- 130 fondos con `fi_credit` poblado.
- Ningún perfil bloqueado incorrectamente.
- FE-9 no activada — no hay riesgo de over-blocking.
- Los 7 fondos tienen acceso normal para todos los perfiles.
- Las decisiones están documentadas y auditadas.

**Parar aquí es una opción perfectamente válida** hasta que se decida continuar con
el subtype review o la implementación del runtime de warnings.

### Si se decide continuar:
1. `BDB-FI-CREDIT-SUBTYPE-REVIEW-0` — reclasificar 2 fondos (requiere write gate + controlled write)
2. `BDB-FI-CREDIT-DATA-MISMATCH-AUDIT-0` — resolver discrepancia LU1951921383
3. `BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0` — implementar warnings en producción

---

## H. Confirmaciones

| Restricción | Estado |
|-------------|--------|
| Firestore writes | ✅ NO |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| `suitability_engine.py` | ✅ NO |
| `compatible_profiles` | ✅ NO |
| FE-9 activada | ✅ NO |
| BDB-FONDOS-CORE | ✅ NO |
| `firestore.rules` | ✅ NO |
| `optimizer_core.py` | ✅ NO |

### Archivo creado
- `docs/BDB_FI_CREDIT_FE9_FACTSHEET_DECISION_CLOSEOUT_0.md` [NEW]

---

*Cierre de revisión manual FE-9. BDB-FONDOS legacy.*
*Generado: 2026-05-11 | HEAD: `ec1e583`*
