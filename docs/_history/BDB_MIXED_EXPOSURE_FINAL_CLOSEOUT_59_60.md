# BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60

**Estado:** REMEDIATION_COMPLETE (59/60)
**Fecha cierre:** 2026-05-11
**Último commit:** `fb14f38`
**Firestore writes en este documento:** 0
**Deploy:** NO
**Código modificado:** NO

---

## Resumen ejecutivo

La remediación de exposición económica para fondos MIXED en `funds_v3` ha sido **completada al 98.3%**.

| Métrica | Valor |
|---------|-------|
| Total fondos MIXED detectados | 60 |
| **Fondos corregidos** | **59/60** |
| Lotes ejecutados | 8 |
| Fuentes utilizadas | MS portfolio (lotes 1-7) + fichas oficiales gestora (lote 8) |
| Tests ejecutados por lote | 62/62 PASS |
| Campos prohibidos afectados | **0** |
| Rollbacks disponibles | Todos los lotes |
| Writes automáticos pendientes | **0** |
| Fondos pendientes | **1** — LU3038481936 Hamco Global Value R |

---

## Lotes ejecutados

| Lote | Count | Tipo | Fuente | Confidence | Commit | Verificación |
|------|-------|------|--------|------------|--------|-------------|
| 1 | 10 | Low-risk | MS portfolio | 0.85 | `d9ca28f` | 10/10 PASS |
| 2 | 5 | Low-risk | MS portfolio | 0.85 | `fd383c2` | 5/5 PASS |
| 3 | 15 | Low-risk | MS portfolio | 0.85 | `fd503e8` | 15/15 PASS |
| 4 | 5 | Review-required | MS portfolio | 0.85 | `a17ff30` | 5/5 PASS |
| 5 | 5 | Review-required | MS portfolio | 0.85 | `b044d20` | 5/5 PASS |
| 6 | 5 | Review-required (high-delta) | MS portfolio | 0.85 | `17e23fa` | 5/5 PASS |
| 7 | 9 | Review-required (ALL APPROVE) | MS portfolio | 0.85 | `84c9ec4` | 9/9 PASS |
| 8 | 5 | Official factsheet | Fichas gestora | **0.90** | `fb14f38` | 5/5 PASS |
| **Total** | **59** | | | | | **59/59 PASS** |

---

## Gate 8 — Fichas oficiales de gestora

Los 5 fondos del lote 8 fueron excluidos de los lotes automáticos (1-7) porque los datos Morningstar eran defectuosos. Se auditaron con fichas oficiales de gestora (Q1 2026) como fuente primaria.

| ISIN | Nombre | Gestora | eq% escrito | Error MS original |
|------|--------|---------|-------------|-------------------|
| FR0010306142 | Carmignac Patrimoine E | Carmignac | 35.4 | bond=0, cash=100 |
| LU0121216526 | GS Patrimonial Aggressive X | Goldman Sachs | 75.2 | eq infraestimado, 21% en other |
| LU0352312853 | Allianz Strategy 75 CT | Allianz | 86.0 | sum=170.81, apalancamiento extremo |
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | Allianz | 79.1 | **eq=0, bond=100 (inversión completa)** |
| LU1548496022 | Allianz Dynamic MA SRI 15 AT | Allianz | 24.6 | eq sobreestimado, commodities ausentes |

**Confidence:** 0.90 (superior a 0.85 de MS — ficha oficial es fuente primaria del gestor).
**Warning:** `EXPOSURE_SOURCE_OFFICIAL_FACTSHEET`

---

## Fondo pendiente (1/60)

| Campo | Valor |
|-------|-------|
| **ISIN** | LU3038481936 |
| **Nombre** | Hamco Global Value R EUR Acc |
| **Estado** | SIN DATOS — FONDO NUEVO |
| **Exposición actual** | eq=80, bd=20 (fallback AGGRESSIVE_ALLOCATION) |
| **Confidence actual** | 0.45 |
| **ms.portfolio.asset_allocation** | `null` |
| **Ficha oficial disponible** | NO |
| **Decisión** | NO TOCAR |

