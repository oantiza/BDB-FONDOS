# BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0
## Write Gate — Preparación para Regeneración Controlada de `compatible_profiles`

**Bloque:** `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0`  
**Fecha:** 2026-05-11  
**Base commit:** `742e7b9` (BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0)  
**Modo:** Gate preparation — Read-only — 0 writes Firestore — 0 deploy  
**Estado:** ⏳ **PENDIENTE APROBACIÓN HUMANA**

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Gate preparado | ✅ Completo |
| Fondos seleccionados | **10** |
| Drift detectado (vs. dry-run de `98e2143`) | ✅ **NINGUNO** — 10/10 sin drift |
| `authorized` | ✅ **false** |
| `can_write` | ✅ **false** |
| `requires_human_approval` | ✅ **true** |
| Lectura live Firestore | ✅ 10 documentos — solo lectura |
| Firestore writes ejecutados | ✅ **CERO** |
| Deploy | ✅ **NO** |
| Artifacts generados | ✅ 5/5 |

> [!IMPORTANT]
> El manifest `write_approval_manifest.json` está bloqueado con `authorized=false, can_write=false`. El próximo bloque `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0` solo puede abrirse tras aprobación humana explícita en este documento.

---

## B. Universo de Decisión

| Grupo | Count | Acción |
|---|---|---|
| STALE totales (dry-run `98e2143`) | 24 | — |
| HOLD commodities/metales preciosos (`11d18e9`) | −14 | Excluidos permanentemente |
| Hamco LU3038481936 (sin historial) | −1 | Excluido permanentemente |
| **Candidatos para write gate** | **= 10** | ✅ Este bloque |

---

## C. Tabla de 10 Candidatos

| # | ISIN | Nombre | Before | After | Cambio | Risk | Razón |
|---|---|---|---|---|---|---|---|
| 1 | ES0118537002 | Olea Neutral FI | [4..10] | [3..10] | +p3 | LOW | equity=15.5% ≤ 45%, ADD_ONLY |
| 2 | ES0162946034 | Abante Selección FI | [4..10] | [3..10] | +p3 | LOW | equity=41.2% ≤ 45%, ADD_ONLY |
| 3 | FR0010306142 | Carmignac Patrimoine E EUR Acc | [4..10] | [3..10] | +p3 | LOW | equity=35.4% ≤ 45%, post-MIXED ADD_ONLY |
| 4 | LU0119195963 | Goldman Sachs Patrimonial Balanced | [4..10] | [3..10] | +p3 | LOW | equity=38.7% ≤ 45%, ADD_ONLY |
| 5 | LU0404220724 | JPMorgan Global Income Fund D | [4..10] | [3..10] | +p3 | LOW | equity=44.4% ≤ 45%, ADD_ONLY |
| 6 | LU1697017256 | Sigma Selection Moderate A | [4..10] | [3..10] | +p3 | LOW | equity=41.9% ≤ 45%, ADD_ONLY |
| 7 | LU1894680757 | Amundi Income Opportunities A2 EUR | [4..10] | [3..10] | +p3 | LOW | equity=30.3% ≤ 45%, ADD_ONLY |
| 8 | LU1883334275 | Amundi Global Subordinated Bond A EUR | [5..10] | [3..10] | +p3,+p4 | LOW | FIXED_INCOME, equity=0.0%, ADD_ONLY |
| 9 | LU1095739733 | First Eagle Amundi Income Builder AE-QD | [4..10] | [5..10] | **−p4** | 🔴 HIGH_UI_RISK | equity=61.9% > 60%, REMOVE_ONLY |
| 10 | LU1883330521 | Amundi Global Multi-Asset Target Income | [1..10] | [3..10] | **−p1,−p2** | 🔴 HIGH_UI_RISK | equity=31.7% > 30%, REMOVE_ONLY |

**Resumen por tipo:**

| Tipo | Count | Risk |
|---|---|---|
| ADD_ONLY (+p3) | 7 | LOW |
| ADD_ONLY (+p3,+p4) | 1 | LOW |
| REMOVE_ONLY (−p4) | 1 | HIGH_UI_RISK |
| REMOVE_ONLY (−p1,−p2) | 1 | HIGH_UI_RISK |
| **Total** | **10** | — |

---

## D. Casos de Mayor Riesgo UI

### D.1 LU1883330521 — Amundi Global Multi-Asset Target Income A2 EUR (C) 🔴

```
Stored:   [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
Proposed: [3, 4, 5, 6, 7, 8, 9, 10]
Remove:   p1, p2
Rule:     risk_profile <= 2 AND real_eq = 31.7% > 30% → BLOCKED
Drift:    ✅ None detected (live confirmed = artifact current)
```

**Riesgo activo:** Un usuario de perfil 1 o 2 (muy conservador) puede ver este fondo en su catálogo hoy. Si construye un portfolio con él, el optimizer/backend lo rechazará en tiempo real. La corrección elimina esta inconsistencia.

**Prioridad:** **ALTA** — peor escenario de impacto usuario.

### D.2 LU1095739733 — First Eagle Amundi Income Builder AE-QD 🟡

```
Stored:   [4, 5, 6, 7, 8, 9, 10]
Proposed: [5, 6, 7, 8, 9, 10]
Remove:   p4
Rule:     risk_profile == 4 AND real_eq = 61.9% > 60% → BLOCKED
Drift:    ✅ None detected (live confirmed = artifact current)
```

**Riesgo activo:** Un usuario de perfil 4 puede ver este fondo. El optimizer lo rechazará. La corrección es matemáticamente clara (1.9pp sobre el límite).

