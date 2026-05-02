import { useState, useEffect } from 'react';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SavedPortfolio } from './useSavedPortfolios';

export function useSyntheticBenchmarks() {
    const [benchmarks, setBenchmarks] = useState<SavedPortfolio[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'synthetic_benchmarks'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const b = doc.data();
                return {
                    id: doc.id,
                    name: `Benchmark: ${b.name || doc.id}`, // e.g. "Benchmark: MODERADO"
                    createdAt: new Date(),
                    totalCapital: 100000,
                    // Special flag to identify it as a benchmark in the comparator
                    isBenchmark: true,
                    // Embed the raw history and metrics so PortfolioComparator doesn't need to fetch them
                    benchmarkData: {
                        metrics: b.std_perf,
                        history: b.history
                    },
                    // Fake a single holding to satisfy the UI that expects array of items
                    items: [
                        {
                            isin: doc.id,
                            name: `Benchmark Sintético ${b.name}`,
                            weight: 1,
                            amount: 100000,
                            asset_class: 'Benchmark',
                            category_morningstar: 'Benchmark Sintético',
                            // Add some dummy properties to avoid crashes in child components
                            derived: { asset_class: 'Benchmark', primary_region: 'Global' }
                        }
                    ]
                };
            }) as any[]; // Cast as 'any' then back to satisfy SavedPortfolio + our extra fields

            // Sort by risk profile if possible (Conservador -> Moderado -> Equilibrado -> Dinamico -> Agresivo)
            const order = ['CONSERVADOR', 'MODERADO', 'EQUILIBRADO', 'DINAMICO', 'AGRESIVO'];
            data.sort((a, b) => {
                const idA = a.id;
                const idB = b.id;
                const iA = order.indexOf(idA);
                const iB = order.indexOf(idB);
                if (iA !== -1 && iB !== -1) return iA - iB;
                return a.name.localeCompare(b.name);
            });

            setBenchmarks(data);
            setLoading(false);
        }, (err) => {
            console.error("Error loading benchmarks:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { benchmarks, loading };
}
