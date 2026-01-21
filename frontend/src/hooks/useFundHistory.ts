import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface HistoryPoint {
    date: Date;
    price: number;
}


// Simple in-memory cache to prevent re-fetching the same history
const GLOBAL_CACHE: Record<string, HistoryPoint[]> = {};

export function useFundHistory(isins: string[]) {
    // Initialize state with cached data if available
    const [historyData, setHistoryData] = useState<Record<string, HistoryPoint[]>>(() => {
        const initial: Record<string, HistoryPoint[]> = {};
        isins.forEach(isin => {
            if (GLOBAL_CACHE[isin]) {
                initial[isin] = GLOBAL_CACHE[isin];
            }
        });
        return initial;
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            // Filter out ISINs we already have in cache/state
            const missingIsins = isins.filter(isin => !GLOBAL_CACHE[isin] && !historyData[isin]);

            if (missingIsins.length === 0) {
                // If we have everything, just ensure state is synced (already done in init, but for updates)
                // Actually, if missingIsins is empty, we are done.
                return;
            }

            setLoading(true);
            const newHistory: Record<string, HistoryPoint[]> = {};

            await Promise.all(missingIsins.map(async (isin) => {
                try {
                    const docRef = doc(db, 'historico_vl_v2', isin);
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const data = snap.data();
                        const rawSeries = data.history || data.series || [];

                        // Optimize parsing loop
                        const parsedSeries = new Array(rawSeries.length);
                        let validCount = 0;

                        for (let i = 0; i < rawSeries.length; i++) {
                            const item = rawSeries[i];
                            // Date Parsing - fast path for Firestore Timestamp
                            let d: Date;
                            if (item.date && typeof item.date.toDate === 'function') {
                                d = item.date.toDate();
                            } else {
                                d = new Date(item.date);
                            }

                            const val = item.nav !== undefined ? +item.nav : +item.price;

                            if (!isNaN(val) && val > 0) {
                                parsedSeries[validCount++] = { date: d, price: val };
                            }
                        }

                        // Trim and sort
                        parsedSeries.length = validCount;
                        parsedSeries.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

                        newHistory[isin] = parsedSeries;
                        // Update Cache
                        GLOBAL_CACHE[isin] = parsedSeries;
                    }
                } catch (err) {
                    console.error(`Error fetching history for ${isin}:`, err);
                }
            }));

            // Only update state if we actually fetched something new
            if (Object.keys(newHistory).length > 0) {
                setHistoryData(prev => ({ ...prev, ...newHistory }));
            }
            setLoading(false);
        };

        fetchHistory();
    }, [isins]); // Dependency array usually stable

    return { historyData, loading };
}

