# BDB_RETROCESSION_RELOAD_DRY_RUN_REAL_1_REVIEW

> **Tipo:** Revisión de dry-run real — decisión pre-write gate  
> **Fecha:** 2026-05-08 (decisión usuario: 2026-05-09)  
> **Dry-run base:** `BDB-RETRO-IMPORT-1_READY_FOR_REVIEW`  
> **Estado Git:** HEAD = origin/master = `c4ae61a`  
> **Modo:** READ-ONLY / Documentación — NO se escribió Firestore

---

## 1. Resumen Ejecutivo

Revisión completa del dry-run real de retrocesiones ejecutado contra `funds_v3` producción (670 docs leídos). Se clasifican los 282 registros procesables en tres categorías de decisión para un posible write gate controlado.

| Categoría decisión | Fondos | Descripción |
|--------------------|--------|-------------|
| **APPROVED_FOR_WRITE_GATE** | **44** | Updates aprobados para write controlado |
| **UNCHANGED_NO_WRITE** | **191** | Sin cambio necesario |
| **EXCLUDE_KEEP_DB_VALUE** | **3** | Usuario confirma mantener valor actual en BD |
| **EXCLUDE_NOT_FOUND** | **44** | No encontrados en DB — no se pueden escribir |
| **IGNORED_NON_STANDARD_CODE** | **8** | Códigos internos excluidos |

> **`user_confirmed_keep_db_value_for_review_cases`** — Los 3 fondos que pasaban a 0 fueron revisados por el usuario y se decidió mantener el valor actual en `manual.costs.retrocession`.

---

## 2. Fuentes

| Fuente | Ruta |
|--------|------|
| CSV oficial actualizado | `retrocesiones_2026_05_08_normalized.csv` |
| CSV auxiliar normalizado | `data/retrocessions/retrocesiones_2026_05_08_for_dry_run.csv` |
| Artifact dry-run JSON | `artifacts/bdb_data_audit/retrocession_reload_dry_run_real_1/retrocession_reload_dry_run.json` |
| Artifact dry-run CSV | `artifacts/bdb_data_audit/retrocession_reload_dry_run_real_1/retrocession_reload_dry_run.csv` |
| Informe dry-run | `docs/BDB_RETROCESSION_RELOAD_DRY_RUN_REAL_1.md` |

---

## 3. Totales Dry-Run

| Métrica | Valor |
|---------|-------|
| Filas CSV fuente | 290 |
| ISINs procesables | 282 |
| Códigos no estándar ignorados | 8 |
| Fondos leídos de `funds_v3` | 670 |
| UNCHANGED | 191 |
| UPDATE_CONFIRMED | 9 |
| LARGE_CHANGE_REVIEW | 38 |
| ISIN_NOT_FOUND | 44 |
| Writes realizados | **0** |

---

## 4. UPDATE_CONFIRMED (9 fondos)

Cambios deterministas dentro de tolerancia. Todos pasan de 0 a valor positivo < 0.50.

| # | ISIN | Nombre | Actual | Nueva | Δ |
|---|------|--------|--------|-------|---|
| 1 | ES0168797092 | Gestión Boutique II JPB Growth FI | 0 | 0.47 | +0.47 |
| 2 | FR0013460920 | EdR SICAV - Short Duration Credit A EUR | 0 | 0.34 | +0.34 |
| 3 | IE00B4ZJ4188 | Comgest Growth Europe Opportunities EUR Acc | 0 | 0.49 | +0.49 |
| 4 | LU0113257694 | Schroder ISF EURO Corporate Bond | 0 | 0.45 | +0.45 |
| 5 | LU0133717503 | Schroder ISF EURO Corporate Bond | 0 | 0.45 | +0.45 |
| 6 | LU0170473374 | Franklin European Total Return A(acc)EUR | 0 | 0.41 | +0.41 |
| 7 | LU0690375182 | Fundsmith Equity Fund T EUR Acc | 0 | 0.10 | +0.10 |
| 8 | LU0772958525 | Nordea North American Sustainable Stars | 0 | 0.48 | +0.48 |
| 9 | LU1481583711 | Flossbach von Storch Bond Opportunities RT | 0 | 0.41 | +0.41 |

