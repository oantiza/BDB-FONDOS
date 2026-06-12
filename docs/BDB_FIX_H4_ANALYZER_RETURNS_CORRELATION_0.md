# BDB - FIX H4: correlacion sobre retornos en analyzer (auditoria 2026-06-09)

**Fecha:** 2026-06-09
**Origen:** AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf, hallazgo H4 (MEDIA).
**Estado:** aplicado en working tree; pendiente de commit/PR y deploy.

## Problema

`analyze_portfolio` (services/portfolio/analyzer.py) calculaba `df.corr()` sobre
NIVELES de precio. Dos series con tendencia muestran correlacion de niveles ~1
aunque sus retornos sean independientes (verificado en la auditoria: dos random
walks independientes daban 0.806 en precios vs 0.003 en retornos). Consecuencia:
la "Alerta de concentracion" (umbral 0.8) saltaba para casi cualquier par de
fondos alcistas y se generaban sugerencias de sustitucion injustificadas.
Inconsistencia interna: backtester.py ya correlacionaba retornos.

## Cambio

Una linea funcional: `corr_matrix = df.pct_change(fill_method=None).corr()`.
Afecta a `correlation_matrix`, `high_correlation_pairs`, la opinion generada y
las alternativas sugeridas (que derivan de los pares).

## Cambio de comportamiento a vigilar

Las alertas de concentracion seran MUCHO menos frecuentes (las anteriores eran
mayoritariamente espurias). Si algun usuario dependia de las sugerencias de
alternativas que colgaban de pares falsos, dejaran de aparecer.

## Evidencia

`tests/test_analyzer_returns_correlation.py` (3 tests): fondos independientes ya
no disparan la alerta; fondos con retornos identicos SI se detectan (corr>0.99);
check estatico de que no queda `df.corr()` sobre precios.
