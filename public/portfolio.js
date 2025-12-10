import { fundDatabase, currentPortfolio, vipFunds } from './store.js';

// ============================================================================
// CONFIGURACIÓN: PASO 1 y PASO 2 (LAS REGLAS DEL JUEGO)
// ============================================================================

/**
 * PASO 1: MATRIZ DE RIESGO (Filtros de Seguridad)
 * Define qué volatilidad máxima y qué tipos de activos se permiten por nivel.
 */
const RISK_MATRIX = {
    1: { maxVol: 2.0,  allowed: ['Monetario', 'Renta Fija Corto Plazo'] },
    2: { maxVol: 4.0,  allowed: ['Renta Fija Soberana', 'Renta Fija Euro'] },
    3: { maxVol: 5.5,  allowed: ['Renta Fija Corporativa', 'Renta Fija Euro', 'Mixto Defensivo'] },
    4: { maxVol: 7.5,  allowed: ['Mixto Defensivo', 'Retorno Absoluto', 'Renta Fija Global'] },
    5: { maxVol: 10.0, allowed: ['Mixto Global', 'Mixto Flexible', 'Retorno Absoluto'] },
    6: { maxVol: 12.0, allowed: ['RV Value', 'RV Global', 'Inmobiliario', 'Mixto Agresivo'] },
    7: { maxVol: 15.0, allowed: ['RV Global', 'RV USA', 'RV Europa'] },
    8: { maxVol: 18.0, allowed: ['RV Growth', 'RV USA', 'RV Tecnología', 'RV Consumo'] },
    9: { maxVol: 22.0, allowed: ['RV Emergentes', 'RV Small Caps', 'RV Asia'] },
    10: { maxVol: 100.0, allowed: ['ALL'] } // Barra libre para High Conviction
};

/**
 * PASO 2: ESTRATEGIA GEOGRÁFICA (Asignación de Capital)
 * Define DÓNDE se pone el dinero (Casa vs Mundo) según el riesgo.
 */
const GEO_STRATEGY = {
    // Niveles 1-3: Prioridad CASA (Euro) para evitar riesgo divisa
    1: { buckets: [{ region: 'Euro', weight: 100 }] },
    2: { buckets: [{ region: 'Euro', weight: 100 }] },
    3: { buckets: [{ region: 'Euro', weight: 100 }] },

    // Niveles 4-5: Transición (Ancla fuerte en Euro)
    4: { buckets: [{ region: 'Global_USA', weight: 60 }, { region: 'Euro', weight: 40 }] },
    5: { buckets: [{ region: 'Global_USA', weight: 60 }, { region: 'Euro', weight: 40 }] },

    // Niveles 6-7: Motor Americano (Giro al Dólar)
    6: { buckets: [{ region: 'Global_USA', weight: 70 }, { region: 'Euro', weight: 30 }] },
    7: { buckets: [{ region: 'Global_USA', weight: 70 }, { region: 'Euro', weight: 30 }] },

    // Niveles 8-9: Agresivo (Entran Emergentes)
    8: { buckets: [{ region: 'USA', weight: 50 }, { region: 'Emerging', weight: 30 }, { region: 'Euro', weight: 20 }] },
    9: { buckets: [{ region: 'USA', weight: 50 }, { region: 'Emerging', weight: 30 }, { region: 'Euro', weight: 20 }] },

    // Nivel 10: High Conviction (50% Ancla USA / 50% Francotirador Sectorial)
    10: { buckets: [{ region: 'USA', weight: 50 }, { region: 'Agnostic', weight: 50 }] }
};

// ============================================================================
// HELPER: CLASIFICADOR DE FONDOS
// ============================================================================

function getFundRegion(fund) {
    const type = (fund.manual_type || "").toUpperCase();
    const name = (fund.name || "").toUpperCase();
    const cat = (fund.category_morningstar || "").toUpperCase();

    // Lógica para detectar región basada en tus datos
    if (type.includes('SECTOR') || type.includes('TECNOLOG') || type.includes('SALUD') || type.includes('BIO') || type.includes('ENERG')) return 'Agnostic';
    if (type.includes('EMERGENTE') || type.includes('ASIA') || type.includes('CHINA') || type.includes('LATAM')) return 'Emerging';
    if (type.includes('EURO') || type.includes('ESPAÑA') || cat.includes('EUROZONE')) return 'Euro';
    if (type.includes('USA') || type.includes('EE.UU') || type.includes('AMERICA') || name.includes('S&P') || name.includes('NASDAQ')) return 'USA';
    if (type.includes('GLOBAL') || type.includes('MUNDIAL') || name.includes('MSCI WORLD')) return 'Global_USA'; // Global suele ser 60% USA
    
    return 'Other';
}

function getFundVolatility(fund) {
    // Prioridad: Dato calculado hoy (metrics.volatility_1y) > Dato BD (perf.volatility)
    if (fund.metrics && fund.metrics.volatility_1y) return fund.metrics.volatility_1y;
    if (fund.perf && fund.perf.volatility) return fund.perf.volatility;
    return 100; // Si no hay datos, asumimos riesgo máximo por seguridad
}

function getFundScore(fund) {
    // El Score ya viene calculado del Backend (0-100). Si no, fallback simple.
    return fund.score || (fund.perf?.sharpe * 20) || 0;
}

// ============================================================================
// MOTOR PRINCIPAL: SELECTOR DE FONDOS (PASO 3)
// ============================================================================

