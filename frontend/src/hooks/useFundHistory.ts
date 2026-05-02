import { useState, useEffect, useRef } from 'react';
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

    // Use a ref to keep track of the latest historyData without triggering effect re-runs
    const historyDataRef = useRef(historyData);
    useEffect(() => {
        historyDataRef.current = historyData;
    }, [historyData]);

    useEffect(() => {
        const fetchHistory = async () => {
            // Check what we need to fetch vs what we just need to copy from cache
            const missingIsins = isins.filter(isin => !GLOBAL_CACHE[isin]);
            
            // First, immediately sync anything we have in cache that isn't in state
            let newState: Record<string, HistoryPoint[]> | null = null;
            for (const isin of isins) {
                if (GLOBAL_CACHE[isin] && !historyDataRef.current[isin]) {
                    if (!newState) newState = {};
                    newState[isin] = GLOBAL_CACHE[isin];
                }
            }
            if (newState) {
                setHistoryData(prev => ({ ...prev, ...newState! }));
            }

            if (missingIsins.length === 0) {
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
    }, [isins]); // Restored to only depend on isins
    
    return { historyData, loading };
}

