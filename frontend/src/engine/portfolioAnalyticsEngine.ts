import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { PortfolioItem } from "../types";

export type Period = "1y" | "3y" | "5y" | "10y";

export interface BacktestRequest {
  portfolio: { isin: string; weight: number }[];
  period: Period;
  benchmarks?: string[];
}

export interface BacktestResponse {
  portfolioSeries?: { x: string; y: number }[];
  metrics?: {
    volatility?: number; // decimal: 0.0897
    sharpe?: number; // 1.18
    maxDrawdown?: number; // -0.14 o 0.14 o 14.0 -> se normaliza en UI
    cagr?: number; // decimal: 0.1253
  };
  regionAllocation?: { name: string; value: number }[];
  topHoldings?: { isin: string; name: string; weight: number }[];
  error?: string;
  status?: string;
  missing_assets?: string[];
}

// -------------------------
// Cache (in-flight + TTL)
// -------------------------
type CacheEntry = { p: Promise<BacktestResponse>; ts: number };
const cache = new Map<string, CacheEntry>();

// TTL conservador (ms). Ajusta si quieres.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function stablePortfolioKey(portfolio: { isin: string; weight: number }[]) {
  // Normaliza orden + peso redondeado para evitar keys inestables por floats.
  return JSON.stringify(
    [...portfolio]
      .map((p) => ({ isin: p.isin, w: Math.round(p.weight * 1e6) / 1e6 }))
      .sort((a, b) => a.isin.localeCompare(b.isin))
  );
}

function stableBenchmarksKey(benchmarks?: string[]) {
  const b = Array.isArray(benchmarks) ? benchmarks : [];
  return JSON.stringify([...b].map(String).sort());
}

function makeKey(req: BacktestRequest) {
  return `${req.period}|${stablePortfolioKey(req.portfolio)}|${stableBenchmarksKey(
    req.benchmarks
  )}`;
}

function isFresh(ts: number) {
  return Date.now() - ts < CACHE_TTL_MS;
}

function normalizeResponse(data: unknown): BacktestResponse {
  if (!data || typeof data !== 'object') return { error: "Respuesta vacía o inválida del servidor." };

  const response = data as Record<string, unknown>;

  // Error explícito
  if (response.error) return { error: String(response.error) };

  // Caso conocido del backend
  if (response.status === "no_common_history") {
    const missing = Array.isArray(response.missing_assets) ? (response.missing_assets as string[]) : [];
    return {
      status: "no_common_history",
      missing_assets: missing,
      error: `Histórico insuficiente: ${missing.join(", ") || "Desconocido"}`,
    };
  }

  // Respuesta “normal”
  return data as BacktestResponse;
}

export async function backtestPortfolio(
  req: BacktestRequest
): Promise<BacktestResponse> {
  const key = makeKey(req);

  const existing = cache.get(key);
  if (existing && isFresh(existing.ts)) return existing.p;

  const p = (async () => {
    try {
      const fn = httpsCallable<BacktestRequest, unknown>(functions, "backtest_portfolio");
      const res = await fn(req);
      return normalizeResponse((res as { data: unknown })?.data);
    } catch (e: unknown) {
      // Firebase errors suelen venir como e.message
      let msg = "Error desconocido llamando al backtest.";
      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === 'object' && e !== null && 'message' in e) {
        msg = String((e as { message: unknown }).message);
      }
      return { error: msg };
    }
  })();

  cache.set(key, { p, ts: Date.now() });
  return p;
}

export async function getDashboardAnalytics(
  portfolio: PortfolioItem[],
  opts?: { include1y?: boolean; benchmarks?: string[] }
) {
  const p = portfolio.map((x) => ({ isin: x.isin, weight: x.weight }));
  const benchmarks = opts?.benchmarks;

  // 10y, 5y, 3y en paralelo.
  // We fetch 10y to have maximum history for charts.
  const [r10y, r5y, r3y] = await Promise.all([
    backtestPortfolio({ portfolio: p, period: "10y", benchmarks }),
    backtestPortfolio({ portfolio: p, period: "5y", benchmarks }),
    backtestPortfolio({ portfolio: p, period: "3y", benchmarks }),
  ]);

  // 1y opcional
  const r1y = opts?.include1y
    ? await backtestPortfolio({ portfolio: p, period: "1y", benchmarks })
    : null;

  return {
    series5y: r5y.portfolioSeries ?? [],
    series10y: r10y.portfolioSeries ?? [],
    metrics1y: r1y?.metrics ?? null,
    metrics3y: r3y.metrics ?? null,
    metrics5y: r5y.metrics ?? null,
    metrics10y: r10y.metrics ?? null,
    raw: { r1y, r3y, r5y, r10y },
  };
}
