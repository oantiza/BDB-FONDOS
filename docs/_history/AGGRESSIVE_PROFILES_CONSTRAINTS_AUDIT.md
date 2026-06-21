# Auditoría: Constraints de Perfiles Agresivos (8, 9, 10)

**Fecha:** 2026-05-04  
**Estado:** Solo análisis, sin cambios.

---

## 1. Tabla Comparativa de Constraints

### 1.1 Risk Buckets (% del portfolio)

| Bucket | P7 | P8 | P9 | P10 |
|---|---|---|---|---|
| **RV min** | 0.70 | **0.85** | **0.95** | **0.95** |
| **RV max** | 0.90 | 1.00 | 1.00 | 1.00 |
| RF max | 0.20 | 0.05 | 0.05 | 0.05 |
| Mixto max | 0.20 | 0.10 | 0.05 | 0.05 |
| Monetario max | 0.05 | 0.05 | **0.00** | 0.05 |
| Alternativos max | 0.15 | 0.10 | 0.05 | 0.05 |
| Otros max | 0.20 | 0.15 | 0.05 | **0.00** |

### 1.2 Target Volatility (efficient_risk)

| Perfil | target_vol | vol_band | Interpretación |
|---|---|---|---|
| 7 | 15.5% | ±2% | Alcanzable con RV 70-90% |
| **8** | **18.5%** | ±2% | Muy alto, difícil con max_weight 20% |
| **9** | **22.5%** | ±2% | Extremo para fondos diversificados |
| **10** | **30.0%** | ±2% | Prácticamente inalcanzable |

### 1.3 Solver Parameters (constantes para todos)

| Parámetro | Valor | Impacto en P8-10 |
|---|---|---|
| `max_weight` | **0.20** | Con 14 fondos: máximo 5 fondos a 20% = 100% |
| `min_weight` | 0.00 | Sin impacto |
| `cutoff` | 0.02 | Limpieza post-solver |
| `objective` | `efficient_risk` | Exige vol exacta = target_vol |
| L2 gamma | 2.0 (14 activos) | Penaliza concentración |

---

## 2. Análisis de Factibilidad Matemática

### 2.1 ¿Qué hace `efficient_risk(target_vol)`?

`pypfopt.EfficientFrontier.efficient_risk(target_volatility)` busca el portfolio con **máximo retorno sujeto a que la volatilidad del portfolio sea ≤ target_vol**.

**Problema:** Si la volatilidad mínima posible del portfolio (dado las constraints) es **mayor** que target_vol, el problema es infeasible. Si la volatilidad mínima es **menor** pero la restricción RV>=95% empuja la vol por encima de target, también es infeasible.

### 2.2 Perfil 9: Análisis Detallado

```
Constraints simultáneas:
  1. w @ eq_vec >= 0.95        (95% en renta variable)
  2. w @ bd_vec <= 0.05        (máx 5% en renta fija)
  3. w[i] <= 0.20              (máx 20% por fondo)
  4. sum(w) == 1.0
  5. portfolio_vol <= 0.225    (target vol 22.5%)
  6. L2 regularización         (penaliza concentración)
```

**Volatilidad típica de fondos de equity:** 12-22% individual.
**Correlación entre fondos equity:** 0.60-0.85 típica.
**Vol mínima de un portfolio 95% equity con 14 fondos diversificados:** ~12-16%.
**Vol máxima alcanzable con max_weight 0.20:** ~18-20% (por diversificación forzada).

> **Hallazgo:** target_vol=22.5% es **probablemente alcanzable solo concentrando** en fondos muy volátiles. Pero `max_weight=0.20` + L2 regularización impiden esa concentración. El solver no puede simultáneamente diversificar (L2+max_weight) y tener volatilidad alta (target_vol=22.5%).

### 2.3 Perfil 10: target_vol=30%

30% de volatilidad es extremo. Corresponde a un fondo individual de small-caps o emergentes. Un portfolio diversificado de 14 fondos con max_weight=20% **nunca alcanzará 30% de vol anualizada**. Es matemáticamente imposible con correlaciones normales.

### 2.4 Perfil 8: target_vol=18.5%

18.5% es marginalmente alcanzable. Con una cartera dominada por equity de alta vol (tech, emergentes), podría funcionar. Pero con fondos mixtos o value, el solver falla.

---

## 3. Resumen de Problemas