**Prioridad:** **MEDIA** — margen estrecho pero regla es hard boundary sin tolerancia.

---

## E. Artifacts Generados

Todos los artifacts están en `artifacts/suitability/compatible_profiles_write_gate_0/`:

| Artifact | Descripción | Clave |
|---|---|---|
| `selection.json` | ISINs seleccionados, lógica de exclusión, per-fund rationale | `write_executed=false` |
| `snapshots_before.json` | Snapshot live de Firestore para los 10 fondos antes de cualquier escritura | `snapshot_at: 2026-05-11T13:54:53Z` |
| `diff_manifest.json` | Diff completo: before/after por fondo, change_type, risk_level, forbidden_fields | `drift_detected_any=false` |
| `rollback_manifest.json` | Valores exactos para restaurar `classification_v2.compatible_profiles` si se hace rollback | `no_deletes=true` |
| `write_approval_manifest.json` | Manifest de aprobación — **bloqueado** | `authorized=false, can_write=false` |

---

## F. Campos que NO se Tocarían en el Write Gate

Solo se modificaría un campo exacto:

```
ALLOWED:  classification_v2.compatible_profiles
```

Campos explícitamente protegidos (incluidos en `forbidden_fields` del manifest):

```
portfolio_exposure_v2
manual
manual.costs
manual.costs.retrocession
ms
derived
std_perf
firestore_rules
optimizer
suitability_engine_logic
risk_bucket
asset_type
asset_subtype
is_sector_fund
sector_focus
is_suitable_low_risk
```

---

## G. Confirmaciones de Seguridad

| Confirmación | Estado |
|---|---|
| Firestore reads ejecutados | ✅ Solo lectura — 10 documentos |
| Firestore writes ejecutados | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Scripts históricos de write reejecutados | ✅ **NO** |
| `write_executed` en todos los artifacts | ✅ **false** |
| `authorized` en approval manifest | ✅ **false** |
| `can_write` en approval manifest | ✅ **false** |
| Script contiene `.set(`/`.update(`/`.delete(` en código activo | ✅ **NO** |
| Hamco incluido en selección | ✅ **NO** |
| Commodities/metales incluidos en selección | ✅ **NO** |
| Drift detectado en algún fondo | ✅ **NINGUNO — 10/10 sin drift** |

---

## H. Drift Report

La lectura live de Firestore confirma que todos los fondos tienen exactamente los mismos `compatible_profiles` que el artifact del dry-run (`98e2143`). No ha habido escrituras externas que alteren el estado desde el dry-run.

```
ES0118537002: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
ES0162946034: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
FR0010306142: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU0119195963: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU0404220724: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU1697017256: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU1894680757: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU1883334275: live=[5,6,7,8,9,10]    artifact=[5,6,7,8,9,10]    ✅ MATCH
LU1095739733: live=[4,5,6,7,8,9,10]  artifact=[4,5,6,7,8,9,10]  ✅ MATCH
LU1883330521: live=[1,2,3,4,5,6,7,8,9,10] artifact=[1,2,3,4,5,6,7,8,9,10] ✅ MATCH
```

---

## I. Tests Ejecutados

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| `test_mixed_exposure_ms_portfolio.py` | — | ✅ PASS |
| `test_mixed_funds_lookthrough_contract.py` | — | ✅ PASS |
| `rulesEngine.suitability.test.ts` | 34 | ✅ 34/34 |
| **TOTAL** | **119+** | **✅ TODOS PASS** |

---

## J. Próximo Bloque

### Requisito para apertura: **Aprobación Humana Explícita**

> [!IMPORTANT]
> Para abrir `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0`, el usuario debe:
> 1. Revisar `diff_manifest.json` — confirmar los 10 cambios propuestos.
> 2. Revisar `snapshots_before.json` — confirmar estado actual de cada fondo.
> 3. Confirmar que acepta los 2 casos de remoción (HIGH_UI_RISK).
> 4. Autorizar explícitamente en este documento o en el manifest.

### Lo que haría `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0`:
- Actualizar `classification_v2.compatible_profiles` para los 10 fondos.
- Solo el campo permitido — nada más.
- Verificar post-write que los nuevos valores son correctos.
- Re-ejecutar el script de dry-run para confirmar 0 STALE en esos 10 ISINs.
- Ejecutar tests completos post-write.
- Commit y push del closeout report.

---

## K. Exclusiones Confirmadas

### K.1 Hamco
- **LU3038481936** — Excluido permanentemente por datos insuficientes.

### K.2 Commodities / Metales Preciosos HOLD (14)

| ISIN | Decisión |
|---|---|
| IE00BYVJR916 | HOLD — commodities/metales |
| LU0090845842 | HOLD — commodities/metales |
| LU0171306680 | HOLD — commodities/metales |
| LU0172157280 | HOLD — commodities/metales |
| LU0172157363 | HOLD — commodities/metales |
| LU0273148055 | HOLD — commodities/metales |
| LU0273159177 | HOLD — commodities/metales |
| LU0326425351 | HOLD — commodities/metales |
| LU0496368142 | HOLD — commodities/metales |
| LU0496369389 | HOLD — commodities/metales |
| LU0604766674 | HOLD — commodities/metales |
| LU1223083087 | HOLD — commodities/metales |
| LU1223084051 | HOLD — commodities/metales |
| LU1578889864 | HOLD — commodities/metales |

Fuente: `BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0` (commit `11d18e9`)
