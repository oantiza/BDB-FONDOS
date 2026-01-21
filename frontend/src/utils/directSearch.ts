import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * BUSQUEDA DIRECTA V3 (SOLICITED BY USER)
 * No transformaciones legacy. Solo busca coincidecias de asset_class.
 */
/**
 * BUSQUEDA DIRECTA V3 (SOLICITED BY USER)
 * No transformaciones legacy. Solo busca coincidecias de asset_class (y region/category).
 */
/**
 * BUSQUEDA DIRECTA V3 (SOLICITED BY USER)
 * No transformaciones legacy. Solo busca coincidecias de asset_class (y region/category).
 */
export async function findDirectAlternativesV3(
    targetFund: any,
    options: { excludeIsins?: string[]; desired?: number } = {}
) {
    const { excludeIsins = [], desired = 3 } = options;

    // 1. Validar que tenga el campo derived.asset_class
    const targetClass = targetFund?.derived?.asset_class || targetFund?.asset_class;

    if (!targetClass) {
        console.warn("[DirectSearch] El fondo objetivo no tiene derived.asset_class", targetFund);
        return [];
    }

    const targetRegion = targetFund?.derived?.primary_region || targetFund?.primary_region;
    const targetCategory = targetFund?.ms?.category_morningstar; // Opcional, para ranking

    // 2. Query simple a funds_v3 por asset_class
    // Traemos un pull grande (Fixed 600) para poder filtrar en memoria por region y exclusions
    const q = query(
        collection(db, 'funds_v3'),
        where("derived.asset_class", "==", targetClass),
        limit(600)
    );

    try {
        const snap = await getDocs(q);

        // 3. Filtrar en memoria
        const candidates: any[] = [];
        const processDoc = (doc: any) => {
            const data = doc.data();
            const isin = doc.id;

            // Excluir el propio target
            if (isin === (targetFund?.isin || targetFund?.id)) return;
            // Excluir blacklist (ISINs ya en cartera)
            if (excludeIsins.includes(isin)) return;

            // Region rule:
            // If target is GLOBAL -> do not filter by region
            // If target is NOT GLOBAL -> require same region when present
            // EXCEPTION: "Monetario" usually has mixed regions or Global data, so we skip strict check to find candidates
            if (targetRegion && targetRegion !== "GLOBAL" && targetClass !== "Monetario") {
                const candRegion = data.derived?.primary_region || data.primary_region;
                if (candRegion && candRegion !== targetRegion) return;
            }

            // EXCEPTION 2: If we pulled this from "RF" but target is "Monetario", verify it is Ultra-Short
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
                where("derived.asset_class", "==", "RF"),
                limit(300) // Limitado para no sobrecargar
            );
            const snapRF = await getDocs(qRF);
            snapRF.forEach(processDoc);
        }

        // 4. Ranking (Prefer same Morningstar Category)
        // Separamos en dos grupos: match exacto de categoria vs resto
        let matchCat: any[] = [];
        let others: any[] = [];

        if (targetCategory) {
            candidates.forEach(c => {
                const cCat = c.ms?.category_morningstar;
                if (cCat === targetCategory) matchCat.push(c);
                else others.push(c);
            });
        } else {
            others = candidates;
        }

        // 5. Shuffle in groups (Randomness)
        const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
        shuffle(matchCat);
        shuffle(others);

        // 6. Merge & Slice
        const finalPool = [...matchCat, ...others];
        return finalPool.slice(0, desired);

    } catch (e) {
        console.error("Error en busqueda directa V3:", e);
        return [];
    }
}
