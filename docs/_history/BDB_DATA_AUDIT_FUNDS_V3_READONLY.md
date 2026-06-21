# BDB-DATA-AUDIT-0 — Auditoría Read-Only de funds_v3

**Fecha**: 2026-05-07  
**Proyecto**: `C:\Users\oanti\Documents\BDB-FONDOS` (legacy)  
**Colección**: `funds_v3`  
**Modo**: READ-ONLY — cero escrituras Firestore realizadas  
**BDB-FONDOS-CORE**: No tocado, no leído  

---

## Resumen Ejecutivo

Se auditaron **670 documentos** de la colección real `funds_v3`. La colección presenta una cobertura estructural alta: todos los fondos tienen `classification_v2`, `portfolio_exposure_v2`, `ms`, `derived` y `manual`. Sin embargo, se detectaron **3 categorías de hallazgo relevante** que requieren atención:

1. **220 fondos sin `asset_mix`** — tienen `economic_exposure` (0-100) pero no `asset_mix` (0-1).
2. **75 fondos con retrocesión > 1.0** — posible escala porcentual en vez de decimal.
3. **16 fondos EQUITY con 0% equity en `economic_exposure`** — fondos sectoriales de minería/oro/recursos naturales.

| Severidad | Count | Descripción |
|-----------|-------|-------------|
| BLOCKER | 0 | Ninguno tras reclasificación (ver §3) |
| HIGH | 16 | Fondos EQUITY con 0% equity + 220 fondos sin asset_mix |
| MEDIUM | 86 | Retrocesiones fuera de rango + derived stale |
| LOW | 0 | — |

---

## 1. Cobertura Estructural

| Campo | Presencia | % |
|-------|-----------|---|
| `classification_v2` | 670/670 | 100% |
| `portfolio_exposure_v2` | 670/670 | 100% |
| ↳ `asset_mix` | 450/670 | 67.2% |
| ↳ `economic_exposure` | 670/670 | 100% |
| ↳ Ambos (`asset_mix` + `economic_exposure`) | 450/670 | 67.2% |
| ↳ Solo `economic_exposure` (sin `asset_mix`) | 220/670 | 32.8% |
| `ms` (Morningstar) | 670/670 | 100% |
| `derived` | 670/670 | 100% |
| `manual` | 670/670 | 100% |
| `cv2.asset_type` vacío/unknown | 0/670 | 0% |

> [!NOTE]
> La cobertura V2 es completa. No existen fondos sin `classification_v2` ni sin `portfolio_exposure_v2`. El campo `ms.name` no existe en la estructura actual; los nombres se almacenan en `name` (root) o `cv2.raw_name`.

---

## 2. Análisis de Escalas: asset_mix vs economic_exposure

### Hallazgo Crítico

La colección utiliza **dos mapas de exposición con escalas diferentes por diseño**:

| Campo | Escala | Fondos | Ejemplo |
|-------|--------|--------|---------|
| `pev2.asset_mix` | **0–1** (fraccional) | 450 | `{equity: 0.998, bond: 0, cash: 0.002, other: 0}` |
| `pev2.economic_exposure` | **0–100** (porcentual) | 670 | `{equity: 100, bond: 0, cash: 0, other: 0}` |

### ¿Es un BLOCKER para el optimizador?

**NO.** El backend Python maneja esta diferencia de forma transparente a través de la función `_as_fraction()` en `utils.py:144-148`:

```python
def _as_fraction(value, default=0.0):
    val = _to_float(value, default)
    if abs(val) > 1.5:
        val = val / 100.0       # Auto-convierte 0-100 → 0-1
    return max(0.0, min(1.0, val))
```

La función `get_v2_asset_mix()` (línea 255) usa `_as_fraction()` para cada componente, unificando ambas escalas a 0-1 antes de que el optimizador las consuma. **Las dos escalas son un patrón intencional, no un bug.**

### Riesgo residual

> [!WARNING]
> Valores entre 1.0 y 1.5 caerían en una **zona ambigua** donde `_as_fraction` los trataría como fracción (no dividiría por 100). En los datos actuales no existen valores en ese rango, pero cualquier futura ingesta debe controlar este borde.

### 220 fondos sin `asset_mix`

Estos fondos tienen `economic_exposure` (0-100) pero no `asset_mix` (0-1). La función `get_v2_asset_mix()` hace fallback automático a `economic_exposure` (línea 262: `mix.get("equity", econ.get("equity", 0.0))`), por lo que el optimizador puede usarlos. Sin embargo, para consistencia, estos fondos deberían tener `asset_mix` generado.

---

## 3. Clasificación vs Exposición — 16 fondos EQUITY con 0% equity

| ISIN | Nombre | Tipo |
|------|--------|------|
| IE00BYVJR916 | Jupiter Gold & Silver Fund | Minería/Oro |
| LU0090845842 | BlackRock World Mining Fund E2 | Minería |
| LU0171306680 | BlackRock World Gold Fund E2 | Oro |
| LU0172157280 | BlackRock World Mining Fund A2 | Minería |
| LU0172157363 | BlackRock World Mining Fund E2 EUR | Minería |
| LU0208853944 | JPMorgan Global Natural Resources | Recursos Naturales |
| LU0273148055 | DWS Invest Gold and Precious Metals NC | Oro |
| LU0273159177 | DWS Invest Gold and Precious Metals LC | Oro |
| LU0300741732 | Franklin Natural Resources | Recursos Naturales |
| LU0326425351 | BlackRock World Mining E2 EUR Hedged | Minería |
| LU0496368142 | Franklin Gold & Precious Metals H1 | Oro |
| LU0496369389 | Franklin Gold & Precious Metals N | Oro |
| LU0604766674 | Allianz Global Metals and Mining AT | Minería |
| LU1223083087 | Schroder Global Gold A EUR Hedged | Oro |
| LU1223084051 | Schroder Global Gold A PLN Hedged | Oro |
| LU1578889864 | Ninety One Global Gold Fund A EUR | Oro |

