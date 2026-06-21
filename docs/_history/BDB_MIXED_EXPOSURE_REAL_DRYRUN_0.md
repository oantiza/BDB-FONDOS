# BDB-MIXED-EXPOSURE-REAL-DRYRUN-0

**Fecha:** 2026-05-10  
**HEAD:** `1ed2447`  
**Estado:** Dry-run ejecutado contra produccion, artifact generado  
**Datos:** Lectura directa de Firestore `funds_v3` (read-only)

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **NO**
- Deploy ejecutado: **NO**
- populate_taxonomy_v2.py --execute: **NO**
- Codigo modificado: **NO**
- Commit/push: **NO**
- Solo lectura de `funds_v3` via query `classification_v2.asset_type == "MIXED"`

---

## 1. Comando Ejecutado

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "c:\Users\oanti\Documents\BDB-FONDOS\serviceAccountKey.json"
.\functions_python\venv\Scripts\python.exe scripts\maintenance\bdb_mixed_exposure_fix_dry_run.py
```

## 2. Artifact Generado

**Ruta:** `artifacts/bdb_mixed_exposure_fix/mixed_exposure_fix_dry_run.json`  
**Tamano:** ~59 KB, 2060 lineas  
**Contenido:** 60 fondos MIXED analizados con before/after por ISIN

## 3. Resumen Global

| Metrica | Valor |
|---------|-------|
| Total MIXED en produccion | **60** |
| Usando metrics (top-level) | 0 |
| Usando ms.portfolio.asset_allocation | **59** |
| Usando fallback (sin datos MS) | 1 |
| Write recomendado | **59** |
| Review requerido (delta equity > 10pp) | **29** |

> **Hallazgo clave:** Son 60 fondos MIXED, no 20 como estimaba el audit previo (que solo tenia una muestra parcial). Los 60 fondos tienen `ms.portfolio.asset_allocation` excepto 1 (LU3038481936).

## 4. Top 10 Cambios Mas Relevantes (por |delta_equity|)

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | Delta Eq | Source |
|---|------|--------|---------|--------|--------|----------|--------|
| 1 | LU1594335520 | Allianz Dynamic Multi Asset SRI 75 | AGGRESSIVE | 80.0 | 0.0 | **-80.0** | ms_portfolio |
| 2 | ES0116848005 | Global Allocation R FI | FLEXIBLE | 50.0 | 0.0 | **-50.0** | ms_portfolio |
| 3 | LU0251119078 | Fidelity Target 2035 | FLEXIBLE | 50.0 | 98.8 | **+48.8** | ms_portfolio |
| 4 | LU1899019175 | Sigma Smart Horizon | FLEXIBLE | 50.0 | 96.1 | **+46.1** | ms_portfolio |
| 5 | ES0162305033 | Merch-Oportunidades FI | FLEXIBLE | 50.0 | 93.3 | **+43.3** | ms_portfolio |
| 6 | ES0131462022 | Gestion Boutique V Robotics R FI | FLEXIBLE | 50.0 | 89.7 | **+39.7** | ms_portfolio |
| 7 | ES0110407006 | Gestion Boutique VI Argos FI | FLEXIBLE | 50.0 | 87.8 | **+37.8** | ms_portfolio |
| 8 | LU1697018064 | Sigma Best Morgan Stanley | FLEXIBLE | 50.0 | 86.6 | **+36.6** | ms_portfolio |
| 9 | ES0114904008 | Brightgate Focus A FI | FLEXIBLE | 50.0 | 85.6 | **+35.6** | ms_portfolio |
| 10 | LU1899018870 | Sigma Best M&G | FLEXIBLE | 50.0 | 14.8 | **-35.2** | ms_portfolio |

## 5. Casos que Requieren Atencion Especial

### 5.1 Allianz Dynamic Multi Asset SRI 75 (LU1594335520)

- **Old:** equity=80, bond=20 (AGGRESSIVE fallback)
- **MS data:** equity=0, bond=99.59, cash=0.41
- **Interpretacion:** Morningstar muestra 100% renta fija. Esto podria indicar que el fondo cambio de estrategia, o que el reporte MS captura una posicion temporal defensiva. **Requiere revision manual.**

### 5.2 Global Allocation R FI (ES0116848005)

- **Old:** equity=50, bond=50 (FLEXIBLE fallback)
- **MS data:** equity=0, bond=100
- **Interpretacion:** Similar al anterior — posicion totalmente en RF segun MS.

### 5.3 Allianz Strategy 75 CT (LU0352312853)

- **MS data:** equity=100, bond=70.81, sum=170.81
- **Interpretacion:** Suma > 100% indica posiciones apalancadas o short. La normalizacion a 100% produce eq=58.5, bd=41.5. Coherente como aproximacion.

### 5.4 Carmignac Patrimoine (FR0010306142)

- **MS data:** equity=41.17, bond=0, cash=100, sum=141.26
- **Interpretacion:** Cash=100% sugiere posiciones sinteticas via derivados. Normalizacion produce eq=29.1, cash=70.8.

## 6. Tabla Completa por ISIN

| ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | Old Bd | New Bd | d_Bd | Source | Review |
|------|--------|---------|--------|--------|------|--------|--------|------|--------|--------|
| DE0005318406 | DWS ESG Stiftungsfonds | CONSERVATIVE | 20.0 | 25.2 | +5.2 | 80.0 | 70.5 | -9.5 | ms | no |
| DE000A0X7541 | Acatis Value Event | FLEXIBLE | 50.0 | 63.9 | +13.9 | 50.0 | 19.6 | -30.4 | ms | yes |
| DE000DWS17J0 | DWS ESG Dynamic Opportunities | AGGRESSIVE | 80.0 | 68.8 | -11.2 | 20.0 | 18.8 | -1.2 | ms | yes |
| ES0110407006 | GB VI Argos FI | FLEXIBLE | 50.0 | 87.8 | +37.8 | 50.0 | 4.5 | -45.5 | ms | yes |
| ES0114904008 | Brightgate Focus A FI | FLEXIBLE | 50.0 | 85.6 | +35.6 | 50.0 | 0.0 | -50.0 | ms | yes |
| ES0116567035 | Cartesio X FI | CONSERVATIVE | 20.0 | 23.3 | +3.3 | 80.0 | 76.7 | -3.3 | ms | no |
| ES0116848005 | Global Allocation R FI | FLEXIBLE | 50.0 | 0.0 | -50.0 | 50.0 | 100.0 | +50.0 | ms | yes |
| ES0118537002 | Olea Neutral FI | MODERATE | 50.0 | 15.5 | -34.5 | 50.0 | 64.9 | +14.9 | ms | yes |
| ES0128067008 | Imantia Mixto FI | FLEXIBLE | 50.0 | 50.9 | +0.9 | 50.0 | 39.4 | -10.6 | ms | no |
| ES0131462022 | GB V Robotics R FI | FLEXIBLE | 50.0 | 89.7 | +39.7 | 50.0 | 0.0 | -50.0 | ms | yes |
| ES0138930005 | Fonvalcem B FI | AGGRESSIVE | 80.0 | 91.8 | +11.8 | 20.0 | 0.0 | -20.0 | ms | yes |
| ES0142046038 | Renta 4 Nexus FI | FLEXIBLE | 50.0 | 58.8 | +8.8 | 50.0 | 27.7 | -22.3 | ms | no |
| ES0148181003 | DWS Concept DJE Alpha Renten | AGGRESSIVE | 80.0 | 74.8 | -5.2 | 20.0 | 0.0 | -20.0 | ms | no |
| ES0162305033 | Merch-Oportunidades FI | FLEXIBLE | 50.0 | 93.3 | +43.3 | 50.0 | 0.0 | -50.0 | ms | yes |
| ES0162946034 | Avantage Fund A FI | FLEXIBLE | 50.0 | 41.2 | -8.8 | 50.0 | 45.4 | -4.6 | ms | no |
| ES0162949012 | Avantage Fund B FI | FLEXIBLE | 50.0 | 47.3 | -2.7 | 50.0 | 41.0 | -9.0 | ms | no |
| ES0173323009 | Rural Mixto Internacional 50 | FLEXIBLE | 50.0 | 46.3 | -3.7 | 50.0 | 38.1 | -11.9 | ms | no |
| ES0175604034 | Unifond Moderado A FI | FLEXIBLE | 50.0 | 45.4 | -4.6 | 50.0 | 34.6 | -15.4 | ms | no |
| FR0010041822 | Tikehau 2027 R Acc | CONSERVATIVE | 20.0 | 17.7 | -2.3 | 80.0 | 79.5 | -0.5 | ms | no |
| FR0010306142 | Carmignac Patrimoine E | MODERATE | 50.0 | 29.1 | -20.9 | 50.0 | 0.0 | -50.0 | ms | yes |
| FR0013219243 | EdR Equity Euro Solve | FLEXIBLE | 50.0 | 75.0 | +25.0 | 50.0 | 0.0 | -50.0 | ms | yes |
| IE00BYYPF474 | (IE fund) | FLEXIBLE | 50.0 | 50.8 | +0.8 | 50.0 | 41.3 | -8.7 | ms | no |
| LU0048293368 | BL-Global 75 B | AGGRESSIVE | 80.0 | 59.1 | -20.9 | 20.0 | 8.2 | -11.8 | ms | yes |
| LU0093503737 | DWS Invest Top Dividend | FLEXIBLE | 50.0 | 51.2 | +1.2 | 50.0 | 35.3 | -14.7 | ms | no |
| LU0119195963 | MSIF Global Balanced | FLEXIBLE | 50.0 | 38.7 | -11.3 | 50.0 | 54.2 | +4.2 | ms | yes |
| LU0121216526 | GS Patrimonial Aggressive | AGGRESSIVE | 80.0 | 56.5 | -23.5 | 20.0 | 23.9 | +3.9 | ms | yes |
| LU0171283459 | Janus Henderson Balanced | FLEXIBLE | 50.0 | 55.8 | +5.8 | 50.0 | 37.0 | -13.0 | ms | no |
| LU0251119078 | Fidelity Target 2035 | FLEXIBLE | 50.0 | 98.8 | +48.8 | 50.0 | 0.1 | -49.9 | ms | yes |
| LU0251131362 | Fidelity Target 2020 | FLEXIBLE | 50.0 | 44.8 | -5.2 | 50.0 | 53.3 | +3.3 | ms | no |
| LU0284394821 | DNCA Evolutif B | FLEXIBLE | 50.0 | 71.5 | +21.5 | 50.0 | 28.5 | -21.5 | ms | yes |
| LU0352312184 | Allianz Strategy 50 | FLEXIBLE | 50.0 | 47.7 | -2.3 | 50.0 | 52.3 | +2.3 | ms | no |
| LU0352312853 | Allianz Strategy 75 | AGGRESSIVE | 80.0 | 58.5 | -21.5 | 20.0 | 41.5 | +21.5 | ms | yes |
| LU0404220724 | Pictet Multi Asset Global | FLEXIBLE | 50.0 | 44.4 | -5.6 | 50.0 | 31.9 | -18.1 | ms | no |
| LU0512121004 | Carmignac Securite | CONSERVATIVE | 20.0 | 19.1 | -0.9 | 80.0 | 80.9 | +0.9 | ms | no |
| LU0565136552 | Threadneedle Dynamic Real Ret | AGGRESSIVE | 80.0 | 80.5 | +0.5 | 20.0 | 3.2 | -16.8 | ms | no |
| LU1245470593 | Amundi Funds Multi Asset Sust | CONSERVATIVE | 20.0 | 24.6 | +4.6 | 80.0 | 65.3 | -14.7 | ms | no |
| LU1276000236 | MFS Prudent Wealth | CONSERVATIVE | 20.0 | 17.5 | -2.5 | 80.0 | 27.5 | -52.5 | ms | no |
| LU1298174530 | NN Patrimonial Balanced | FLEXIBLE | 50.0 | 52.5 | +2.5 | 50.0 | 42.2 | -7.8 | ms | no |
| LU1304666057 | NN Patrimonial Aggressive | AGGRESSIVE | 80.0 | 81.2 | +1.2 | 20.0 | 13.9 | -6.1 | ms | no |
| LU1548496022 | Amundi Target Coupon | CONSERVATIVE | 20.0 | 30.9 | +10.9 | 80.0 | 60.8 | -19.2 | ms | yes |
| LU1594335520 | Allianz Dynamic MA SRI 75 | AGGRESSIVE | 80.0 | 0.0 | -80.0 | 20.0 | 99.6 | +79.6 | ms | yes |
| LU1697016365 | Sigma Selection Defensive | CONSERVATIVE | 20.0 | 0.1 | -19.9 | 80.0 | 92.5 | +12.5 | ms | yes |
| LU1697017256 | Sigma Selection Balanced | FLEXIBLE | 50.0 | 41.9 | -8.1 | 50.0 | 49.2 | -0.8 | ms | no |
| LU1697018064 | Sigma Best Morgan Stanley | FLEXIBLE | 50.0 | 86.6 | +36.6 | 50.0 | 6.9 | -43.1 | ms | yes |
| LU1697018494 | Sigma Selection Dynamic | FLEXIBLE | 50.0 | 59.6 | +9.6 | 50.0 | 33.1 | -16.9 | ms | no |
| LU1740985814 | JPM Global Income | AGGRESSIVE | 80.0 | 78.7 | -1.3 | 20.0 | 0.0 | -20.0 | ms | no |
| LU1868537090 | M&G Dynamic Allocation | AGGRESSIVE | 80.0 | 69.0 | -11.0 | 20.0 | 15.2 | -4.8 | ms | yes |
| LU1882475392 | BNP Paribas Sust Multi-Asset | CONSERVATIVE | 20.0 | 29.8 | +9.8 | 80.0 | 56.3 | -23.7 | ms | no |
| LU1883327816 | Sigma Selection Balanced II | FLEXIBLE | 50.0 | 51.1 | +1.1 | 50.0 | 40.4 | -9.6 | ms | no |
| LU1883330521 | Sigma Selection Conservative | CONSERVATIVE | 20.0 | 31.7 | +11.7 | 80.0 | 55.5 | -24.5 | ms | yes |
| LU1883340322 | Sigma Selection Dynamic II | FLEXIBLE | 50.0 | 61.6 | +11.6 | 50.0 | 30.3 | -19.7 | ms | yes |
| LU1894680757 | Amundi Income Opportunities | MODERATE | 50.0 | 30.3 | -19.7 | 50.0 | 37.3 | -12.7 | ms | yes |
| LU1899018870 | Sigma Best M&G | FLEXIBLE | 50.0 | 14.8 | -35.2 | 50.0 | 74.1 | +24.1 | ms | yes |
| LU1899018953 | Sigma Best Invesco | FLEXIBLE | 50.0 | 43.6 | -6.4 | 50.0 | 36.7 | -13.3 | ms | no |
| LU1899019175 | Sigma Smart Horizon | FLEXIBLE | 50.0 | 96.1 | +46.1 | 50.0 | 1.7 | -48.3 | ms | yes |
| LU1961009468 | Sigma Selection Balanced III | FLEXIBLE | 50.0 | 51.1 | +1.1 | 50.0 | 41.6 | -8.4 | ms | no |
| LU2050544563 | DWS ESG Multi Asset Dynamic | FLEXIBLE | 50.0 | 76.1 | +26.1 | 50.0 | 17.9 | -32.1 | ms | yes |
| LU2278574715 | NN Patrimonial BEST Balanced | FLEXIBLE | 50.0 | 40.0 | -10.0 | 50.0 | 51.8 | +1.8 | ms | yes |
| LU3038481936 | (nuevo fondo) | AGGRESSIVE | 80.0 | 80.0 | 0.0 | 20.0 | 20.0 | 0.0 | fallback | no |

## 7. Distribucion por Subtype

| Subtype | Count | Avg |delta_eq| |
|---------|-------|-----------------|
| FLEXIBLE_ALLOCATION | 34 | 17.5 pp |
| AGGRESSIVE_ALLOCATION | 12 | 17.4 pp |
| CONSERVATIVE_ALLOCATION | 10 | 7.3 pp |
| MODERATE_ALLOCATION | 4 | 22.6 pp |

## 8. Distribucion de Confidence

| Confidence Before | Count |
|-------------------|-------|
| 0.45 | 60 |

Todos los fondos MIXED tenian `exposure_confidence = 0.45` (el valor por defecto cuando no hay metrics). Despues del fix pasaran a `0.85` (ms_portfolio) excepto LU3038481936 que se queda en `0.55` (fallback).

## 9. Recomendacion de Primer Lote Controlado

### Lote 1 — Bajo riesgo (31 fondos, |delta_eq| < 10 pp)

Fondos donde la exposicion Morningstar es similar al fallback actual. Impacto minimo en el solver. Ejecutar primero.

### Lote 2 — Revision requerida (29 fondos, |delta_eq| >= 10 pp)

Fondos donde el delta es significativo. Requieren revision manual antes del write:
- Verificar que la exposicion Morningstar es actual (no de un reporte antiguo)
- Verificar coherencia con la estrategia declarada del fondo
- Casos extremos (LU1594335520: eq 80->0, ES0116848005: eq 50->0) requieren atencion especial

### Write Gate Propuesto

```python
# Para cada fondo en el lote:
# 1. Re-leer doc actual de Firestore
# 2. Verificar que economic_exposure sigue siendo fallback
# 3. Verificar que ms.portfolio.asset_allocation sigue disponible
# 4. Verificar que delta es coherente con dry-run
# 5. Aplicar update solo si todos los guards pasan
# 6. Guardar snapshot antes del write para rollback
```

## 10. Siguiente Paso

1. **Revision humana** de los 29 fondos con review_required=true
2. **Ejecutar write Lote 1** (31 fondos con delta < 10 pp)
3. **Validar** X-Ray de portfolios P1-P10 post-write
4. **Ejecutar write Lote 2** tras aprobacion individual
5. **Re-ejecutar** `populate_taxonomy_v2.py --dry-run` para confirmar que el fix del script produce datos coherentes con el patch
