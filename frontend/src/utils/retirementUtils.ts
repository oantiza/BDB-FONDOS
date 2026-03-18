export const LIFE_EXPECTANCY_DATA: Record<number, { male: number; female: number }> = {
    50: { male: 32.2, female: 36.6 }, 55: { male: 27.7, female: 32.0 },
    60: { male: 23.3, female: 27.4 }, 65: { male: 19.2, female: 23.0 },
    70: { male: 15.5, female: 18.9 }, 75: { male: 12.1, female: 15.1 },
    80: { male: 9.1, female: 11.7 }, 85: { male: 6.6, female: 8.6 },
    90: { male: 4.6, female: 6.0 }, 95: { male: 3.1, female: 4.0 },
};

export function getLifeExpectancy(age: number, gender: 'male' | 'female'): number {
    const ageKeys = Object.keys(LIFE_EXPECTANCY_DATA).map(Number).sort((a, b) => b - a);
    const applicableAge = ageKeys.find(key => age >= key) || Math.min(...ageKeys);
    return LIFE_EXPECTANCY_DATA[applicableAge]?.[gender] ?? 0;
}

export function getBonificacionTrabajo(rendimientoNeto: number): number {
    // Tramos actualizados aprox. Bizkaia 2026
    if (rendimientoNeto <= 14800) return 8000;
    if (rendimientoNeto > 14800 && rendimientoNeto <= 23000) {
        return 8000 - ((rendimientoNeto - 14800) * 0.6098);
    }
    return 3000;
}

export function getMinoracionCuota(baseLiquidable: number): number {
    if (baseLiquidable <= 30000) return 204; 
    if (baseLiquidable > 30000 && baseLiquidable <= 35000) {
        return 204 * (1 - (baseLiquidable - 30000) / 5000);
    }
    return 0;
}

// 1. Cálculo de la Base General (Rendimientos de Trabajo)
export function calculateBizkaiaTaxBaseGeneral(income: number): number {
    if (income <= 0) return 0;

    const bonificacion = getBonificacionTrabajo(income);
    const baseLiquidable = Math.max(0, income - bonificacion);

    // Tarifas IRPF Bizkaia 2026 - Base General
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

// Alias para mantener compatibilidad con las gráficas de tu página
export function calculateBizkaiaTax(income: number): number {
    return calculateBizkaiaTaxBaseGeneral(income);
}

// 2. Cálculo de la Base del Ahorro (Para la rentabilidad de las aportaciones post-2026)
export function calculateBizkaiaTaxBaseAhorro(income: number): number {
    if (income <= 0) return 0;
    
    // Tarifas IRPF Bizkaia 2026 - Base del Ahorro
    const brackets = [
        { limit: 0, rate: 0.19 },
        { limit: 6000, rate: 0.21 },
        { limit: 50000, rate: 0.23 },
        { limit: 200000, rate: 0.27 },
        { limit: 300000, rate: 0.30 },
    ];

    let tax = 0;
    const reverseBrackets = [...brackets].sort((a, b) => b.limit - a.limit);
    let currentIncome = income;
    
    for (const bracket of reverseBrackets) {
        if (currentIncome > bracket.limit) {
            tax += (currentIncome - bracket.limit) * bracket.rate;
            currentIncome = bracket.limit;
        }
    }
    return tax;
}

// 3. Estimación legal de rentabilidad si el usuario no tiene los datos exactos
export function estimateRentabilidad(capitalTotal: number, aniosAntiguedad?: number): number {
    if (aniosAntiguedad !== undefined && aniosAntiguedad > 0) {
        const porcentaje = Math.min(0.01 * aniosAntiguedad, 0.35); // 1% por año, máx 35%
        return capitalTotal * porcentaje;
    }
    return capitalTotal * 0.25; // 25% por defecto si no hay datos
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

// 4. Nuevo motor central que reemplaza a tu antigua función de rescate
export function calculateEPSVNetoAdvanced(params: RescateEPSVParams): ResultadoRescate {
    const LIMITE_REDUCCION = 300000;
    let baseImponibleGeneralExtra = 0;
    let baseImponibleAhorroExtra = 0;
    let limiteRestante = LIMITE_REDUCCION;

    // --- MASA A (Antes de 2026) ---
    if (params.amountPre2026 > 0) {
        if (params.esPrimerRescate) {
            const conDerecho = Math.min(params.amountPre2026, limiteRestante);
            const sinDerecho = Math.max(0, params.amountPre2026 - limiteRestante);
            
            baseImponibleGeneralExtra += (conDerecho * 0.60) + sinDerecho; // 40% reducción total
            limiteRestante -= conDerecho;
        } else {
            baseImponibleGeneralExtra += params.amountPre2026;
        }
    }

    // --- MASA B (A partir de 2026) ---
    if (params.amountPost2026 > 0) {
        const rentabilidad = params.rentabilidadPost2026 !== undefined 
            ? params.rentabilidadPost2026 
            : estimateRentabilidad(params.amountPost2026, params.aniosAntiguedadPost2026);
        
        const principal = Math.max(0, params.amountPost2026 - rentabilidad);
        
        baseImponibleAhorroExtra += rentabilidad; // La rentabilidad va al ahorro al 100%

        if (params.esPrimerRescate && limiteRestante > 0) {
            const principalConDerecho = Math.min(principal, limiteRestante);
            const principalSinDerecho = Math.max(0, principal - limiteRestante);

            baseImponibleGeneralExtra += (principalConDerecho * 0.70) + principalSinDerecho; // 30% reducción solo en principal
        } else {
            baseImponibleGeneralExtra += principal;
        }
    }

    // --- CÁLCULO FINAL ---
    const taxBaseGeneralSinEPSV = calculateBizkaiaTaxBaseGeneral(params.pensionPublicaAnual);
    const taxGeneralTotal = calculateBizkaiaTaxBaseGeneral(params.pensionPublicaAnual + baseImponibleGeneralExtra);
    const taxIncrementalGeneral = taxGeneralTotal - taxBaseGeneralSinEPSV;
    
    const taxAhorroEPSV = calculateBizkaiaTaxBaseAhorro(baseImponibleAhorroExtra);

    const rescateBruto = params.amountPre2026 + params.amountPost2026;
    const totalImpuestos = taxIncrementalGeneral + taxAhorroEPSV;

    return {
        rescateBruto,
        totalImpuestos,
        rescateNeto: rescateBruto - totalImpuestos,
        baseGeneralExtra: baseImponibleGeneralExtra,
        baseAhorroExtra: baseImponibleAhorroExtra
    };
}

export const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

export const formatPercent = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount);