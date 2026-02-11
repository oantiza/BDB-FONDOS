
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { PortfolioItem } from "../types";

export type Period = "1y" | "3y" | "5y" | "10y";

export interface BacktestRequest {
  portfolio: { isin: string; weight: number }[];
  period: Period;
  benchmarks?: string[];
}

export interface MultiBacktestRequest {
  portfolio: { isin: string; weight: number }[];
  periods: Period[];
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
  warnings?: string[]; // [NEW] Short history warnings
}

export interface MultiBacktestResponse {
  allocations?: {
    topHoldings?: { isin: string; name: string; weight: number }[];
    regionAllocation?: { name: string; value: number }[];
  };
  [key: string]: BacktestResponse | unknown;
}

// -------------------------
// Cache (in-flight + TTL)
// -------------------------
type CacheEntry = { p: Promise<any>; ts: number };
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

function makeKey(req: BacktestRequest | MultiBacktestRequest) {
  const p = 'periods' in req ? (req as MultiBacktestRequest).periods.join(',') : (req as BacktestRequest).period;
  return `${p}|${stablePortfolioKey(req.portfolio)}|${stableBenchmarksKey(
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
  // Legacy Wrapper if needed, or keeping it for single calls
  const key = makeKey(req);

  const existing = cache.get(key);
  if (existing && isFresh(existing.ts)) return existing.p;

  const p = (async () => {
    try {
      const fn = httpsCallable<BacktestRequest, unknown>(functions, "backtest_portfolio");
      const res = await fn(req);
      return normalizeResponse((res as { data: unknown })?.data);
    } catch (e: unknown) {
      let msg = "Error desconocido llamando al backtest.";
      if (e instanceof Error) msg = e.message;
      return { error: msg };
    }
  })();

  cache.set(key, { p, ts: Date.now() });
  return p;
}

export async function backtestPortfolioMulti(
  req: MultiBacktestRequest
): Promise<MultiBacktestResponse> {
  const key = makeKey(req);

  const existing = cache.get(key);
  if (existing && isFresh(existing.ts)) return existing.p;

  const p = (async () => {
    try {
      const fn = httpsCallable<MultiBacktestRequest, unknown>(functions, "backtest_portfolio_multi");
      const res = await fn(req);
      return (res as { data: unknown })?.data as MultiBacktestResponse;
    } catch (e: unknown) {
      let msg = "Error desconocido llamando al backtest multi.";
      if (e instanceof Error) msg = e.message;
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

  // Prepare periods to fetch
  const requestedPeriods: Period[] = ["3y", "5y", "10y"]; // We need 10y for charts potentially? Or just max?
  // Dashboard usually shows 5y chart default?
  // Let's request all we need.
  if (opts?.include1y) requestedPeriods.push("1y");

  // SINGLE CALL
  const multiRes = await backtestPortfolioMulti({
    portfolio: p,
    periods: requestedPeriods,
    benchmarks
  });

  if ((multiRes as any).error) {
    console.error("Multi-Backtest Error:", (multiRes as any).error);
    return {
      series5y: [], series10y: [],
      metrics1y: null, metrics3y: null, metrics5y: null, metrics10y: null,
      regionAllocation: [], warnings: [], raw: {}
    };
  }

  // Extract Allocations (Shared)
  const allocations = multiRes.allocations || {};
  const regionAllocation = allocations.regionAllocation || [];
  const topHoldings = allocations.topHoldings || [];

  // Extract Periods
  const r1y = normalizeResponse(multiRes['1y']);
  const r3y = normalizeResponse(multiRes['3y']);
  const r5y = normalizeResponse(multiRes['5y']);
  const r10y = normalizeResponse(multiRes['10y']);

  // Inject shared allocations back into individual responses if needed, 
  // but DashboardPage might use them from specific period props.
  // Actually getDashboardAnalytics returns a flattened object used by the hook.

  return {
    series5y: r5y.portfolioSeries ?? [],
    series10y: r10y.portfolioSeries ?? [],
    metrics1y: r1y?.metrics ?? null,
    metrics3y: r3y.metrics ?? null,
    metrics5y: r5y.metrics ?? null,
    metrics10y: r10y.metrics ?? null,

    // Use shared allocation
    regionAllocation: regionAllocation,
    topHoldings: topHoldings, // Expose if needed

    // Aggregate warnings
    warnings: [...(r10y.warnings || []), ...(r5y.warnings || []), ...(r3y.warnings || []), ...(r1y.warnings || [])],

    raw: { r1y, r3y, r5y, r10y }
  };
}