export function selectFunds(riskLevelInput) {
    // Normalizar entrada (asegurar que es 1-10)
    let risk = parseInt(riskLevelInput);
    if (isNaN(risk) || risk < 1) risk = 5;
    if (risk > 10) risk = 10;

    const constraints = RISK_MATRIX[risk];
    const strategy = GEO_STRATEGY[risk];

    console.log(`Ejecutando Estrategia Nivel ${risk}:`, strategy);

    let finalPortfolio = [];

    // --- FASE A: FILTRADO (El Portero) ---
    // Solo pasan fondos que cumplen Volatilidad y Tipo
    const eligibleFunds = fundDatabase.filter(f => {
        const vol = getFundVolatility(f);
        const type = f.manual_type || "Other";
        
        // 1. Chequeo Volatilidad
        if (vol > constraints.maxVol) return false;

        // 2. Chequeo Tipo (Si es Nivel 10 'ALL', pasa todo)
        if (constraints.allowed.includes('ALL')) return true;
        
        // Búsqueda laxa del tipo (ej: "RV Global" encaja con "RV")
        const isTypeAllowed = constraints.allowed.some(allowedType => 
            type.toUpperCase().includes(allowedType.toUpperCase()) || 
            (allowedType === 'Renta Fija Euro' && type.includes('RF')) // Fallback genérico
        );
        
        return isTypeAllowed;
    });

    // --- FASE B: ASIGNACIÓN (El Francotirador) ---
    // Para cada "cubo" de la estrategia, buscamos el MEJOR fondo disponible
    
    strategy.buckets.forEach(bucket => {
        let candidates = [];

        if (bucket.region === 'Agnostic') {
            // Lógica especial Nivel 10: Buscamos los mejores sectoriales/temáticos
            candidates = eligibleFunds.filter(f => getFundRegion(f) === 'Agnostic' || f.manual_type.includes('RV'));
        } else if (bucket.region === 'Global_USA') {
            // Aceptamos tanto Globales como USA puros
            candidates = eligibleFunds.filter(f => {
                const r = getFundRegion(f);
                return r === 'Global_USA' || r === 'USA';
            });
        } else {
            // Filtrado regional estricto (Euro, USA, Emerging)
            candidates = eligibleFunds.filter(f => getFundRegion(f) === bucket.region);
        }

        // ORDENAR POR CALIDAD (Score descendente)
        candidates.sort((a, b) => getFundScore(b) - getFundScore(a));

        // SELECCIONAR GANADOR
        if (candidates.length > 0) {
            // Cogemos el Top 1. 
            // (Mejora futura: Podríamos coger Top 2 y dividir el peso si el bucket es muy grande)
            const winner = candidates[0];
            
            // Evitar duplicados si un fondo gana en dos categorías (raro pero posible)
            const existing = finalPortfolio.find(p => p.isin === winner.isin);
            if (existing) {
                existing.weight += bucket.weight;
            } else {
                finalPortfolio.push({ ...winner, weight: bucket.weight });
            }
        } else {
            console.warn(`No se encontró fondo para la región: ${bucket.region} en Nivel ${risk}`);
        }
    });

    // --- FASE C: RELLENO DE SEGURIDAD ---
    // Si la cartera no suma 100% (porque faltaban fondos en algún bucket), rellenar con Monetario/RF
    const currentTotal = finalPortfolio.reduce((sum, f) => sum + f.weight, 0);
    if (currentTotal < 99) {
        const diff = 100 - currentTotal;
        // Buscar un monetario o RF seguro
        const safeFund = fundDatabase.find(f => f.manual_type.includes('Monetario') || f.manual_type.includes('Corto Plazo'));
        if (safeFund) {
            finalPortfolio.push({ ...safeFund, weight: diff });
        }
    }

    return finalPortfolio;
}

// ============================================================================
// FUNCIONES AUXILIARES (UI COMPATIBILITY)
// ============================================================================

export function assignWeights(portfolio) {
    // Esta función ya no es necesaria porque `selectFunds` asigna los pesos directamente
    // pero la mantenemos para compatibilidad si algo externo la llama.
    return portfolio;
}

export function roundAndNormalizeWeights(portfolio) {
    // Asegura que sumen 100% exacto por errores de coma flotante
    let sum = 0;
    const temp = portfolio.map(f => {
        const w = Math.round(f.weight * 100) / 100;
        sum += w;
        return { ...f, weight: w };
    });
    
    const diff = 100 - sum;
    if (Math.abs(diff) > 0.001 && temp.length > 0) {
        temp[0].weight += diff; // Ajustar al primero
    }
    return temp;
}

export function calculatePortfolioStats(portfolio) {
    let ret = 0, vol = 0;
    
    portfolio.forEach(f => {
        const w = f.weight / 100;
        // Usamos los datos normalizados
        const r = f.std_perf ? f.std_perf.cagr3y : 0.03; 
        const v = f.std_perf ? f.std_perf.volatility : 0.05;
        ret += r * w;
        vol += v * w;
    });

    // Ajuste simple por diversificación (Heurística visual)
    if (portfolio.length > 2) vol *= 0.9; 

    return { 
        ret, 
        vol, 
        sharpe: vol > 0 ? (ret - 0.025) / vol : 0 
    };
}

// Exportamos helpers antiguos para no romper nada si se usan en otro lado
export function inferAssetProfile(fund) {
    if (fund.manual_type && fund.manual_type.includes('RV')) return 'RV';
    if (fund.manual_type && fund.manual_type.includes('RF')) return 'RF';
    return 'Mixto';
}