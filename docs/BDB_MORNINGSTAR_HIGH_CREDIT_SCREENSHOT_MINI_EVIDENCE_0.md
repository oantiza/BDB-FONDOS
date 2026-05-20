# BDB-MORNINGSTAR-HIGH-CREDIT-SCREENSHOT-MINI-EVIDENCE-0

## Contexto

Tras el cierre del ciclo de actualización de 520 fondos desde PDFs Morningstar,
quedaron **7 fondos REVIEW HIGH priority** clasificados como `credit_missing`.

Se ejecutó un reparse dry-run con Gemini (tarea
`BDB-MORNINGSTAR-PDF-REVIEW-HIGH-REPARSE-DRYRUN-0`) que confirmó que **los 7
PDFs de una página de Morningstar no contienen la tabla de calidad crediticia**.
El dato simplemente no existe en esa ficha.

Para recuperar la información, se consultó manualmente la web de Morningstar
(sección Cartera → Renta Fija → Análisis Exposición Renta Fija / Rating
Crediticio) y se transcribieron los datos visibles en pantalla.

Este documento sirve como **evidence layer manual** para los 7 fondos y como
base para una futura carga controlada.

> **ESTADO**: Solo documentación.  No se ha ejecutado ningún write a Firestore.

---

## ISINs Cubiertos

| # | ISIN           | Nombre                                                   |
|---|----------------|----------------------------------------------------------|
| 1 | IE00BYYPF474   | Aegon Global Diversified Income Fund EUR A Acc           |
| 2 | IE00BYYPF581   | Aegon Global Diversified Income Fund EUR A Inc           |
| 3 | LU0087412390   | DWS Concept DJE Alpha Renten Global LC                   |
| 4 | LU0243957239   | Invesco Pan European High Income Fund A Acc EUR          |
| 5 | LU0243957742   | Invesco Pan European High Income Fund E Acc EUR          |
| 6 | LU0404220724   | JPMorgan Global Income Fund D (div) EUR                  |
| 7 | LU1095739733   | First Eagle Amundi Income Builder AE-QD                  |

---

## Asset Allocation Visible

| ISIN           | Equity %  | Bond %   | Cash %   | Other %  | Pref/Conv % |
|----------------|-----------|----------|----------|----------|-------------|
| IE00BYYPF474   | 52,08     | 44,24    | 2,50     | 1,18     | —           |
| IE00BYYPF581   | 52,08     | 44,24    | 2,50     | 1,18     | —           |
| LU0087412390   | 16,94     | 74,27    | 6,57     | 2,22     | —           |
| LU0243957239   | 21,59     | 75,31    | 2,29     | 0,00     | 0,81        |
| LU0243957742   | 21,59     | 75,31    | 2,29     | 0,00     | 0,81        |
| LU0404220724   | 31,88     | 51,15    | 8,38     | 0,43     | —           |
| LU1095739733   | 63,60     | 26,94    | 0,91     | 8,55     | —           |

Nota: IE00BYYPF474 e IE00BYYPF581 son clases Acc/Inc del mismo fondo Aegon;
comparten cartera.  LU0243957239 y LU0243957742 son clases A/E de Invesco Pan
European High Income; comparten cartera.

---

## Parámetros de Renta Fija

| ISIN           | Rating Medio | Dur. Efectiva | Dur. Modif. | Vto. Efectivo | Cupón Pond. | Precio Pond. | Rendimiento |
|----------------|:------------:|:-------------:|:-----------:|:-------------:|:-----------:|:------------:|:-----------:|
| IE00BYYPF474   | BB+          | n/d           | n/d         | n/d           | 5,13        | 102,24       | —           |
| IE00BYYPF581   | BB+          | n/d           | n/d         | n/d           | 5,13        | 102,24       | —           |
| LU0087412390   | n/d          | n/d           | n/d         | n/d           | 4,25        | 98,06        | —           |
| LU0243957239   | BB           | 3,16          | 2,79        | 3,48          | 5,90        | 98,30        | 5,12        |
| LU0243957742   | BB           | 3,16          | 2,79        | 3,48          | 5,90        | 98,30        | 5,12        |
| LU0404220724   | BB           | 5,44          | n/d         | n/d           | 6,12        | 95,96        | 7,08        |
| LU1095739733   | A-           | 2,14          | 3,27        | 3,88          | 4,42        | 98,55        | 5,36        |

Leyenda: n/d = no disponible en la captura Morningstar Web.

---

## Desglose de Rating Crediticio (% sobre cartera de RF)

