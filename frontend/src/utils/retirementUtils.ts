/**
 * REGLAS Y APROXIMACIONES FISCALES E IMPLEMENTACIONES MATEMÁTICAS
 * 
 * 1. MODO FISCAL ELEGIDO: Impacto Incremental.
 *    Decisión: Mostrar el impacto fiscal *incremental* de los ahorros privados sobre la pensión pública.
 *    Justificación: El usuario ya percibe la pensión pública sin importar sus decisiones de ahorro privado. 
 *    Lo financieramente relevante para planificar es conocer qué sobrecoste fiscal exacto (IRPF añadido) 
 *    conllevan sus diferentes estrategias de rescate (EPSV, fondos, etc.).
 *    Fórmula: cuota_general_incremental = tax(pensión + parte_sujeta_epsv) - tax(pensión).
 * 
 * 2. HEURÍSTICA DE PLUSVALÍAS (AHORROS PRIVADOS):
 *    Aproximación: Debido a que la herramienta no pide el precio histórico de compra de los ahorros (fondo de inversión),
 *    es imposible calcular la plusvalía FIFO exacta obligatoria por la Hacienda Foral.
 *    Solución Activa: Se asume pragmáticamente un 'profit ratio' dinámico acotado a [0, 0.5]. 
 *    Incluso en 'Vitalicia Sostenible' (que matemáticamente es 100% rendimiento vivo), fiscalmente se sigue rescatando
 *    el capital histórico paralelamente bajo normativa FIFO. Topamos al 50% de ganancia implícita media para evitar castigos
 *    fiscales irreales en la simulación.
 * 
 * 3. BLINDAJE MATEMÁTICO:
 *    Se aplican Math.max/min para acotar años [1, 120], edades [0, 120], y caídas asintóticas causadas por división
 *    cuando la revalorización (g) se iguala al retorno (i) en la fórmula matemática de rentas. No se propagan NaNs.
 */

export const LIFE_EXPECTANCY_DATA: Record<number, { male: number; female: number }> = {
    50: { male: 32.2, female: 36.6 }, 55: { male: 27.7, female: 32.0 },
    60: { male: 23.3, female: 27.4 }, 65: { male: 19.2, female: 23.0 },
    70: { male: 15.5, female: 18.9 }, 75: { male: 12.1, female: 15.1 },
    80: { male: 9.1, female: 11.7 }, 85: { male: 6.6, female: 8.6 },
    90: { male: 4.6, female: 6.0 }, 95: { male: 3.1, female: 4.0 },
};

export function getLifeExpectancy(age: number, gender: 'male' | 'female'): number {
    // Blindaje de Age
    if (!age || isNaN(age) || !isFinite(age)) return 20; 
    const safeAge = Math.min(120, Math.max(0, age));

    const ageKeys = Object.keys(LIFE_EXPECTANCY_DATA).map(Number).sort((a, b) => a - b);
    
    if (safeAge <= ageKeys[0]) return LIFE_EXPECTANCY_DATA[ageKeys[0]][gender];
    
    if (safeAge >= ageKeys[ageKeys.length - 1]) {
        // Reducir gradualmente pasados los 95 años (0.4 años por cada año cumplido) pero sin bajar de 0.5
        return Math.max(0.5, LIFE_EXPECTANCY_DATA[95][gender] - (safeAge - 95) * 0.4);
    }

    // Interpolación lineal estricta
    for (let i = 0; i < ageKeys.length - 1; i++) {
        if (safeAge >= ageKeys[i] && safeAge <= ageKeys[i + 1]) {
            const age1 = ageKeys[i];
            const age2 = ageKeys[i + 1];
            const val1 = LIFE_EXPECTANCY_DATA[age1][gender];
            const val2 = LIFE_EXPECTANCY_DATA[age2][gender];
            const ratio = (safeAge - age1) / (age2 - age1);
            return Math.max(0.1, val1 - ratio * (val1 - val2)); // Evitar zeros
        }
    }
    return 1;
}

