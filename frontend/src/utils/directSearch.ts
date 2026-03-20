import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * BUSQUEDA DIRECTA V3 (V2 TAXONOMY STRICT)
 */
export async function findDirectAlternativesV3(
    targetFund: any | null,
    options: { excludeIsins?: string[]; desired?: number; assetClass?: string; region?: string; maximizeRetro?: boolean; offset?: number } = {}
) {
    const { excludeIsins = [], desired = 3, assetClass, region, maximizeRetro = false, offset = 0 } = options;

    // 1. Validar clase de activo
    const targetClass = assetClass || targetFund?.classification_v2?.asset_type || 'EQUITY';

    if (!targetClass) {
        console.warn("[DirectSearch] El fondo objetivo no tiene classification_v2.asset_type", targetFund);
        return [];
    }

    const targetRegion = region || targetFund?.classification_v2?.region_primary || 'GLOBAL';
    const targetCategory = targetFund?.classification_v2?.asset_subtype;

    // 2. Query simple a funds_v3 por asset_type
    const q = query(
        collection(db, 'funds_v3'),
        where("classification_v2.asset_type", "==", targetClass),
        limit(800)
    );

    try {
        const snap = await getDocs(q);

        // 3. Filtrar en memoria
        const candidates: any[] = [];
        const processDoc = (doc: any) => {
            const data = doc.data();
            const isin = doc.id;

            if (isin === (targetFund?.isin || targetFund?.id)) return;
            if (excludeIsins.includes(isin)) return;

            // Region rule
            const skipRegionCheck = (targetRegion === 'GLOBAL' || targetClass === "MONEY_MARKET");

            if (!skipRegionCheck && targetRegion) {
                const candRegion = data.classification_v2?.region_primary;
                if (!candRegion || candRegion !== targetRegion) return;
            }

            // EXCEPTION 2: Monetario vs RF Ultra-Short
            const candClass = data.classification_v2?.asset_type;
            if (targetClass === "MONEY_MARKET" && candClass === "FIXED_INCOME") {
                const cat = (data.classification_v2?.asset_subtype || "").toUpperCase();
                const name = (data.name || "").toUpperCase();
                const isUltraShort = cat.includes("ULTRA") || cat.includes("SHORT") || cat.includes("CORTO") ||
                    name.includes("ULTRA") || name.includes("SHORT") || name.includes("CORTO");

                if (!isUltraShort) return;
            }

            candidates.push({ isin, ...data });
        };

        snap.forEach(processDoc);

        // Si es Monetario, buscar TAMBIÉN en FIXED_INCOME (para encontrar Ultra-Short)
        if (targetClass === "MONEY_MARKET") {
            const qRF = query(
                collection(db, 'funds_v3'),
                where("classification_v2.asset_type", "==", "FIXED_INCOME"),
                limit(300)
            );
            const snapRF = await getDocs(qRF);
            snapRF.forEach(processDoc);
        }

        // 4. Ranking (Prefer same Morningstar Category if TargetFund exists)
        let matchCat: any[] = [];
        let others: any[] = [];

        if (targetFund && targetCategory && !assetClass) {
            candidates.forEach(c => {
                const cCat = c.classification_v2?.asset_subtype;
                if (cCat === targetCategory) matchCat.push(c);
                else others.push(c);
            });
        } else {
            others = candidates;
        }

        // Helper function for sorting
        const getSharpe = (f: any) => f.std_perf_norm?.sharpe ?? f.std_perf?.sharpe ?? -999;
        const getReturns = (f: any) => f.std_perf_norm?.cagr3y ?? f.std_perf?.returns_3y ?? -999;
        const getRetro = (f: any) => {
            const r = f.manual?.costs?.retrocession ?? f.costs?.retrocession;
            if (r === undefined || r === null) return -999;
            return r > 0.1 ? r : r * 100; // Normalize percentage
        }

        const sortFunds = (arr: any[]) => {
            return arr.sort((a, b) => {
                if (maximizeRetro) {
                    const retroA = getRetro(a);
                    const retroB = getRetro(b);
                    // If both have retrocession info, sort by retrocession desc
                    if (retroA !== -999 && retroB !== -999) {
                        if (retroA !== retroB) return retroB - retroA;
                    } else if (retroA !== -999) {
                        return -1; // a has retro, prioritize it
                    } else if (retroB !== -999) {
                        return 1; // b has retro, prioritize it
                    }
                }

                // Default sorting / Secondary sorting by Sharpe
                const sA = getSharpe(a);
                const sB = getSharpe(b);
                if (sA !== sB) return sB - sA;

                // Tertiary sorting by returns
                const rA = getReturns(a);
                const rB = getReturns(b);
                return rB - rA;
            });
        };

        matchCat = sortFunds(matchCat);
        others = sortFunds(others);

        // 6. Merge & Slice
        const finalPool = targetFund ? [...matchCat, ...others] : [...others];

        return finalPool.slice(offset, offset + desired);

    } catch (e) {
        console.error("Error en busqueda directa V3:", e);
        return [];
    }
}