| ISIN           | AAA   | AA    | A     | BBB   | BB    | B     | <B    | NR    | Σ      |
|----------------|------:|------:|------:|------:|------:|------:|------:|------:|-------:|
| IE00BYYPF474   | 0,00  | 58,01 | 2,84  | 21,19 | 7,23  | 5,16  | 0,00  | 5,57  | 100,00 |
| IE00BYYPF581   | 0,00  | 58,01 | 2,84  | 21,19 | 7,23  | 5,16  | 0,00  | 5,57  | 100,00 |
| LU0087412390   | 24,36 | 2,60  | 20,49 | 33,80 | 13,22 | 1,37  | 0,00  | 4,07  | 99,91  |
| LU0243957239   | 0,10  | 2,25  | 5,30  | 21,22 | 35,27 | 14,26 | 3,59  | 18,02 | 100,01 |
| LU0243957742   | 0,10  | 2,25  | 5,30  | 21,22 | 35,27 | 14,26 | 3,59  | 18,02 | 100,01 |
| LU0404220724   | 0,24  | 34,34 | 1,37  | 7,35  | 29,26 | 10,20 | 5,62  | 11,62 | 100,00 |
| LU1095739733   | 2,79  | 34,83 | 3,20  | 30,64 | 22,35 | 4,49  | 0,00  | 1,71  | 100,01 |

**Nota de sumas**: Las ligeras desviaciones de 100% (±0,01–0,09) son redondeos
normales de Morningstar.  Todas las sumas caen en el rango [99,91 – 100,01],
aceptable.

---

## Mapping Propuesto a Schema `funds_v3`

Los datos de rating crediticio se mapean a la estructura existente:

```
portfolio_exposure_v2.fi_credit = {
  aaa:                <valor>,
  aa:                 <valor>,
  a:                  <valor>,
  bbb:                <valor>,
  bb:                 <valor>,
  b:                  <valor>,
  below_b:            <valor>,
  not_rated:          <valor>,
  avg_credit_quality: <string | null>,  // "BB+", "BB", "A-", etc.
  source:             "morningstar_web_screenshot_manual",
  as_of_date:         null,  // no se documentó fecha exacta en capturas
  confidence:         <ver tabla abajo>
}
```

### Valores por Fondo

| ISIN           | aaa   | aa    | a     | bbb   | bb    | b     | below_b | not_rated | avg | confidence |
|----------------|------:|------:|------:|------:|------:|------:|--------:|----------:|:---:|:----------:|
| IE00BYYPF474   | 0,00  | 58,01 | 2,84  | 21,19 | 7,23  | 5,16  | 0,00    | 5,57      | BB+ | 0,75       |
| IE00BYYPF581   | 0,00  | 58,01 | 2,84  | 21,19 | 7,23  | 5,16  | 0,00    | 5,57      | BB+ | 0,75       |
| LU0087412390   | 24,36 | 2,60  | 20,49 | 33,80 | 13,22 | 1,37  | 0,00    | 4,07      | —   | 0,65       |
| LU0243957239   | 0,10  | 2,25  | 5,30  | 21,22 | 35,27 | 14,26 | 3,59    | 18,02     | BB  | 0,75       |
| LU0243957742   | 0,10  | 2,25  | 5,30  | 21,22 | 35,27 | 14,26 | 3,59    | 18,02     | BB  | 0,75       |
| LU0404220724   | 0,24  | 34,34 | 1,37  | 7,35  | 29,26 | 10,20 | 5,62    | 11,62     | BB  | 0,65       |
| LU1095739733   | 2,79  | 34,83 | 3,20  | 30,64 | 22,35 | 4,49  | 0,00    | 1,71      | A-  | 0,75       |

**Criterio de confidence:**

- **0,75**: Tabla de rating visible y completa (Σ ≈ 100%), rating medio
  disponible, duración disponible o no requerida.
- **0,65**: Tabla de rating visible pero falta rating medio o duración
  (LU0087412390 sin avg, LU0404220724 sin duración modificada/vencimiento).

---

## Riesgo Suitability / FE-9

Cálculo de bandas para evaluación suitability:

| ISIN           | IG %  | LQ %  | NR %  | Perfil Crediticio       |
|----------------|------:|------:|------:|:------------------------|
| IE00BYYPF474   | 82,04 | 12,39 | 5,57  | Investment-grade mayoritario |
| IE00BYYPF581   | 82,04 | 12,39 | 5,57  | Investment-grade mayoritario |
| LU0087412390   | 81,25 | 14,59 | 4,07  | Investment-grade mayoritario |
| LU0243957239   | 28,87 | 53,12 | 18,02 | **High yield predominante** |
| LU0243957742   | 28,87 | 53,12 | 18,02 | **High yield predominante** |
| LU0404220724   | 43,30 | 45,08 | 11,62 | **High yield predominante** |
| LU1095739733   | 71,46 | 26,84 | 1,71  | Investment-grade mayoritario |