export function getBonificacionTrabajo(rendimientoNeto: number): number {
    const safeNeto = Math.max(0, rendimientoNeto || 0);
    if (safeNeto <= 14800) return 8000;
    if (safeNeto > 14800 && safeNeto <= 23000) {
        return Math.max(3000, 8000 - ((safeNeto - 14800) * 0.6098));
    }
    return 3000;
}

export function getMinoracionCuota(baseLiquidable: number): number {
    const safeBase = Math.max(0, baseLiquidable || 0);
    if (safeBase <= 30000) return 204; 
    if (safeBase > 30000 && safeBase <= 35000) {
        return Math.max(0, 204 * (1 - (safeBase - 30000) / 5000));
    }
    return 0;
}

export function calculateBizkaiaTaxBaseGeneral(income: number): number {
    const safeIncome = Math.max(0, income || 0);
    if (safeIncome <= 0) return 0;

    const bonificacion = getBonificacionTrabajo(safeIncome);
    const baseLiquidable = Math.max(0, safeIncome - bonificacion);

    const brackets = [
        { limit: 0, rate: 0.23 },
        { limit: 18442, rate: 0.28 },
        { limit: 36883, rate: 0.35 },
        { limit: 55325, rate: 0.40 },
        { limit: 79000, rate: 0.45 },
        { limit: 109405, rate: 0.46 },
        { limit: 145819, rate: 0.47 },
        { limit: 212558, rate: 0.49 },
    ];

    let tax = 0;
    const reverseBrackets = [...brackets].sort((a, b) => b.limit - a.limit);
    let currentIncome = baseLiquidable;
    
    for (const bracket of reverseBrackets) {
        if (currentIncome > bracket.limit) {
            tax += (currentIncome - bracket.limit) * bracket.rate;
            currentIncome = bracket.limit;
        }
    }

    const minoracion = getMinoracionCuota(baseLiquidable);
    return Math.max(0, tax - minoracion);
}

// Alias de retrocompatibilidad
export function calculateBizkaiaTax(income: number): number {
    return calculateBizkaiaTaxBaseGeneral(income);
}

export function calculateBizkaiaTaxBaseAhorro(income: number): number {
    const safeIncome = Math.max(0, income || 0);
    if (safeIncome <= 0) return 0;
    
    const brackets = [
        { limit: 0, rate: 0.19 },
        { limit: 6000, rate: 0.21 },
        { limit: 50000, rate: 0.23 },
        { limit: 200000, rate: 0.27 },
        { limit: 300000, rate: 0.30 },
    ];

    let tax = 0;
    const reverseBrackets = [...brackets].sort((a, b) => b.limit - a.limit);
    let currentIncome = safeIncome;
    
    for (const bracket of reverseBrackets) {
        if (currentIncome > bracket.limit) {
            tax += (currentIncome - bracket.limit) * bracket.rate;
            currentIncome = bracket.limit;
        }
    }
    return Math.max(0, tax);
}

export function estimateRentabilidad(capitalTotal: number, aniosAntiguedad?: number): number {
    const safeCap = Math.max(0, capitalTotal || 0);
    const safeYears = Math.max(0, aniosAntiguedad || 0);
    if (safeYears > 0) {
        const porcentaje = Math.min(0.01 * safeYears, 0.35); // Max 35% de ganancia heurística
        return safeCap * porcentaje;
    }
    return safeCap * 0.25; 
}

export interface RescateEPSVParams {
    amountPre2026: number;
    amountPost2026: number;
    rentabilidadPost2026?: number;
    aniosAntiguedadPost2026?: number;
    pensionPublicaAnual: number;
    esPrimerRescate: boolean;
}

export interface ResultadoRescate {
    rescateBruto: number;
    totalImpuestos: number;
    rescateNeto: number;
    baseGeneralExtra: number;
    baseAhorroExtra: number;
}

