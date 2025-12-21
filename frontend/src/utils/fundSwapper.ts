// frontend/src/utils/fundSwapper.ts
import { calculateScore } from './rulesEngine';

export interface Alternative {
    fund: any;
    reason: string;
    badgeColor: string; // 'green', 'purple', 'blue'
    deltaFee: number;
}

export function findAlternatives(originalFund: any, allFunds: any[], riskLevel: number): Alternative[] {
    if (!originalFund || !allFunds) return [];

    // 1. Buscamos fondos de la misma categoría y región
    const candidates = allFunds.filter(f => 
        f.isin !== originalFund.isin &&
        f.std_type === originalFund.std_type &&
        f.std_region === originalFund.std_region &&
        // Importante: Que no sean de la misma gestora para dar variedad
        f.std_extra.company !== originalFund.std_extra.company
    );

    // 2. Calculamos sus puntuaciones
    const scored = candidates.map(f => ({
        fund: f,
        score: calculateScore(f, riskLevel),
        // Si no tienes el campo 'retrocession', usa 'ter' para buscar el más barato
        commercialScore: parseFloat(f.costs?.retrocession || 0), 
        fee: parseFloat(f.std_extra.ter || 0)
    }));

    const results: Alternative[] = [];
    const currentFee = parseFloat(originalFund.std_extra.ter || 0);

    // OPCIÓN A: El Matemático (Mejor Score)
    scored.sort((a, b) => b.score - a.score);
    const bestQuant = scored[0];

    if (bestQuant) {
        results.push({
            fund: bestQuant.fund,
            reason: "⭐ Más Eficiente",
            badgeColor: "green",
            deltaFee: bestQuant.fee - currentFee
        });
    }

    // OPCIÓN B: El Comercial (Mayor Margen o Diferente)
    // Ordenamos por retrocesión (o margen comercial)
    scored.sort((a, b) => b.commercialScore - a.commercialScore);
    // Buscamos uno que no sea el mismo que el "Eficiente"
    const bestCommercial = scored.find(x => x.fund.isin !== bestQuant?.fund.isin);

    if (bestCommercial) {
        results.push({
            fund: bestCommercial.fund,
            reason: "💎 Selección Premium",
            badgeColor: "purple",
            deltaFee: bestCommercial.fee - currentFee
        });
    }

    return results; // Devolvemos las 2 mejores opciones
}