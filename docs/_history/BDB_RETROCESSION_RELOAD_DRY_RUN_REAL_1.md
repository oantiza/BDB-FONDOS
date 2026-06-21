# BDB_RETROCESSION_RELOAD_DRY_RUN_REAL_1

> **Tipo:** Informe dry-run real — NO se escribió Firestore  
> **Fecha:** 2026-05-08  
> **Estado base:** HEAD = origin/master = `c4ae61a`  
> **Modo:** DRY_RUN_READ_ONLY

---

## 1. Resumen Ejecutivo

Dry-run real ejecutado contra Firestore producción (read-only) usando el CSV oficial actualizado `retrocesiones_2026_05_08_normalized.csv`. El script leyó 670 documentos de `funds_v3` y clasificó 282 ISINs procesables.

| Métrica | Valor |
|---------|-------|
| Filas archivo fuente | 290 |
| ISINs procesables | 282 |
| Códigos no estándar ignorados | 8 |
| Fondos leídos de funds_v3 | 670 |
| Sin cambios (UNCHANGED) | 191 |
| Updates confirmados (UPDATE_CONFIRMED) | 9 |
| Cambios grandes (LARGE_CHANGE_REVIEW) | 38 |
| ISIN no encontrado | 44 |
| Writes realizados | **0** |

---

## 2. Estado Base Git

| Campo | Valor |
|-------|-------|
| HEAD | `c4ae61a` |
| origin/master | `c4ae61a` |
| Rama | master |
| Último commit | `OPTIMIZER_TESTS: add canonical constraints contract coverage` |
| Modo | dry-run only — NO Firestore writes |

---

## 3. Archivo de Entrada

| Campo | Valor |
|-------|-------|
| CSV fuente oficial | `retrocesiones_2026_05_08_normalized.csv` |
| Separador | `;` |
| Columnas fuente | `nombre;isin;retrocesiones` |
| CSV auxiliar generado | `data/retrocessions/retrocesiones_2026_05_08_for_dry_run.csv` |
| Columnas auxiliar | `ISIN;retrocession_percent;source;as_of_date;notes;fund_name` |
| Nota | CSV auxiliar anterior (con datos obsoletos) fue **reemplazado** con valores actualizados |
| CSV anterior | Descartado — este es el CSV oficial actualizado |

---

## 4. Confirmación de Escala

| Valor CSV | Interpretación BDB | Correcto |
|-----------|-------------------|----------|
| `0,79%` | 0.79 | ✅ |
| `0,52%` | 0.52 | ✅ |
| `2,50%` | 2.5 | ✅ |
| `0,00%` | 0 | ✅ |
| vacío/ausente | 0 | ✅ |

- ❌ NO se divide por 100
- ❌ NO se multiplica dos veces
- ✅ Porcentaje directo = valor BDB canonical

**Evidencia de escala correcta:** Tres fondos en BD tienen valores erróneos por escala incorrecta anterior:
- `LU0231205856`: BD actual `0.0158` → CSV `1.58` (estaba dividido por 100)
- `LU0267984697`: BD actual `0.0155` → CSV `1.55` (estaba dividido por 100)
- `LU0637335638`: BD actual `0.0069` → CSV `0.69` (estaba dividido por 100)

Estos 3 fondos confirman que la escala correcta es porcentaje directo.

---

## 5. Normalizaciones Aplicadas

| Caso | ISIN | Acción | Nota |
|------|------|--------|------|
| Punto final | `LU1670722161.` → `LU1670722161` | Corregido | `isin_trimmed_trailing_dot` |
| Retro vacía | `IE00BYR8H148` | Defaulted a 0 | `retrocession_missing_defaulted_to_zero` |
| ISIN corregido | `IE00BYVJR916` | Procesado normal | Ya correcto en CSV: 0.83 |
| ISIN corregido | `IE00B87MS887` | Procesado normal | Ya correcto en CSV: 0.95 |

---

## 6. Códigos Ignorados

| Código | Tipo |
|--------|------|
| N0101 | `ignored_non_standard_code` |
| N0103 | `ignored_non_standard_code` |
| N3242 | `ignored_non_standard_code` |
| N4194 | `ignored_non_standard_code` |
| N4196 | `ignored_non_standard_code` |
| N5138 | `ignored_non_standard_code` |
| N5424 | `ignored_non_standard_code` |
| V1030 | `ignored_non_standard_code` |

---

## 7. Validación de Formato

| Métrica | Valor |
|---------|-------|
| Total filas (sin header) | 290 |
| ISINs procesables | 282 |
| ISINs corregidos (trailing dot) | 1 |
| Códigos no estándar ignorados | 8 |
| Retrocesiones ausentes → 0 | 1 |
| Duplicados | 0 |
| Negativos | 0 |
| > 5% | 0 |
| Valores cero | 22 |
| ISINs únicos | 282 |
| Max retrocesión | 2.50% |
| Media (no cero) | 0.89% |