**Decisión propuesta:** `APPROVE_SAFE` — Todos son 0→valor razonable (<0.50). Write automático seguro.

---

## 5. LARGE_CHANGE_REVIEW (38 fondos) — Desglosado

### 5.1 De 0/null → valor positivo (29 fondos)

Fondos que no tenían retrocesión cargada en DB. El CSV aporta el dato por primera vez.

| # | ISIN | Nombre | Actual | Nueva | Δ |
|---|------|--------|--------|-------|---|
| 1 | ES0175604034 | Gesconsult León Valores Mixto Flexible A | 0 | 1.82 | +1.82 |
| 2 | LU0119750205 | Invesco Sustainable Pan European Struct | 0 | 1.52 | +1.52 |
| 3 | LU1279334483 | Pictet - Robotics R EUR | 0 | 1.47 | +1.47 |
| 4 | LU0117843481 | JPMorgan Taiwan Fund A (dist) USD | 0 | 1.44 | +1.44 |
| 5 | LU0256839860 | Allianz Europe Equity Growth | 0 | 1.44 | +1.44 |
| 6 | LU0114722738 | Fidelity Global Financial Services | 0 | 1.38 | +1.38 |
| 7 | ES0137381036 | Gesconsult Renta Variable Iberia A | 0 | 1.35 | +1.35 |
| 8 | ES0140643034 | GVC Gaesco Europa FI | 0 | 1.35 | +1.35 |
| 9 | FR0010312660 | Carmignac Investissement E EUR Acc | 0 | 1.35 | +1.35 |
| 10 | LU1244893696 | EdR Fund - Big Data A-EUR | 0 | 1.20 | +1.20 |
| 11 | FR0011261197 | R-co Valor F EUR | 0 | 0.99 | +0.99 |
| 12 | FR0010321810 | Echiquier Agenor SRI Mid Cap Europe A | 0 | 0.95 | +0.95 |
| 13 | LU0125951151 | MFS Meridian European Value Fund A1 EUR | 0 | 0.89 | +0.89 |
| 14 | LU0365089902 | Jupiter India Select L USD A Inc | 0 | 0.86 | +0.86 |
| 15 | LU0224105477 | BlackRock Continental European Flexible | 0 | 0.84 | +0.84 |
| 16 | LU1103303167 | EdR Fund - US Value A EUR | 0 | 0.84 | +0.84 |
| 17 | BE0946564383 | DPAM B Equities NewGems Sustainable | 0 | 0.79 | +0.79 |
| 18 | LU0119620416 | Morgan Stanley Global Brands A | 0 | 0.79 | +0.79 |
| 19 | LU1378878430 | Morgan Stanley Asia Opportunity Fund | 0 | 0.79 | +0.79 |
| 20 | FR0010286013 | Sextant Grand Large A | 0 | 0.75 | +0.75 |
| 21 | LU0181496216 | Schroder ISF Emerging Asia A1 | 0 | 0.72 | +0.72 |
| 22 | LU0302445910 | Schroder ISF Global Climate Change | 0 | 0.72 | +0.72 |
| 23 | LU1983299162 | Schroder ISF Global Alternative Trends | 0 | 0.72 | +0.72 |
| 24 | LU0607983896 | Nordea Alpha 15 MA Fund BP EUR | 0 | 0.71 | +0.71 |
| 25 | FR0010288308 | Groupama Avenir Euro NC | 0 | 0.68 | +0.68 |
| 26 | LU0599946893 | DWS Concept Kaldemorgen EUR LC | 0 | 0.66 | +0.66 |
| 27 | LU1278917452 | DWS Invest CROCI Sectors Plus LC | 0 | 0.60 | +0.60 |
| 28 | ES0173323009 | Renta 4 Wertefinder FI | 0 | 0.53 | +0.53 |
| 29 | FR001400JGB5 | EdR SICAV Millesima Select 2028 A EUR | 0 | 0.51 | +0.51 |