Donde:
- **IG (Investment Grade)** = AAA + AA + A + BBB
- **LQ (Low Quality / High Yield)** = BB + B + Inferior a B
- **NR (Not Rated)** = Sin Rating

### Observaciones FE-9

1. `not_rated` **no se mezcla** con `low_quality`.  NR puede incluir deuda
   soberana emergente, emisiones privadas, etc.  No implica baja calidad.
2. Los fondos Invesco (LU0243957239/742) y JPMorgan (LU0404220724) son
   explícitamente **High Income / Global Income**: su mandato es exposición a
   high yield.  Esto es coherente con sus categorías Morningstar.
3. FE-9 debe actuar como **warning informativo** (`blocking: false`).  No
   activar hard block por high yield en fondos cuyo mandato explícito es
   high income.
4. No se activa FE-9 runtime en este bloque.

---

## Limitaciones de la Evidencia

1. **Fuente**: Datos transcritos manualmente de capturas de pantalla de
   Morningstar Web.  No son output de parser automatizado.
2. **Fecha**: No se documentó la fecha exacta visible en las capturas.  Los
   datos reflejan la cartera más reciente publicada por Morningstar al momento
   de la captura (2026-05-20).
3. **Duración**: Para IE00BYYPF474, IE00BYYPF581 y LU0087412390, la duración
   efectiva no estaba disponible en la pantalla.  LU0404220724 tiene duración
   efectiva (5,44) pero no modificada/vencimiento.
4. **Rating medio**: LU0087412390 no muestra rating medio en la pantalla.
5. **Reproducibilidad**: Un futuro recheck requeriría acceder a la misma URL
   de Morningstar y verificar que los datos no han cambiado.

---

## Decisión Recomendada

### Estos 7 ya no son `credit_missing` real

La tabla de calidad crediticia **existe** en Morningstar Web para los 7 fondos.
El problema era exclusivamente que **el PDF de una página no la incluía**.

### Siguiente bloque propuesto

1. **Crear un script de carga manual controlada** que acepte un JSON con los 7
   registros `fi_credit` transcritos y los escriba en `funds_v3` usando
   `update()` (nunca `set()`).
2. **No tocar** `compatible_profiles`, `suitability_engine`, `manual.*`,
   `manual.costs`, `manual.costs.retrocession`, ni `economic_exposure`.
3. **Crear snapshot pre-write** de los 7 documentos.
4. **Crear rollback** por si los datos manuales contienen errores.
5. **Verificar post-write** que solo cambió `portfolio_exposure_v2.fi_credit`.
6. **No resolver duration** si no aparece.  No inventar valores.  Si la
   duración se necesita en el futuro, buscarla en otra fuente.
7. **No activar FE-9 runtime** hasta que se decida el threshold.

### No hacer en este bloque

- No write Firestore.
- No commit hasta aprobación.
- No write gate.
- No modificar suitability_engine.
- No modificar frontend.
- No activar FE-9.

---

## Historial de Bloques Relacionados

| Bloque | Descripción | Estado |
|--------|-------------|--------|
| BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0 | Primer write 25 fondos | ✅ OK |
| BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-100-1 | Segundo write 100 fondos | ✅ OK |
| BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-200-2 | Tercer write 200 fondos | ✅ OK |
| BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3 | Cuarto write 195 fondos | ✅ OK |
| BDB-MORNINGSTAR-PDF-UPDATED-BATCH-FINAL-CLOSEOUT-0 | Cierre ciclo 520 | ✅ OK |
| BDB-MORNINGSTAR-PDF-POSTWRITE-PROD-SMOKE-0 | Smoke producción | ✅ PASS |
| BDB-MORNINGSTAR-PDF-REVIEW-TRIAGE-0 | Triage 95 REVIEW | ✅ Cerrado |
| BDB-MORNINGSTAR-PDF-REVIEW-HIGH-REPARSE-DRYRUN-0 | Reparse 7 HIGH | ✅ 0/7 resueltos (PDF sin credit) |
| BDB-MORNINGSTAR-PDF-REVIEW-LOWRISK-NONRF-VALIDATOR-AUDIT-0 | Audit 11 low-risk | ✅ Cerrado |
| BDB-MORNINGSTAR-PDF-REVIEW-LOWRISK-NONRF-VALIDATOR-FIX-DRYRUN-0 | Fix validator + dry-run | ✅ 10/11 OK |
| **BDB-MORNINGSTAR-HIGH-CREDIT-MINI-EVIDENCE-0** | **Este documento** | **📝 Read-only** |

---

## Confirmación

| Invariante | Estado |
|:-----------|:-------|
| Firestore writes | 0 |
| Deploy | NO |
| Commit | NO |
| Push | NO |
| CORE tocado | NO |
| Frontend tocado | NO |
| Write gate creado | NO |
| REVIEW/ERROR artifacts tocados | NO |