---

## 8. Resultados Dry-Run

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| `UNCHANGED` | 191 | Valor en BD = valor CSV, sin cambio necesario |
| `ISIN_NOT_FOUND` | 44 | ISIN del CSV no existe en `funds_v3` |
| `LARGE_CHANGE_REVIEW` | 38 | Cambio > 0.50 abs o > 50% relativo |
| `UPDATE_CONFIRMED` | 9 | Cambio determinista dentro de tolerancia |
| Writes realizados | **0** | Modo dry-run |

### Desglose LARGE_CHANGE_REVIEW (38)

| Subcategoría | Cantidad |
|--------------|----------|
| De 0/null → valor positivo | 29 |
| De valor → 0 | 5 |
| Cambio genuino de valor | 4 |

---

## 9. Tabla de Cambios Relevantes

### Top 20 cambios mayores (por delta absoluto)

| ISIN | Nombre | Actual | Nueva | Δ | Estado |
|------|--------|--------|-------|---|--------|
| ES0175604034 | Gesconsult León Valores Mixto Flexible A | 0 | 1.82 | +1.82 | LARGE_CHANGE_REVIEW |
| LU0231205856 | Franklin India Fund N(acc)EUR | **0.0158** | 1.58 | +1.56 | LARGE_CHANGE_REVIEW |
| LU0267984697 | Invesco India Equity Fund | **0.0155** | 1.55 | +1.53 | LARGE_CHANGE_REVIEW |
| LU0119750205 | Invesco Sustainable Pan European Struct | 0 | 1.52 | +1.52 | LARGE_CHANGE_REVIEW |
| LU1279334483 | Pictet - Robotics R EUR | 0 | 1.47 | +1.47 | LARGE_CHANGE_REVIEW |
| LU0117843481 | JPMorgan Funds - Taiwan Fund A | 0 | 1.44 | +1.44 | LARGE_CHANGE_REVIEW |
| LU0256839860 | Allianz Global Investors Fund | 0 | 1.44 | +1.44 | LARGE_CHANGE_REVIEW |
| LU0114722738 | Fidelity Global Financial Services | 0 | 1.38 | +1.38 | LARGE_CHANGE_REVIEW |
| LU1762221155 | Invesco Global Founders & Owners F | 1.38 | **0** | -1.38 | LARGE_CHANGE_REVIEW |
| ES0137381036 | Gesconsult Renta Variable Iberia A | 0 | 1.35 | +1.35 | LARGE_CHANGE_REVIEW |
| ES0140643034 | GVC Gaesco Europa FI | 0 | 1.35 | +1.35 | LARGE_CHANGE_REVIEW |
| FR0010312660 | Carmignac Investissement E EUR Acc | 0 | 1.35 | +1.35 | LARGE_CHANGE_REVIEW |
| LU1244893696 | EdR Fund - Big Data A-EUR | 0 | 1.20 | +1.20 | LARGE_CHANGE_REVIEW |
| FR0011261197 | R-co Valor F EUR | 0 | 0.99 | +0.99 | LARGE_CHANGE_REVIEW |
| FR0010321810 | Echiquier Agenor SRI Mid Cap Europe A | 0 | 0.95 | +0.95 | LARGE_CHANGE_REVIEW |
| LU0125951151 | MFS Meridian European Value Fund | 0 | 0.89 | +0.89 | LARGE_CHANGE_REVIEW |
| LU0365089902 | Jupiter India Select L USD A Inc | 0 | 0.86 | +0.86 | LARGE_CHANGE_REVIEW |
| LU0224105477 | BlackRock Continental European Flex | 0 | 0.84 | +0.84 | LARGE_CHANGE_REVIEW |
| LU1103303167 | EdR Fund - US Value A EUR | 0 | 0.84 | +0.84 | LARGE_CHANGE_REVIEW |
| BE0946564383 | DPAM B - Equities NewGems Sustainable | 0 | 0.79 | +0.79 | LARGE_CHANGE_REVIEW |

### Cambios genuinos de valor (escala errónea anterior)

| ISIN | Nombre | Actual | Nueva | Δ | Causa probable |
|------|--------|--------|-------|---|----------------|
| LU0231205856 | Franklin India Fund | 0.0158 | 1.58 | +1.56 | **Escala errónea /100** |
| LU0267984697 | Invesco India Equity | 0.0155 | 1.55 | +1.53 | **Escala errónea /100** |
| LU0637335638 | LFDE Echiquier Agenor | 0.0069 | 0.69 | +0.68 | **Escala errónea /100** |
| ES0138922036 | Gesconsult Crecimiento | 0.46 | 0.71 | +0.25 | Actualización genuina |

### Fondos que pasan a 0 (5)

| ISIN | Nombre | Actual | Nueva | Causa |
|------|--------|--------|-------|-------|
| FR0013460961 | EdR SICAV - Short Duration Credit B | 0.01 | 0 | CSV trae 0 |
| IE00BYR8H148 | Jupiter Merian World Equity | 0.5 | 0 | **Retro vacía en CSV** |
| LU0235308482 | Alken Fund European Opportunities R | 0.5 | 0 | CSV trae 0 |
| LU1762221155 | Invesco Global Founders & Owners F | 1.38 | 0 | CSV trae 0 |
| LU1902444584 | CPR Invest Climate Bonds Euro A | 0.1 | 0 | CSV trae 0 |

### Updates confirmados automáticos (9)

| ISIN | Nombre | Actual | Nueva | Δ |
|------|--------|--------|-------|---|
| ES0168797092 | Gestión Boutique II JPB Growth | 0 | 0.47 | +0.47 |
| FR0013460920 | EdR SICAV Short Duration Credit A | 0 | 0.34 | +0.34 |
| IE00B4ZJ4188 | Comgest Growth Europe Opportunities | 0 | 0.49 | +0.49 |
| LU0113257694 | Schroder ISF EURO Corporate Bond | 0 | 0.45 | +0.45 |
| LU0133717503 | Schroder ISF EURO Short Term Bond | 0 | 0.45 | +0.45 |
| LU0170473374 | Franklin European Total Return A | 0 | 0.41 | +0.41 |
| LU0690375182 | Fundsmith Equity Fund T EUR | 0 | 0.10 | +0.10 |
| LU0772958525 | Nordea North American Sustainable Stars | 0 | 0.48 | +0.48 |
| LU1481583711 | Flossbach von Storch Bond Opportunities | 0 | 0.41 | +0.41 |

---

## 10. Casos a Revisión Humana

### A) ISIN no encontrados (44)

44 ISINs del CSV no existen en `funds_v3`. Pueden ser fondos que:
- Aún no fueron importados al sistema
- Fueron eliminados/archivados
- Son fondos de otras distribuidoras

No es un error del dry-run. Cuando se añadan esos fondos, la retrocesión estará lista en el CSV.

### B) Fondos que pasan a 0 (5)

Requieren validación humana:
- **IE00BYR8H148**: Retro **vacía** en CSV → defaulted a 0 (actual: 0.5). ¿Intencional?
- **LU1762221155**: CSV trae 0 explícito (actual: 1.38). ¿Cambio de condiciones?
- **LU0235308482**: CSV trae 0 (actual: 0.5). ¿Cambio de condiciones?
- **LU1902444584**: CSV trae 0 (actual: 0.1).
- **FR0013460961**: CSV trae 0 (actual: 0.01).

### C) Escala errónea anterior (3)

3 fondos tienen retrocesión actual que parece dividida por 100:
- **LU0231205856**: 0.0158 → debería ser 1.58
- **LU0267984697**: 0.0155 → debería ser 1.55
- **LU0637335638**: 0.0069 → debería ser 0.69

Este dry-run los corregirá a la escala correcta.

### D) De 0/null a valor positivo (29)

Son fondos que no tenían retrocesión cargada. El CSV aporta el dato. Todos parecen razonables (rango 0.56% – 1.82%).

---

## 11. Riesgos Detectados

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| IE00BYR8H148 pasa de 0.5 a 0 por retro vacía | 🟡 MEDIO | Confirmar si es intencional |
| LU1762221155 pierde retro de 1.38 | 🟡 MEDIO | Confirmar cambio de condiciones |
| 44 ISINs no encontrados | 🟢 BAJO | Normal si fondos no importados |
| 3 fondos con escala errónea se corregirán | 🟢 BAJO | Corrección positiva |

---

## 12. Qué NO Se Hizo

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

## 13. Recomendación

**Listo para revisión humana.**

Antes del write gate:
1. ✅ Confirmar los 5 fondos que pasan a 0 (¿intencional?)
2. ✅ Confirmar corrección de escala de los 3 fondos con 0.01xx
3. ✅ Decidir política sobre los 44 ISINs no encontrados (ignorar o importar)
4. ✅ Validar los 29 fondos que pasan de 0/null a valor positivo

---

## 14. Próximo Bloque Recomendado

| Prioridad | Bloque | Condición |
|-----------|--------|-----------|
| 1 | `BDB-RETRO-IMPORT-1-REVIEW` | Revisión humana de los 5 fondos a 0 y los 3 escala |
| 2 | `BDB-RETRO-IMPORT-2-WRITE-GATE` | Solo tras aprobación humana de todos los cambios |

---

## 15. Decisión Final

### Estado: `BDB_RETRO_RELOAD_DRY_RUN_REAL_1_READY_FOR_REVIEW`

Artifacts generados:
- `artifacts/bdb_data_audit/retrocession_reload_dry_run_real_1/retrocession_reload_dry_run.json`
- `artifacts/bdb_data_audit/retrocession_reload_dry_run_real_1/retrocession_reload_dry_run.csv`
- `data/retrocessions/retrocesiones_2026_05_08_for_dry_run.csv` (auxiliar regenerado)