| # | Problema | Perfiles | Severidad |
|---|---|---|---|
| 1 | **target_vol inalcanzable con diversificación forzada** | 9, 10 | 🔴 Crítico |
| 2 | **RV>=95% + max_weight=20% reduce vol máxima a ~18-20%** | 9, 10 | 🔴 Crítico |
| 3 | **target_vol=30% imposible para cualquier portfolio diversificado** | 10 | 🔴 Imposible |
| 4 | **Monetario max=0.00 en P9 impide cualquier cash** | 9 | 🟡 Menor |
| 5 | **Otros max=0.00 en P10 exclye fondos no clasificados** | 10 | 🟡 Menor |
| 6 | **Mixto no tiene vector en el solver** (ignorado) | Todos | 🟡 Inconsistencia |
| 7 | **efficient_risk exige vol exacta, no banda** | 8, 9, 10 | 🟡 Diseño |

---

## 4. Propuestas Concretas

### Opción A: Cambiar objective de `efficient_risk` a `max_sharpe` para P8-10 ⭐ Recomendada

**Razonamiento:** Para perfiles agresivos, el usuario quiere máximo retorno, no una vol específica. `max_sharpe` maximiza retorno/riesgo respetando todas las constraints de bucket (RV>=85/95%) sin exigir una vol imposible.

**Cambio:** En `constraints_builder_v1.py`, cuando `profile_id >= 8`, forzar `objective = "max_sharpe"`.

**Riesgo:** Bajo. El resultado cumple las bandas de RV/RF del perfil pero con la vol natural del portfolio.

**Ventaja:** Elimina la causa raíz de infeasibility para P8-10 sin tocar constraints.

---

### Opción B: Relajar target_vol para P8-10

| Perfil | Actual | Propuesta | Razonamiento |
|---|---|---|---|
| 8 | 0.185 | 0.165 | Alcanzable con equity >85% diversificado |
| 9 | 0.225 | 0.185 | Alineado con vol real de portfolio 95% equity |
| 10 | 0.300 | 0.200 | Máximo razonable con max_weight=20% |

**Riesgo:** Medio. Cambia la política de riesgo. El perfil 10 nunca tendrá 30% de vol sin concentración extrema.

---

### Opción C: Relajar RV mínima

| Perfil | Actual | Propuesta |
|---|---|---|
| 8 | 0.85 | 0.80 |
| 9 | 0.95 | 0.85 |
| 10 | 0.95 | 0.90 |

**Riesgo:** Alto. Cambia la definición del perfil agresivo. Un perfil 9 con 85% RV es esencialmente un perfil 8.

---

### Opción D: Aumentar max_weight para P8-10

| Perfil | Actual | Propuesta |
|---|---|---|
| 8 | 0.20 | 0.25 |
| 9 | 0.20 | 0.30 |
| 10 | 0.20 | 0.35 |

**Riesgo:** Medio. Permite concentración pero aumenta el riesgo idiosincrático. Un fondo al 35% es peligroso.

---

### Opción E: Usar vol_band en vez de vol exacta

Cambiar `ef.efficient_risk(target_vol)` por un mecanismo que acepte `vol_band.min` y `vol_band.max` como constraints en vez de target exacto, y optimizar retorno dentro de la banda.

**Riesgo:** Medio-alto. Requiere cambiar la lógica del solver. `pypfopt` no soporta vol-band nativo.

---

## 5. Recomendación Final

### Implementar Opción A + ajuste menor de B

1. **Para P8, P9, P10:** Cambiar objective a `max_sharpe` en vez de `efficient_risk`.
   - Mantiene todas las constraints de bucket (RV>=85/95%, RF<=5%, etc.)
   - Elimina la exigencia de vol exacta que es la causa de infeasibility.
   - El resultado es el portfolio con mejor Sharpe ratio dentro de las bandas del perfil.

2. **Opcionalmente:** Ajustar target_vol a valores realistas como referencia informativa (no usada por el solver en modo max_sharpe), para que el frontend pueda mostrar la vol objetivo esperada.

### Prompt para ejecutar (no ejecutar todavía):

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Cambiar objective de efficient_risk a max_sharpe para perfiles 8, 9 y 10.

ARCHIVO:
functions_python/services/portfolio/constraints_builder_v1.py

CAMBIO:
En build_constraints_v1(), después de resolver el objective:
- Si profile_id >= 8 y objective es "efficient_risk":
  - Cambiar objective a "max_sharpe".
  - Añadir log informativo.

NO tocar:
- Risk buckets (RV/RF min/max).
- target_vol.
- max_weight.
- Frontend.
- firestore.rules.

Verificar: py_compile.
No commit. No deploy.
```

---

## 6. Confirmaciones

- ✅ No se modificó código.
- ✅ No se hizo deploy.
- ✅ No se hizo push.
- ✅ Solo análisis y documentación.