### Motivo de exclusión
Fondo nuevo sin histórico suficiente. No tiene datos Morningstar (`ms.portfolio.asset_allocation = null`) ni ficha oficial de gestora disponible con desglose de cartera. El fallback AGGRESSIVE (80/20) se mantiene como aproximación razonable dado el nombre "Global Value".

### Acción futura
Revisar cuando se cumpla **cualquiera** de estas condiciones:
1. Morningstar publique datos de portfolio para este ISIN.
2. La gestora (Hamco) publique ficha con desglose de cartera.
3. El fondo aparezca en una cartera real o propuesta comercial donde la precisión sea crítica.

Tarea futura: `BDB-MIXED-PENDING-ISIN-REVIEW-LU3038481936`

---

## Confirmaciones de seguridad (acumulado 8 lotes)

| Check | Estado |
|-------|--------|
| Solo `portfolio_exposure_v2` actualizado | ✅ 59/59 |
| `manual` / `manual.costs` / `manual.costs.retrocession` intactos | ✅ 59/59 |
| `classification_v2` intacto | ✅ 59/59 |
| `ms` intacto | ✅ 59/59 |
| `derived` intacto | ✅ 59/59 |
| `std_perf` intacto | ✅ 59/59 |
| Deploy ejecutado | ❌ NO |
| optimizer_core.py modificado | ❌ NO |
| suitability_engine.py modificado | ❌ NO |
| Frontend modificado | ❌ NO |
| firestore.rules modificado | ❌ NO |
| BDB-FONDOS-CORE modificado | ❌ NO |
| `set()` usado | ❌ NO — siempre `update()` |

---

## Commits de la remediación completa

```
d9ca28f  BDB_MIXED_EXPOSURE: controlled write first low-risk batch
fd383c2  BDB_MIXED_EXPOSURE: controlled write second low-risk batch
fd503e8  BDB_MIXED_EXPOSURE: controlled write third low-risk batch
a17ff30  BDB_MIXED_EXPOSURE: controlled write first review-required batch
b044d20  BDB_MIXED_EXPOSURE: controlled write second review-required batch
17e23fa  BDB_MIXED_EXPOSURE: controlled write third review-required batch
84c9ec4  BDB_MIXED_EXPOSURE: controlled write final approved review batch
f7bae55  BDB_MIXED_EXPOSURE: close remediation with pending manual review
24bbcfb  BDB_MIXED_EXPOSURE: audit pending funds with official factsheets
71399a0  BDB_MIXED_EXPOSURE: prepare write gate 8 with official factsheet data
fb14f38  BDB_MIXED_EXPOSURE: controlled write official factsheet pending funds
```

Pipeline fix original: `1ed2447` — `buildPortfolioExposureV2()` now uses `metrics → ms.portfolio → fallback`.

---

## Recomendación operativa final

1. **No hacer más writes automáticos.** La remediación está completa a efectos prácticos.
2. **Hamco queda fuera** hasta que haya datos fiables.
3. **No se requiere deploy** para esta remediación (los datos ya están escritos en Firestore).
4. **Rollbacks disponibles** para los 59 fondos en 8 gate directories.
5. **Los 59 fondos operan ahora con exposición económica real** (MS portfolio o ficha oficial) en lugar de fallback genérico.

---

## Impacto logrado

| Área | Antes | Después |
|------|-------|---------|
| Exposición económica MIXED | 60 fondos con fallback genérico (50/50, 80/20, 20/80) | 59 fondos con datos reales (MS o ficha oficial) |
| Confidence | 0.45 (60 fondos) | 0.85-0.90 (59 fondos) |
| Solver | Asignaciones basadas en fallback | Asignaciones basadas en look-through real |
| Suitability | Evaluación distorsionada | Evaluación alineada con exposición real |
| Reporting | Asset allocation inexacto | Asset allocation basado en datos de portfolio |
