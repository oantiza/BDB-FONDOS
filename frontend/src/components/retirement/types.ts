import { RentTaxResult } from '../../utils/retirementUtils';

export interface RetirementFormState {
    ahorros: number;
    revalorizacion: number;
    pensionPublica: number;
    epsvPre2026: number;
    rentabilidadPre2026: number;
    aniosAntiguedadPre2026: number;
    epsvPost2026: number;
    rentabilidadPost2026: number;
    aniosAntiguedadPost2026: number;
    conoceRentabilidad: boolean;
    esPrimerRescate: boolean;
    rescueMode: 'renta' | 'capital' | 'mixto';
    pctCapital: number;
    rentType: 'temporal' | 'vitaliciaEV' | 'vitaliciaSostenible';
    years: number;
    updateRate: number;
    age: number;
    sex: 'male' | 'female';
    updateRateEV: number;
}

export interface RetirementResults {
    rentaInicialMensual: number;
    epsvCashNeto: number;
    epsvRescatadoBruto: number;
    totalCapitalForRent: number;
    years: number;
    growth: number;
    totalEpsv: number;
    rentTaxResult: RentTaxResult;
    ratioEpsvEnRenta: number;
    ratioExento: number;
}