**Análisis:** Todos son 0→valor positivo, rango 0.51%–1.82%. Son fondos que no tenían retrocesión configurada y el CSV oficial aporta el dato real. Rango razonable para fondos de distribución (la media del CSV no-cero es 0.89%).

**Decisión propuesta:** `APPROVE_SAFE` — Son datos nuevos legítimos del distribuidor. El hecho de que el delta sea "grande" es porque pasaban de 0 a un valor real; no hay conflicto con dato anterior.

### 5.2 De valor → 0 (5 fondos)

| # | ISIN | Nombre | Actual | Nueva | Notas | Riesgo |
|---|------|--------|--------|-------|-------|--------|
| 1 | FR0013460961 | EdR SICAV Short Duration Credit B | 0.01 | 0 | CSV trae `0,00%` | 🟢 BAJO — 0.01 trivial |
| 2 | IE00BYR8H148 | Jupiter Merian World Equity L EUR | 0.50 | 0 | **Retro vacía en CSV** | 🔴 ALTO — dato faltante |
| 3 | LU0235308482 | Alken European Opportunities R | 0.50 | 0 | CSV trae `0,00%` | 🟡 MEDIO — confirmar |
| 4 | LU1762221155 | Invesco Global Founders & Owners F | 1.38 | 0 | CSV trae `0,00%` | 🟡 MEDIO — cambio grande |
| 5 | LU1902444584 | CPR Invest Climate Bonds Euro A | 0.10 | 0 | CSV trae `0,00%` | 🟢 BAJO — 0.10 trivial |

**Decisión FINAL (usuario 2026-05-09):**

| ISIN | Decisión | Justificación |
|------|----------|---------------|
| FR0013460961 | `APPROVED_FOR_WRITE_GATE` | 0.01→0 trivial, probablemente era residual |
| IE00BYR8H148 | `EXCLUDE_KEEP_DB_VALUE` ⛔ | Retro **vacía** en CSV. **Usuario confirma mantener 0.50 en BD** |
| LU0235308482 | `EXCLUDE_KEEP_DB_VALUE` ⛔ | 0.50→0 significativo. **Usuario confirma mantener 0.50 en BD** |
| LU1762221155 | `EXCLUDE_KEEP_DB_VALUE` ⛔ | 1.38→0 muy significativo. **Usuario confirma mantener 1.38 en BD** |
| LU1902444584 | `APPROVED_FOR_WRITE_GATE` | 0.10→0 menor, CSV explícito con `0,00%` |

### 5.3 Cambios genuinos de valor (4 fondos)

| # | ISIN | Nombre | Actual | Nueva | Δ | Causa |
|---|------|--------|--------|-------|---|-------|
| 1 | LU0231205856 | Franklin India Fund N(acc)EUR | **0.0158** | 1.58 | +1.56 | Escala errónea anterior (/100) |
| 2 | LU0267984697 | Invesco India Equity Fund E | **0.0155** | 1.55 | +1.53 | Escala errónea anterior (/100) |
| 3 | LU0637335638 | Nordea Indian Equity Fund BP EUR | **0.0069** | 0.69 | +0.68 | Escala errónea anterior (/100) |
| 4 | ES0138922036 | Gesconsult Corto Plazo A FI | 0.46 | 0.71 | +0.25 | Update genuino |

**Análisis escala errónea:**

Los 3 primeros tienen valores actuales que son **exactamente** el valor CSV dividido por 100:
- 1.58 / 100 = 0.0158 ✅
- 1.55 / 100 = 0.0155 ✅
- 0.69 / 100 = 0.0069 ✅

Esto confirma que fueron importados previamente con escala errónea. El CSV actual los corrige.

**Decisión propuesta:**

| ISIN | Decisión | Justificación |
|------|----------|---------------|
| LU0231205856 | `APPROVE_SAFE` | Corrección de escala evidente |
| LU0267984697 | `APPROVE_SAFE` | Corrección de escala evidente |
| LU0637335638 | `APPROVE_SAFE` | Corrección de escala evidente |
| ES0138922036 | `APPROVE_SAFE` | 0.46→0.71 razonable, rango normal |

