
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
    if (rendimientoNeto <= 7500) return 8000;
    if (rendimientoNeto > 7500 && rendimientoNeto <= 23000) {
        return 8000 - ((rendimientoNeto - 7500) * 0.25);
    }
    return 0;
}

export function getMinoracionCuota(): number {
    return 1615; // Norma Foral 2/2025 Art. 77
}

export function calculateBizkaiaTax(income: number): number {
    if (income <= 0) return 0;

    // 1. Bonificación Rendimientos del Trabajo (Art. 18 NF 2/2025)
    // Se aplica a la base, reduciéndola antes de la tarifa (simplificado para simulador)
    // Nota: La bonificación se resta del rendimiento neto previo.
    const bonificacion = getBonificacionTrabajo(income);
    const baseLiquidable = Math.max(0, income - bonificacion);

    // Tarifas IRPF Bizkaia 2026 (Aprox. según HTML)
    const brackets = [
        { limit: 0, rate: 0.23 },
        { limit: 18080, rate: 0.28 },
        { limit: 36160, rate: 0.35 },
        { limit: 54240, rate: 0.40 },
        { limit: 77450, rate: 0.45 },
        { limit: 107260, rate: 0.46 },
        { limit: 142960, rate: 0.47 },
        { limit: 208390, rate: 0.49 }, // Max marginal
    ];

    // Cálculo progresivo
    let tax = 0;
    let remainingIncome = baseLiquidable;
    let previousLimit = 0;

    // Ordered brackets for calculation loop
    // HTML used reverse loop with direct subtraction. Let's use strict ranges.
    // HTML Logic:
    /*
        const brackets = [
            { limit: 208390, rate: 0.49 },
            ...
        ];
        for (const bracket of brackets) {
            if (remainingIncome > bracket.limit) {
                tax += (remainingIncome - bracket.limit) * bracket.rate;
                remainingIncome = bracket.limit;
            }
        }
    */
    // Replicating HTML logic exactly for consistency
    const reverseBrackets = [...brackets].sort((a, b) => b.limit - a.limit);

    let currentIncome = baseLiquidable;
    for (const bracket of reverseBrackets) {
        if (currentIncome > bracket.limit) {
            tax += (currentIncome - bracket.limit) * bracket.rate;
            currentIncome = bracket.limit;
        }
    }

    // Minoración de cuota (Art. 77 NF 2/2025)
    const minoracion = getMinoracionCuota();
    tax = Math.max(0, tax - minoracion);

    return tax;
}

/**
 * Coeficiente de exención EPSV (Art. 37.e y 9.38 NF 13/2013)
 * coef_exento = rentabilidad_acumulada / capital_total_epsv
 */
export function calculateExemptionRatio(ahorrosEPSV: number, beneficioEPSV: number): number {
    if (ahorrosEPSV <= 0 || beneficioEPSV <= 0) return 0;
    if (beneficioEPSV > ahorrosEPSV) return 0; // Datos inválidos
    return beneficioEPSV / ahorrosEPSV;
}

export function calculateEPSVNetoOneOff(amountEPSV: number, pensionPublicaAnual: number): number {
    const baseImponibleExtra = amountEPSV * 0.60;
    const taxBase = calculateBizkaiaTax(pensionPublicaAnual);
    const taxTotal = calculateBizkaiaTax(pensionPublicaAnual + baseImponibleExtra);
    const taxIncremental = taxTotal - taxBase;
    return amountEPSV - taxIncremental;
}

export const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

export const formatPercent = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount);