export function calculateEPSVNetoAdvanced(params: RescateEPSVParams): ResultadoRescate {
    const LIMITE_REDUCCION = 300000;
    
    // Sanitize inputs
    const pre26 = Math.max(0, params.amountPre2026 || 0);
    const post26 = Math.max(0, params.amountPost2026 || 0);
    const publicPension = Math.max(0, params.pensionPublicaAnual || 0);

    let baseImponibleGeneralExtra = 0;
    let baseImponibleAhorroExtra = 0;
    let limiteRestante = LIMITE_REDUCCION;

    // --- MASA A ---
    if (pre26 > 0) {
        if (params.esPrimerRescate) {
            const conDerecho = Math.min(pre26, limiteRestante);
            const sinDerecho = Math.max(0, pre26 - limiteRestante);
            
            baseImponibleGeneralExtra += (conDerecho * 0.60) + sinDerecho;
            limiteRestante = Math.max(0, limiteRestante - conDerecho);
        } else {
            baseImponibleGeneralExtra += pre26;
        }
    }

    // --- MASA B ---
    if (post26 > 0) {
        let rawRentabilidad = 0;
        if (params.rentabilidadPost2026 !== undefined && !isNaN(params.rentabilidadPost2026)) {
            rawRentabilidad = Math.max(0, params.rentabilidadPost2026);
        } else {
            rawRentabilidad = estimateRentabilidad(post26, Math.max(0, params.aniosAntiguedadPost2026 || 0));
        }
        
        // Bloqueo estricto: la rentabilidad jamás puede superar el capital recuperado
        const rentabilidad = Math.min(post26, rawRentabilidad);
        const principal = Math.max(0, post26 - rentabilidad);
        
        baseImponibleAhorroExtra += rentabilidad;

        if (params.esPrimerRescate && limiteRestante > 0) {
            const principalConDerecho = Math.min(principal, limiteRestante);
            const principalSinDerecho = Math.max(0, principal - limiteRestante);
            baseImponibleGeneralExtra += (principalConDerecho * 0.70) + principalSinDerecho;
        } else {
            baseImponibleGeneralExtra += principal;
        }
    }

    // --- CÁLCULO FINAL (INCREMENTAL) ---
    const taxBaseGeneralSinEPSV = calculateBizkaiaTaxBaseGeneral(publicPension);
    const taxGeneralTotal = calculateBizkaiaTaxBaseGeneral(publicPension + baseImponibleGeneralExtra);
    
    // Incremento puro en la cuota provocado por el rescate EPSV
    const taxIncrementalGeneral = Math.max(0, taxGeneralTotal - taxBaseGeneralSinEPSV);
    
    const taxAhorroEPSV = calculateBizkaiaTaxBaseAhorro(baseImponibleAhorroExtra);

    const rescateBruto = pre26 + post26;
    const totalImpuestos = taxIncrementalGeneral + taxAhorroEPSV;

    return {
        rescateBruto,
        totalImpuestos: isNaN(totalImpuestos) ? 0 : totalImpuestos,
        rescateNeto: Math.max(0, rescateBruto - totalImpuestos),
        baseGeneralExtra: baseImponibleGeneralExtra,
        baseAhorroExtra: baseImponibleAhorroExtra
    };
}


// --- 5. MÓDULO CENTRAL FISCAL (MODO INCREMENTAL) ---
export interface RentTaxParams {
    rentaPrivadaAnual: number;
    pensionPublicaAnual: number;
    ratioEpsvEnRenta: number;
    ratioExentoEPSV: number;
    ratioBeneficioAhorros: number; // Porcentaje heurístico de cada pago de ahorros que es plusvalía [0, 1]
}

export interface RentTaxResult {
    rentaAnualEPSV: number;
    rentaAnualAhorros: number;
    parteExentaEPSV: number;
    parteSujetaEPSV: number;
    plusvaliaSujetaAhorros: number;
    parteExentaAhorros: number;
    totalExento: number;
    totalSujetoGeneral: number; // Base imputable
    totalSujetoAhorro: number;
    ingresosBrutosPrivados: number; // OJO: solo los del usuario privados
    cuotaGeneralIncremental: number; // TAX(EPSV) añadido sobre pensión
    cuotaAhorro: number; // TAX(Ahorros) directo al 19-27%
    totalImpuestosPrivados: number; 
    netoPrivadoAnual: number;
    netoPrivadoMensual: number;
    tipoMedioIncremental: number;
    netoConsolidadoMensual: number; // Privado neto + Pensión pública neta
}