> [!IMPORTANT]
> Estos fondos invierten en **acciones de empresas mineras/oro**, pero su `economic_exposure` registra `equity=0%` y posiblemente `other=100%`. Esto es un **gap semántico real**: Morningstar clasifica el activo subyacente (oro/materias primas) en lugar de la envoltura (acciones de compañías mineras). El impacto para el optimizador es que estos fondos no contribuyen exposición equity en las restricciones de bucket, lo cual puede distorsionar las asignaciones por perfil de riesgo.

---

## 4. Retrocesiones — 75 fondos fuera de rango

| Métrica | Valor |
|---------|-------|
| Total fondos con retrocesión | 670 |
| Retrocesión = 0 | 430 |
| Retrocesión > 0 | 240 |
| Retrocesión > 1.0 (fuera de rango) | 75 |

Los 75 fondos con retrocesión > 1.0 probablemente almacenan el valor en **escala porcentual** (ej: `1.41` = 1.41%) en vez de **decimal** (ej: `0.0141`). Ejemplos:

| ISIN | Nombre | Retrocesión |
|------|--------|-------------|
| ES0138217031 | Gesconsult Renta Fija Flexible A | 1.41 |
| ES0138936036 | Fondibas FI | 1.72 |
| ES0138914033 | Merch-Fontemar FI | 1.22 |
| LU0172157363 | BlackRock World Mining Fund E2 EUR | (ref. señalado como conflicto conocido) |

> [!NOTE]
> Si el frontend/backend interpreta retrocesión como decimal (0–1), estos valores producirían cálculos de costes incorrectos. Si se interpreta como porcentaje directo (0–100), entonces los fondos con retrocesión `0.3` serían `0.3%`, lo cual es coherente. **Requiere verificación de cómo el frontend consume este campo.**

---

## 5. Derived Fields — 11 fondos con campos obsoletos

11 fondos tienen `derived.asset_class` desalineado con `classification_v2.asset_type`. Todos son renombramientos de la misma clasificación:

| Patrón | Count |
|--------|-------|
| `"Inmobiliario"` vs `"REAL_ESTATE"/"real_asset"` | 4 |
| `"Monetario"` vs `"MONETARY"` | 4 |
| `"Otros"` vs `"EQUITY"` (SICAVs mal clasificadas legacy) | 2 |
| `"RF"` vs `"CONVERTIBLE"` | 1 |

Impacto: **bajo**. El optimizador usa `classification_v2`, no `derived.asset_class`. Estos campos stale son ruido de UI/filtros heredados.

---

## 6. Impacto sobre el Optimizador

| Riesgo | Severidad | Afecta? | Mitigación |
|--------|-----------|---------|------------|
| Escala mixta asset_mix/eco_expo | Reclasificado | NO | `_as_fraction()` normaliza automáticamente |
| 220 fondos sin asset_mix | MEDIUM | Parcial | Fallback a `economic_exposure` funciona |
| 16 fondos EQUITY equity=0% | HIGH | SÍ | Distorsiona bucket bounds en perfiles con restricciones equity |
| Retrocesiones > 1.0 | MEDIUM | Depende | Si se usa en cálculo de costes, produce valores incorrectos |
| Derived stale | LOW | NO | Optimizador no lee `derived.asset_class` |

---

## 7. Impacto sobre el Parser/Frontend

| Riesgo | Componente | Impacto |
|--------|------------|---------|
| `ms.name` no existe | Frontend | Usa `name` (root) o `cv2.raw_name`; sin impacto |
| Derived stale | Filtros UI | Los fondos "Inmobiliarios" pueden no aparecer correctamente en filtros si se basan en `derived` |
| Retrocesiones > 1.0 | Costes UI | Si se interpreta como decimal, muestra 141% de retrocesión |

---

## 8. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `artifacts/bdb_data_audit/funds_v3_data_audit_readonly.json` | 670 fondos × todas las issues (JSON completo) |
| `artifacts/bdb_data_audit/funds_v3_data_audit_summary.csv` | CSV con 670 filas y 27 columnas per-fund |

---

## 9. Recomendación Final

### Veredicto: `DATA_OK_WITH_WARNINGS`

La base de datos está en un estado operativo funcional. El optimizador puede consumir los datos correctamente gracias a las capas de normalización en `utils.py`. Sin embargo, se recomienda abordar:

1. **HIGH — 16 fondos minería/oro**: Decidir si `economic_exposure` debe reflejar la envoltura (equity) o el subyacente (commodity). Si se decide equity, corregir exposure a `{equity: 100}`.
2. **MEDIUM — 75 retrocesiones > 1.0**: Confirmar si la escala es porcentual (%) o decimal (fracción). Unificar.
3. **MEDIUM — 220 fondos sin asset_mix**: Generar `asset_mix` normalizado a partir de `economic_exposure` para consistencia.
4. **LOW — 11 derived stale**: Actualizar `derived.asset_class` para que coincida con `cv2.asset_type`.

**No se requiere corrección urgente para mantener la producción estable.** Las medidas defensivas del P0 (missing exposure guard, negative weight cleanup) protegen los casos borde detectados.
