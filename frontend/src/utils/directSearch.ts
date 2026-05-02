import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

function normalizeAssetTypeToken(value: string | null | undefined): string {
    return String(value || '').trim().replace(/\s+/g, '_').replace(/-/g, '_').toUpperCase();
}

function getAssetTypeQueryValues(value: string | null | undefined): string[] {
    const token = normalizeAssetTypeToken(value);
    if (!token) return [];

    const queryValues = new Set<string>();
    if (token === 'EQUITY') queryValues.add('equity');
    if (token === 'FIXED_INCOME') queryValues.add('fixed_income');
    if (token === 'MIXED' || token === 'ALLOCATION') queryValues.add('allocation');
    if (token === 'MONETARY' || token === 'MONEY_MARKET') queryValues.add('money_market');
    if (token === 'ALTERNATIVE') queryValues.add('alternative');
    if (token === 'REAL_ESTATE' || token === 'REAL_ASSET') queryValues.add('real_asset');
    if (token === 'COMMODITIES') queryValues.add('commodities');
    if (token === 'OTHER') queryValues.add('other');

    queryValues.add(token);
    return Array.from(queryValues);
}

/**
 * BUSQUEDA DIRECTA V3 (V2 TAXONOMY STRICT)
 */
export async function findDirectAlternativesV3(
    targetFund: any | null,
    options: { excludeIsins?: string[]; desired?: number; assetClass?: string; region?: string; maximizeRetro?: boolean; offset?: number } = {}
) {
    const { excludeIsins = [], desired = 3, assetClass, region, maximizeRetro = false, offset = 0 } = options;

    const rawTargetClass = assetClass || targetFund?.classification_v2?.asset_type || 'equity';
    const normalizedTargetClass = normalizeAssetTypeToken(rawTargetClass);
    const targetClassQueryValues = getAssetTypeQueryValues(rawTargetClass);

    if (!targetClassQueryValues.length) {
        console.warn("[DirectSearch] El fondo objetivo no tiene classification_v2.asset_type", targetFund);
        return [];
    }

    const targetRegion = region || targetFund?.classification_v2?.region_primary || 'GLOBAL';
    const targetCategory = targetFund?.classification_v2?.asset_subtype;

    try {
        const snaps = await Promise.all(
            targetClassQueryValues.slice(0, 2).map((value) =>
                getDocs(
                    query(
                        collection(db, 'funds_v3'),
                        where("classification_v2.asset_type", "==", value),
                        limit(800)
                    )
                )
            )
        );

        const candidates: any[] = [];
        const seenIsins = new Set<string>();

        const processDoc = (doc: any) => {
            const data = doc.data();
            const isin = doc.id;

            if (isin === (targetFund?.isin || targetFund?.id)) return;
            if (excludeIsins.includes(isin)) return;
            if (seenIsins.has(isin)) return;

            const skipRegionCheck = (
                targetRegion === 'GLOBAL' ||
                normalizedTargetClass === "MONEY_MARKET" ||
                normalizedTargetClass === "MONETARY"
            );

            if (!skipRegionCheck && targetRegion) {
                const candRegion = data.classification_v2?.region_primary;
                if (!candRegion || candRegion !== targetRegion) return;
            }

            const candClass = normalizeAssetTypeToken(data.classification_v2?.asset_type);
            if ((normalizedTargetClass === "MONEY_MARKET" || normalizedTargetClass === "MONETARY") && candClass === "FIXED_INCOME") {
                const cat = (data.classification_v2?.asset_subtype || "").toUpperCase();
                const name = (data.name || "").toUpperCase();
                const isUltraShort = cat.includes("ULTRA") || cat.includes("SHORT") || cat.includes("CORTO") ||
                    name.includes("ULTRA") || name.includes("SHORT") || name.includes("CORTO");

                if (!isUltraShort) return;
            }

            seenIsins.add(isin);
            candidates.push({ isin, ...data });
        };

        snaps.forEach((snap) => snap.forEach(processDoc));

        if (normalizedTargetClass === "MONEY_MARKET" || normalizedTargetClass === "MONETARY") {
            const qRF = query(
                collection(db, 'funds_v3'),
                where("classification_v2.asset_type", "==", "fixed_income"),
                limit(300)
            );
            const snapRF = await getDocs(qRF);
            snapRF.forEach(processDoc);
        }

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

        const getSharpe = (f: any) => f.std_perf_norm?.sharpe ?? f.std_perf?.sharpe ?? -999;
        const getReturns = (f: any) => f.std_perf_norm?.cagr3y ?? f.std_perf?.returns_3y ?? -999;
        const getRetro = (f: any) => {
            const r = f.manual?.costs?.retrocession ?? f.costs?.retrocession;
            if (r === undefined || r === null) return -999;
            return r > 0.1 ? r : r * 100;
        };

        const sortFunds = (arr: any[]) => {
            return arr.sort((a, b) => {
                if (maximizeRetro) {
                    const retroA = getRetro(a);
                    const retroB = getRetro(b);
                    if (retroA !== -999 && retroB !== -999) {
                        if (retroA !== retroB) return retroB - retroA;
                    } else if (retroA !== -999) {
                        return -1;
                    } else if (retroB !== -999) {
                        return 1;
                    }
                }

                const sA = getSharpe(a);
                const sB = getSharpe(b);
                if (sA !== sB) return sB - sA;

                const rA = getReturns(a);
                const rB = getReturns(b);
                return rB - rA;
            });
        };

        matchCat = sortFunds(matchCat);
        others = sortFunds(others);

        const finalPool = targetFund ? [...matchCat, ...others] : [...others];
        return finalPool.slice(offset, offset + desired);

    } catch (e) {
        console.error("Error en busqueda directa V3:", e);
        return [];
    }
}
