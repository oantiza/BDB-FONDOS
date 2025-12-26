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

    // 1. Buscamos TODOS los candidatos válidos (Misma categoría y región)
    const baseCandidates = allFunds.filter(f =>
        f.isin !== originalFund.isin &&
        f.std_type === originalFund.std_type &&
        f.std_region === originalFund.std_region
    );

    // 2. Calculamos sus puntuaciones para todos
    const scored = baseCandidates.map(f => ({
        fund: f,
        score: calculateScore(f, riskLevel),
        // Si no tienes el campo 'retrocession', usa 'ter' para buscar el más barato
        commercialScore: parseFloat(f.costs?.retrocession || 0),
        fee: parseFloat(f.std_extra.ter || 0),
        isDifferentCompany: f.std_extra.company !== originalFund.std_extra.company
    }));

    const results: Alternative[] = [];
    const currentFee = parseFloat(originalFund.std_extra.ter || 0);

    // OPCIÓN A: El Matemático (Mejor Score Global)
    // Priorizamos diferente gestora ligeramente en el sort si el score es similar, 
    // pero principalmente buscamos el mejor fondo.
    scored.sort((a, b) => {
        // Bonus grande por ser de diferente gestora para la opción A? 
        // Mejor dejar que el score dicte, pero si queremos diversidad:
        if (a.isDifferentCompany && !b.isDifferentCompany) return -1;
        if (!a.isDifferentCompany && b.isDifferentCompany) return 1;
        return b.score - a.score;
    });

    const bestQuant = scored[0];

    if (bestQuant) {
        results.push({
            fund: bestQuant.fund,
            reason: "⭐ Más Eficiente",
            badgeColor: "green",
            deltaFee: bestQuant.fee - currentFee
        });
    }

    // OPCIÓN B: El Comercial (O alternativa estratégica)
    // Buscamos algo distinto. Si el primero fue "Mejor Score", este podría ser "Menor Coste" o "Gestora Premium".
    // Vamos a buscar el de mejor margen comercial (retrocesión) o simplemente el segundo mejor score que sea diferente.

    // Filtramos para no repetir el A
    const remaining = scored.filter(x => x.fund.isin !== bestQuant?.fund.isin);

    // Sort por criterio comercial o simplemente diversidad
    remaining.sort((a, b) => {
        // Priorizar diferente gestora AQUI es clave si el primero no lo fue
        if (a.isDifferentCompany && !b.isDifferentCompany) return -1;
        if (!a.isDifferentCompany && b.isDifferentCompany) return 1;
        return b.commercialScore - a.commercialScore;
    });

    const bestCommercial = remaining[0];

    if (bestCommercial) {
        results.push({
            fund: bestCommercial.fund,
            reason: bestCommercial.isDifferentCompany ? "🔄 Diversificación Gestora" : "💎 Alternativa Premium",
            badgeColor: "purple",
            deltaFee: bestCommercial.fee - currentFee
        });
    }

    return results; // Devolvemos hasta 2 opciones
}
