import { describe, it, expect } from "vitest";
import { generateSmartPortfolio } from "./rulesEngine";
import { Fund } from "../types";

describe("rulesEngine", () => {
  const createFund = (
    isin: string,
    assetClass: "RV" | "RF" | "Monetario" | "Mixto" | "Retorno Absoluto" | "Otros",
    vol = 0.12,
    sharpe = 1.0,
    cagr3y = 0.05
  ): Fund =>
    ({
      isin,
      name: `Fund ${isin} ${assetClass}`,
      derived: { asset_class: assetClass },
      std_perf: { volatility: vol, sharpe, cagr3y },
      data_quality: { history_ok: true },
    } as any);

  const countByClass = (portfolio: any[], cls: string) =>
    portfolio.filter((p) => (p?.derived?.asset_class || "").toUpperCase() === cls.toUpperCase()).length;

  const weightsSum = (portfolio: any[]) =>
    portfolio.reduce((s, p) => s + (Number(p.weight) || 0), 0);

  it("returns exactly N funds when universe is sufficient (hard guarantee)", () => {
    const allRV: Fund[] = Array.from({ length: 200 }, (_, i) =>
      createFund(`RV${i + 1}`, "RV", 0.15, 1.0, 0.08)
    );

    const N = 16;
    const portfolio = generateSmartPortfolio(10, allRV, N);

    expect(portfolio.length).toBe(N);
    expect(weightsSum(portfolio)).toBeCloseTo(100, 0.5);
  });

  it("enforces hard min/max buckets for Risk 1 with N=16", () => {
    // Mucho universo en cada bucket para que la restricción sea lo que manda
    const universe: Fund[] = [
      ...Array.from({ length: 200 }, (_, i) => createFund(`MON${i + 1}`, "Monetario", 0.01, 1.0, 0.02)),
      ...Array.from({ length: 200 }, (_, i) => createFund(`RF${i + 1}`, "RF", 0.03, 1.0, 0.03)),
      ...Array.from({ length: 200 }, (_, i) => createFund(`MIX${i + 1}`, "Mixto", 0.10, 1.0, 0.05)),
      ...Array.from({ length: 200 }, (_, i) => createFund(`RV${i + 1}`, "RV", 0.18, 1.0, 0.09)),
      ...Array.from({ length: 200 }, (_, i) => createFund(`RA${i + 1}`, "Retorno Absoluto", 0.12, 1.0, 0.06)),
    ];

    const N = 16;
    const p = generateSmartPortfolio(1, universe, N);

    expect(p.length).toBe(N);

    // Risk 1 (Preservación):
    // Monetario min 40% => ceil(0.4*16)=7
    // RF min 20% => ceil(0.2*16)=4
    // RV max 10% => floor(0.1*16)=1
    // Mixto max 20% => floor(0.2*16)=3
    // Retorno Absoluto max 10% => floor(0.1*16)=1
    expect(countByClass(p, "Monetario")).toBeGreaterThanOrEqual(7);
    expect(countByClass(p, "RF")).toBeGreaterThanOrEqual(4);
    expect(countByClass(p, "RV")).toBeLessThanOrEqual(1);
    expect(countByClass(p, "Mixto")).toBeLessThanOrEqual(3);
    expect(countByClass(p, "Retorno Absoluto")).toBeLessThanOrEqual(1);

    expect(weightsSum(p)).toBeCloseTo(100, 0.5);
  });

  it("when universe is smaller than requested, returns what it can and weights sum to 100", () => {
    const tiny: Fund[] = [
      createFund("RV1", "RV", 0.15, 1.0, 0.08),
      createFund("RV2", "RV", 0.15, 1.0, 0.08),
      createFund("RF1", "RF", 0.03, 1.0, 0.03),
    ];

    const portfolio = generateSmartPortfolio(10, tiny, 5);

    expect(portfolio.length).toBe(tiny.length); // no puede inventar fondos
    expect(weightsSum(portfolio)).toBeCloseTo(100, 0.5);
  });
});
