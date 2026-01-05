import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface HistoryPoint {
    date: Date;
    price: number;
}

export function useFundHistory(isins: string[]) {
    const [historyData, setHistoryData] = useState<Record<string, HistoryPoint[]>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (isins.length === 0) return;

            setLoading(true);
            const newHistory: Record<string, HistoryPoint[]> = {};

            // Only fetch what we don't have? Or just simple fetch for now.
            // Check cache or state? For now, fetch all selected.

            await Promise.all(isins.map(async (isin) => {
                if (historyData[isin]) {
                    newHistory[isin] = historyData[isin];
                    return;
                }

                try {
                    const docRef = doc(db, 'historico_vl_v2', isin);
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const data = snap.data();
                        const rawSeries = data.series || [];

                        // Parse series: [{date: '2023-01-01', price: 100}, ...]
                        const parsedSeries = rawSeries.map((item: any) => {
                            // Handle various date formats if needed, usually string 'YYYY-MM-DD' or Timestamp
                            let d: Date;
                            if (item.date?.toDate) d = item.date.toDate();
                            else if (typeof item.date === 'string') d = new Date(item.date);
                            else d = new Date(item.date); // Timestamp or number

                            return {
                                date: d,
                                price: Number(item.price)
                            };
                        }).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

                        newHistory[isin] = parsedSeries;
                    } else {
                        // console.warn(`No history found for ${isin} in historico_vl_v2`);
                    }
                } catch (err) {
                    console.error(`Error fetching history for ${isin}:`, err);
                }
            }));

            setHistoryData(prev => ({ ...prev, ...newHistory }));
            setLoading(false);
        };

        fetchHistory();
    }, [isins]); // Re-run when selection changes

    return { historyData, loading };
}