---

## 6. ISIN_NOT_FOUND (44 fondos)

ISINs presentes en el CSV pero que no existen en `funds_v3`. No se puede escribir nada.

| # | ISIN | Retro CSV | Origen probable |
|---|------|-----------|-----------------|
| 1 | ES0105001004 | 0.30 | Fondo español no importado |
| 2 | ES0112611001 | 0 | Fondo español no importado |
| 3 | ES0116831001 | 0.16 | Fondo español no importado |
| 4 | ES0138328036 | 0 | Fondo español no importado |
| 5 | ES0138612033 | 0.38 | Fondo español no importado |
| 6 | ES0138614039 | 0 | Fondo español no importado |
| 7 | ES0138800034 | 0 | Fondo español no importado |
| 8 | ES0141113003 | 0.89 | Fondo español no importado |
| 9 | ES0159031030 | 0 | Fondo español no importado |
| 10 | ES0161937034 | 0 | Fondo español no importado |
| 11 | ES0164949002 | 1.47 | Fondo español no importado |
| 12 | ES0165151038 | 0.06 | Fondo español no importado |
| 13 | ES0165154008 | 0.29 | Fondo español no importado |
| 14 | ES0173315005 | 0.53 | Fondo español no importado |
| 15 | ES0173321003 | 0 | Fondo español no importado |
| 16 | ES0173322001 | 0.38 | Fondo español no importado |
| 17 | ES0180470009 | 0.39 | Fondo español no importado |
| 18 | ES0182744005 | 0 | Fondo español no importado |
| 19 | FR0010235507 | 0 | Fondo francés no importado |
| 20 | FR0010560177 | 0.03 | Fondo francés no importado |
| 21 | FR0013514601 | 0.59 | Fondo francés no importado |
| 22 | FR001400KID6 | 0 | Fondo francés no importado |
| 23 | IE0004868828 | 0.62 | Fondo irlandés no importado |
| 24 | IE00B52B6D44 | 0.49 | Fondo irlandés no importado |
| 25 | IE00B78R4C06 | 0.49 | Fondo irlandés no importado |
| 26 | LU0063042062 | 0.54 | Fondo luxemburgués no importado |
| 27 | LU0066402651 | 0.95 | Fondo luxemburgués no importado |
| 28 | LU0090738252 | 0.82 | Fondo luxemburgués no importado |
| 29 | LU0115141110 | 1.52 | Fondo luxemburgués no importado |
| 30 | LU0115142191 | 1.35 | Fondo luxemburgués no importado |
| 31 | LU0175323400 | 0.98 | Fondo luxemburgués no importado |
| 32 | LU0232465384 | 0.93 | Fondo luxemburgués no importado |
| 33 | LU0348927095 | 1.45 | Fondo luxemburgués no importado |
| 34 | LU0418790928 | 1.14 | Fondo luxemburgués no importado |
| 35 | LU0425100038 | 0.74 | Fondo luxemburgués no importado |
| 36 | LU0638558550 | 0.39 | Fondo luxemburgués no importado |
| 37 | LU0714181541 | 1.44 | Fondo luxemburgués no importado |
| 38 | LU0714907184 | 1.52 | Fondo luxemburgués no importado |
| 39 | LU0727122854 | 0.74 | Fondo luxemburgués no importado |
| 40 | LU0731782804 | 0.74 | Fondo luxemburgués no importado |
| 41 | LU1273541463 | 0.74 | Fondo luxemburgués no importado |
| 42 | LU1582983133 | 1.03 | Fondo luxemburgués no importado |
| 43 | LU2000523212 | 0.72 | Fondo luxemburgués no importado |
| 44 | LU2240057096 | 0.90 | Fondo luxemburgués no importado |

**Decisión:** `EXCLUDE_FROM_WRITE` — No existen en DB, no se puede escribir. La retrocesión queda registrada en el CSV para cuando se importen.