export function calculateRentTaxes(params: RentTaxParams): RentTaxResult {
    // Saneamiento general de datos para evitar Infinity y NaN
    const rentaPrivadaAnual = Math.max(0, isFinite(params.rentaPrivadaAnual) ? params.rentaPrivadaAnual : 0);
    const pensionPublicaAnual = Math.max(0, isFinite(params.pensionPublicaAnual) ? params.pensionPublicaAnual : 0);
    const ratioEpsvEnRenta = Math.min(1, Math.max(0, isFinite(params.ratioEpsvEnRenta) ? params.ratioEpsvEnRenta : 0));
    const ratioExentoEPSV = Math.min(1, Math.max(0, isFinite(params.ratioExentoEPSV) ? params.ratioExentoEPSV : 0));
    const ratioBeneficioAhorros = Math.min(1, Math.max(0, isFinite(params.ratioBeneficioAhorros) ? params.ratioBeneficioAhorros : 0));

    // Desglose
    const rentaAnualEPSV = rentaPrivadaAnual * ratioEpsvEnRenta;
    const rentaAnualAhorros = rentaPrivadaAnual - rentaAnualEPSV;

    const parteExentaEPSV = rentaAnualEPSV * ratioExentoEPSV;
    const parteSujetaEPSV = rentaAnualEPSV - parteExentaEPSV;

    const plusvaliaSujetaAhorros = rentaAnualAhorros * ratioBeneficioAhorros;
    const parteExentaAhorros = rentaAnualAhorros - plusvaliaSujetaAhorros;

    const totalExento = parteExentaEPSV + parteExentaAhorros;
    
    // IMPACTO GENERAL INCREMENTAL
    const cuotaSoloPension = calculateBizkaiaTaxBaseGeneral(pensionPublicaAnual);
    const cuotaTotalGeneral = calculateBizkaiaTaxBaseGeneral(pensionPublicaAnual + parteSujetaEPSV);
    const cuotaGeneralIncremental = Math.max(0, cuotaTotalGeneral - cuotaSoloPension);
    
    // IMPACTO AHORRO
    const cuotaAhorro = calculateBizkaiaTaxBaseAhorro(plusvaliaSujetaAhorros);
    
    const totalImpuestosPrivados = cuotaGeneralIncremental + cuotaAhorro;
    
    // NETOS (Sólo los privados)
    const netoPrivadoAnual = Math.max(0, rentaPrivadaAnual - totalImpuestosPrivados);
    const netoPrivadoMensual = netoPrivadoAnual / 12;

    // TIPO MEDIO INCREMENTAL (Cuánto % de la Renta Privada se despide en impuestos)
    const tipoMedioIncremental = rentaPrivadaAnual > 0 ? (totalImpuestosPrivados / rentaPrivadaAnual) : 0;

    // Neto Consolidado (Lo que el jubilado tiene para vivir al mes: pensión sin su IRPF + renta privada liquida)
    const pensionNetoMensual = (pensionPublicaAnual - cuotaSoloPension) / 12;
    const netoConsolidadoMensual = Math.max(0, pensionNetoMensual + netoPrivadoMensual);

    return {
        rentaAnualEPSV,
        rentaAnualAhorros,
        parteExentaEPSV,
        parteSujetaEPSV,
        plusvaliaSujetaAhorros,
        parteExentaAhorros,
        totalExento,
        totalSujetoGeneral: parteSujetaEPSV,
        totalSujetoAhorro: plusvaliaSujetaAhorros,
        ingresosBrutosPrivados: rentaPrivadaAnual,
        cuotaGeneralIncremental,
        cuotaAhorro,
        totalImpuestosPrivados,
        netoPrivadoAnual,
        netoPrivadoMensual,
        tipoMedioIncremental,
        netoConsolidadoMensual
    };
}

export const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(isNaN(amount) || !isFinite(amount) ? 0 : amount);

export const formatPercent = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(isNaN(amount) || !isFinite(amount) ? 0 : amount);