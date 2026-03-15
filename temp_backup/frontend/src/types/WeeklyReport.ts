export interface AssetClassWeight {
    assetClass: string; // e.g., 'Renta Variable', 'Renta Fija', 'Liquidez', 'Alternativos'
    strategicWeight: number; // Porcentaje SAA (Strategic Asset Allocation)
    tacticalWeight: number; // Porcentaje TAA (Tactical Asset Allocation)
    view: 'Positiva' | 'Neutral' | 'Negativa'; // Visión táctica
    rationale?: string; // Justificación breve de la recomendación
}

export interface RegionWeight {
    region: string; // e.g., 'EEUU', 'Europa', 'Emergentes', 'Japón'
    weight: number;
    view: 'Positiva' | 'Neutral' | 'Negativa';
    rationale?: string; // Breve razón
}

export interface SectorWeight {
    sector: string; // e.g., 'Tecnología', 'Salud', 'Finanzas'
    weight: number;
    view: 'Positiva' | 'Neutral' | 'Negativa';
}

export interface WeeklyReport {
    id: string;
    date: string; // ISO String Date
    author: string;
    provider?: string; // e.g. 'Gemini 2.0 Flash (Deep Research Consolidated)'

    // Tab 1: Resumen y Visión
    summary: {
        headline: string;
        narrative: string; // Texto corto introductorio (NO el informe entero)
        keyEvents: string[]; // Lista de eventos clave de la semana
        kpis?: { label: string; value: string; trend: 'up' | 'down' | 'neutral' }[];
        marketTemperature?: 'Bullish' | 'Neutral' | 'Bearish';
        tailRisks?: { risk: string; probability: 'Alta' | 'Media' | 'Baja'; impact: 'Alto' | 'Medio' | 'Bajo' }[];
    };

    // Tab 3: Deep Research Completo
    fullReport?: {
        narrative: string; // Markdown hiper extenso
    };

    // Tab 2: Asignación de Activos
    assetAllocation: {
        overview: string; // Pequeño texto introductorio
        classes: AssetClassWeight[];
        regionsEquity: RegionWeight[]; // Detalle regional para Renta Variable
        regionsFixedIncome?: RegionWeight[]; // Detalle regional para Renta Fija
        sectors?: SectorWeight[]; // Opcional
    };
}
