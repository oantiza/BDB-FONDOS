import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase"; // ajusta tu import real

type PresenceMap = Record<string, boolean>;

const LS_KEY = "historyPresence:v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function loadCache(): { ts: number; data: PresenceMap } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data: PresenceMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

// Concurrencia limitada para no saturar Firestore
async function runWithLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<void>
) {
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export function useHistoryPresence(isins: string[]) {
  const [map, setMap] = useState<PresenceMap>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(0);

  const isinsKey = useMemo(() => isins.slice().sort().join("|"), [isins]);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    async function run() {
      if (!isins?.length) {
        setMap({});
        setDone(0);
        return;
      }

      setLoading(true);
      setDone(0);

      const cache = loadCache();
      const cacheValid = cache && Date.now() - cache.ts < TTL_MS;
      const base: PresenceMap = cacheValid ? { ...cache!.data } : {};

      // ISINs que faltan en caché o se quiere recomprobar
      const missing = isins.filter((isin) => base[isin] === undefined);

      // Publica lo que ya sabemos
      setMap((prev) => ({ ...prev, ...base }));

      let completed = 0;

      await runWithLimit(missing, 20, async (isin) => {
        if (abortRef.current) return;

        try {
          const snap = await getDoc(doc(db, "historico_vl_v2", isin));
          let has = false;

          if (snap.exists()) {
            const d: any = snap.data();
            const arr1 = Array.isArray(d?.history) ? d.history : null;
            const arr2 = Array.isArray(d?.series) ? d.series : null;
            has = (arr1 && arr1.length > 0) || (arr2 && arr2.length > 0);
          }

          base[isin] = has;

          if (!abortRef.current) {
            setMap((prev) => ({ ...prev, [isin]: has }));
          }
        } catch {
          // Si hay error puntual, marcamos como false (o podrías dejar undefined)
          base[isin] = false;
          if (!abortRef.current) setMap((prev) => ({ ...prev, [isin]: false }));
        } finally {
          completed++;
          if (!abortRef.current) setDone(completed);
        }
      });

      if (!abortRef.current) {
        saveCache(base);
        setLoading(false);
      }
    }

    run();

    return () => {
      abortRef.current = true;
    };
  }, [isinsKey]);

  return {
    presenceMap: map,
    loading,
    progress: { done, total: isins.length },
  };
}