---

## 7. Retrocesiones Vacías Defaulted a 0

| ISIN | Nombre | Actual BD | CSV | Nota |
|------|--------|-----------|-----|------|
| IE00BYR8H148 | Jupiter Merian World Equity L EUR Acc | 0.50 | **vacío** | `retrocession_missing_defaulted_to_zero` |

**Análisis:** El campo retrocesiones viene vacío en el CSV oficial para este fondo.

**Decisión FINAL (usuario 2026-05-09):** `EXCLUDE_KEEP_DB_VALUE` — **Mantener 0.50 en BD.** No sobrescribir con 0. Anotación: `user_confirmed_keep_db_value_for_review_cases`.

---

## 8. Códigos Ignorados (8)

| Código | Tipo |
|--------|------|
| N0101 | DGS / código interno |
| N0103 | DGS / código interno |
| N3242 | código interno |
| N4194 | código interno |
| N4196 | código interno |
| N5138 | código interno |
| N5424 | código interno |
| V1030 | código interno |

**Decisión:** Correctamente excluidos. No son ISINs.

---

## 9. Decisión Final Consolidada (usuario 2026-05-09)

### APPROVED_FOR_WRITE_GATE (44 fondos)

| Subcategoría | Count | Detalle |
|--------------|-------|---------|
| UPDATE_CONFIRMED (0→valor < 0.50) | 9 | Write automático seguro |
| 0/null→valor (nuevos legítimos) | 29 | Primera carga de retrocesión |
| Corrección escala errónea (0.01xx→valor) | 3 | Corrección obvia de /100 |
| Cambio genuino normal (ES0138922036) | 1 | 0.46→0.71, rango razonable |
| Valor→0 trivial (FR0013460961) | 1 | 0.01→0, residual |
| Valor→0 menor (LU1902444584) | 1 | 0.10→0, CSV explícito |
| **TOTAL WRITABLE** | **44** | |

### UNCHANGED_NO_WRITE (191 fondos)

Valor en BD = CSV. No requieren write.

### EXCLUDE_KEEP_DB_VALUE (3 fondos) ⛔

> **`user_confirmed_keep_db_value_for_review_cases`**

| ISIN | Nombre | BD actual | CSV | Decisión usuario |
|------|--------|-----------|-----|------------------|
| **IE00BYR8H148** | Jupiter Merian World Equity L EUR | **0.50** | vacío→0 | **Mantener 0.50** |
| **LU0235308482** | Alken European Opportunities R | **0.50** | 0 | **Mantener 0.50** |
| **LU1762221155** | Invesco Global Founders & Owners F | **1.38** | 0 | **Mantener 1.38** |

Estos 3 ISINs **NO deben incluirse** en la lista de writes del write gate.

### EXCLUDE_NOT_FOUND (44 fondos)

Todos `ISIN_NOT_FOUND`. No existen en `funds_v3`. No se puede escribir.

### IGNORED_NON_STANDARD_CODE (8)

N0101, N0103, N3242, N4194, N4196, N5138, N5424, V1030.

---

## 10. Lista Explícita: Fondos Excluidos del Write Gate

### A) EXCLUDE_KEEP_DB_VALUE — Confirmado por usuario (3)

| ISIN | BD actual | CSV | Decisión final |
|------|-----------|-----|----------------|
| IE00BYR8H148 | **0.50** | vacío→0 | ⛔ NO escribir. Mantener 0.50 |
| LU0235308482 | **0.50** | 0 | ⛔ NO escribir. Mantener 0.50 |
| LU1762221155 | **1.38** | 0 | ⛔ NO escribir. Mantener 1.38 |

### B) EXCLUDE_NOT_FOUND (44)

No pueden escribirse — el fondo no existe en la base de datos.

---

## 11. Lista Explícita: Fondos Candidatos a Write Gate

Si se aprueba, los siguientes **44 fondos** se actualizarían:

| Categoría | Count | ISINs |
|-----------|-------|-------|
| UPDATE_CONFIRMED | 9 | ES0168797092, FR0013460920, IE00B4ZJ4188, LU0113257694, LU0133717503, LU0170473374, LU0690375182, LU0772958525, LU1481583711 |
| 0→valor (nuevos) | 29 | BE0946564383, ES0137381036, ES0140643034, ES0173323009, ES0175604034, FR0010286013, FR0010288308, FR0010312660, FR0010321810, FR0011261197, FR001400JGB5, LU0114722738, LU0117843481, LU0119620416, LU0119750205, LU0125951151, LU0181496216, LU0224105477, LU0256839860, LU0302445910, LU0365089902, LU0599946893, LU0607983896, LU1103303167, LU1244893696, LU1278917452, LU1279334483, LU1378878430, LU1983299162 |
| Escala errónea | 3 | LU0231205856, LU0267984697, LU0637335638 |
| Genuino normal | 1 | ES0138922036 |
| 0→0 trivial | 2 | FR0013460961, LU1902444584 |

---

## 12. Riesgos

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| IE00BYR8H148 puede perder retro legítima | 🔴 ALTO | Excluir del write hasta confirmar |
| LU1762221155 pierde retro de 1.38 | 🟡 MEDIO | Excluir del write hasta confirmar |
| LU0235308482 pierde retro de 0.50 | 🟡 MEDIO | Excluir del write hasta confirmar |
| 44 ISINs no encontrados | 🟢 BAJO | Normal, datos listos para futura importación |
| Escala de 3 fondos era incorrecta | 🟢 POSITIVO | Se corrige con el write |

---

## 13. Qué NO Se Hizo

| Restricción | ✅ |
|-------------|---|
| NO Firestore writes | ✅ |
| NO deploy | ✅ |
| NO commit | ✅ |
| NO push | ✅ |
| NO parser contra PDFs | ✅ |
| NO Gemini real | ✅ |
| NO CORE | ✅ |
| NO scripts/scratch/ leído/tocado | ✅ |
| NO .playwright-mcp/ leído/tocado | ✅ |
| NO CSV original modificado | ✅ |

---

## 14. Próximo Bloque Recomendado

### Opción A: `BDB-RETRO-IMPORT-2-WRITE-GATE` (recomendado)

**Solo si se aprueba manualmente:**
1. La lista de 44 fondos candidatos.
2. La exclusión de los 3 fondos en `REVIEW_REQUIRED`.
3. La política de exclusión de los 44 `ISIN_NOT_FOUND`.

**Mecánica propuesta del write gate:**
- Script en modo write controlado.
- Lista explícita de ISINs aprobados.
- Dry-run previo al write como doble confirmación.
- Un write, un backup, un rollback plan.
- Commit y push tras el write.

### Opción B: `BDB-RETRO-IMPORT-1-FIX-SOURCE`

Solo si el usuario decide que los 3 fondos `REVIEW_REQUIRED` deben investigarse antes.

---

## 15. Decisión Final

### Estado: `BDB_RETRO_RELOAD_DRY_RUN_REAL_1_REVIEW_CONFIRMED`

| Categoría | Count |
|-----------|-------|
| APPROVED_FOR_WRITE_GATE | **44** fondos |
| UNCHANGED_NO_WRITE | **191** fondos |
| EXCLUDE_KEEP_DB_VALUE | **3** fondos (usuario confirmó mantener BD) |
| EXCLUDE_NOT_FOUND | **44** fondos |
| IGNORED_NON_STANDARD_CODE | **8** códigos |
| **Total procesados** | **290** filas |

> **Anotación:** `user_confirmed_keep_db_value_for_review_cases` — 2026-05-09  
> Los 3 fondos que el CSV ponía a 0 fueron revisados por el usuario y se decidió mantener el valor actual en `manual.costs.retrocession`.  
> El write gate debe aplicarse SOLO a los 44 fondos `APPROVED_FOR_WRITE_GATE`.

| Campo | Valor |
|-------|-------|
| Listo para write gate | **SÍ** |
| Próximo bloque | `BDB-RETRO-IMPORT-2-WRITE-GATE` |
