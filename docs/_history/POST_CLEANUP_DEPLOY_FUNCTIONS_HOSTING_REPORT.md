# Deploy Report — Functions + Hosting (Sin Rules)

**Fecha:** 2026-05-04  
**Proyecto:** `bdb-fondos`  
**Hosting URL:** https://bdb-fondos.web.app

---

## Resultado del Deploy

| Servicio | Estado | Detalle |
|---|---|---|
| **Functions** | ✅ ÉXITO | 17/17 funciones actualizadas |
| **Hosting** | ✅ ÉXITO | 20 archivos, 15 nuevos subidos |
| **Firestore Rules** | ❌ NO DESPLEGADO | Pendiente validación manual |

---

## Functions Desplegadas (17)

| # | Función | Región | Estado |
|---|---|---|---|
| 1 | `analyze_portfolio_endpoint` | europe-west1 | ✅ |
| 2 | `force_weekly_research` | europe-west1 | ✅ |
| 3 | `getRiskRate` | europe-west1 | ✅ |
| 4 | `insertMonthlyReport` | europe-west1 | ✅ |
| 5 | `refresh_daily_metrics` | europe-west1 | ✅ |
| 6 | `restore_historico` | europe-west1 | ✅ |
| 7 | `runDailyDataValidation` | europe-west1 | ✅ |
| 8 | `runMasterDailyRoutine` | europe-west1 | ✅ |
| 9 | `scheduleWeeklyResearch` | europe-west1 | ✅ |
| 10 | `updateFundHistory` | europe-west1 | ✅ |
| 11 | `backtest_portfolio` | europe-west1 | ✅ |
| 12 | `backtest_portfolio_multi` | europe-west1 | ✅ |
| 13 | `compare_risk_free` | europe-west1 | ✅ |
| 14 | `generate_analysis_report` | europe-west1 | ✅ |
| 15 | `getEfficientFrontier` | europe-west1 | ✅ |
| 16 | `optimize_portfolio_quant` | europe-west1 | ✅ |
| 17 | `get_economic_calendar` | us-central1 | ✅ |

---

## Confirmaciones

- ✅ **Firestore rules NO desplegado.**
- ✅ No se modificó código.
- ✅ No se tocaron credenciales.
- ✅ No se ejecutaron scripts mutantes.

---

## Siguiente Paso: Validación Manual

### Pruebas a realizar en https://bdb-fondos.web.app:

| # | Prueba | Qué verificar |
|---|---|---|
| 1 | Login | Email/password funciona |
| 2 | Dashboard | Fondos se cargan (funds_v3) |
| 3 | Históricos | Gráficos NAV (historico_vl_v2) |
| 4 | MiBoutique | Análisis (analysis_results) |
| 5 | Benchmarks | Perfiles sintéticos (synthetic_benchmarks) |
| 6 | Reports | Informes semanales (reports) |
| 7 | XRay Comparador | Upload + cálculo + PDF |
| 8 | Jubilación | Calculadora fiscal Bizkaia 2026 |

### Si todas pasan → Desplegar rules:
```
firebase deploy --only firestore:rules
```

### Si alguna falla → NO desplegar rules. Debuggear primero.
