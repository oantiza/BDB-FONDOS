import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

// [CONFIG] Search Variants (Shared Logic with SharpeMaximizer)
const ASSET_VARIANTS: Record<string, string[]> = {
    'RV': ['RV', 'Equity', 'Renta Variable', 'Stock', 'EQ', 'Renta Variable Global'],
    'RF': ['RF', 'Fixed Income', 'Renta Fija', 'Bond', 'FI', 'Deuda'],
    'Monetario': ['Monetario', 'Money Market', 'Cash', 'Liquidez', 'MM'],
    'Mixto': ['Mixto', 'Mixed', 'Balanced', 'Allocation', 'Multi-Asset'],
    'Retorno Absoluto': ['Retorno Absoluto', 'Alternative', 'Absolute Return', 'Hedge']
};

const getRegionVariants = (key: string): string[] => {
    const map: Record<string, string[]> = {
        'united_states': ['united_states', 'United States', 'USA', 'North America', 'US', 'EE.UU.'],
        'europe_broad': ['eurozone', 'europe_ex_euro', 'united_kingdom', 'europe_emerging', 'Europe', 'Europa', 'Eurozone', 'Zona Euro', 'UK', 'Germany', 'France'],
        'asia_broad': ['japan', 'china', 'asia_emerging', 'developed_asia', 'Asia', 'Japan', 'China', 'Japón', 'Pacific'],
        'emerging_broad': ['latin_america', 'emerging_markets', 'asia_emerging', 'europe_emerging', 'middle_east', 'africa', 'Emerging', 'Emergentes', 'Mercados Emergentes', 'BRIC']
    };
    const specific = map[key] || [];
    if (specific.length > 0) return specific;

    const generic = [key, key.replace(/_/g, ' '), key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
    return Array.from(new Set([...specific, ...generic]));
};

/**
 * BUSQUEDA DIRECTA V3 (SOLICITED BY USER)
 * Supports Broad Regions and Asset Variants
 */
export async function findDirectAlternativesV3(
    targetFund: any,
    options: { excludeIsins?: string[]; desired?: number; assetClass?: string; region?: string } = {}
) {
    const { excludeIsins = [], desired = 3, assetClass, region } = options;

    // 1. Validar clase de activo
    const targetClass = assetClass || targetFund?.derived?.asset_class || targetFund?.asset_class;

    if (!targetClass) {
        console.warn("[DirectSearch] El fondo objetivo no tiene derived.asset_class", targetFund);
        return [];
    }

    const targetRegion = region || targetFund?.derived?.primary_region || targetFund?.primary_region;
    const targetCategory = targetFund?.ms?.category_morningstar;

    // Expand Asset Class
    const targetAssets = ASSET_VARIANTS[targetClass] || [targetClass];
    // Special 'Otros' logic for Emerging RV (Mirroring SharpeMaximizer)
    const isEmerging = targetRegion && (targetRegion.includes('emerging') || targetRegion === 'china' || targetRegion === 'latin_america' || targetRegion === 'asia_broad');
    if (isEmerging && targetClass === 'RV') {
        targetAssets.push('Otros');
        targetAssets.push('Other');
    }

    // Expand Region
    let allowedRegions: string[] = [];
    if (targetRegion) {
        allowedRegions = getRegionVariants(targetRegion);
    }

    // 2. Query simple a funds_v3 por asset_class (Expanded)
    const q = query(
        collection(db, 'funds_v3'),
        where("derived.asset_class", "in", targetAssets),
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
            const skipRegionCheck = (targetRegion === 'all' || targetRegion === "GLOBAL" || targetClass === "Monetario");

            if (!skipRegionCheck && allowedRegions.length > 0) {
                const candRegion = data.derived?.primary_region || data.primary_region;
                if (!candRegion || !allowedRegions.includes(candRegion)) return;
            }

            // EXCEPTION 2: Monetario vs RF Ultra-Short
            const candClass = data.derived?.asset_class || data.asset_class;
            if (targetClass === "Monetario" && candClass === "RF") {
                const cat = (data.ms?.category_morningstar || "").toUpperCase();
                const name = (data.name || "").toUpperCase();
                const isUltraShort = cat.includes("ULTRA") || cat.includes("SHORT") || cat.includes("CORTO") ||
                    name.includes("ULTRA") || name.includes("SHORT") || name.includes("CORTO");

                if (!isUltraShort) return;
            }

            candidates.push({ isin, ...data });
        };

        snap.forEach(processDoc);

        // Si es Monetario, buscar TAMBIÉN en RF (para encontrar Ultra-Short)
        if (targetClass === "Monetario") {
            const qRF = query(
                collection(db, 'funds_v3'),
                where("derived.asset_class", "==", "RF"), // RF logic still strict here? Maybe expand too?
                // Expanding RF variants here is safer
                where("derived.asset_class", "in", ASSET_VARIANTS['RF'] || ['RF']),
                limit(300)
            );
            const snapRF = await getDocs(qRF);
            snapRF.forEach(processDoc);
        }

        // 4. Ranking (Prefer same Morningstar Category)
        let matchCat: any[] = [];
        let others: any[] = [];

        if (targetCategory && !assetClass) {
            candidates.forEach(c => {
                const cCat = c.ms?.category_morningstar;
                if (cCat === targetCategory) matchCat.push(c);
                else others.push(c);
            });
        } else {
            others = candidates;
        }

        // 5. Shuffle in groups
        const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
        shuffle(matchCat);
        shuffle(others);

        // 6. Merge & Slice
        const finalPool = [...matchCat, ...others];
        if (finalPool.length < 3) shuffle(finalPool);

        return finalPool.slice(0, desired);

    } catch (e) {
        console.error("Error en busqueda directa V3:", e);
        return [];
    }
}
