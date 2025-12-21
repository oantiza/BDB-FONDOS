// src/types/MacroReport.ts

export type ReportType = 'WEEKLY' | 'MONTHLY';
export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALCISTA' | 'BAJISTA';
export type View = 'Sobreponderar' | 'Neutral' | 'Infraponderar' | 'OVERWEIGHT' | 'UNDERWEIGHT';
export type Impact = 'ALTO' | 'MEDIO' | 'BAJO';

// --- Sub-interfaces ---

export interface MarketPulseItem {
  focus: string; // ej: "EUR/USD" o "Brent"
  trend: Sentiment;
  note?: string;
}

export interface DriverEvent {
  day: string;
  event: string;
  impact: Impact;
}

export interface RiskFlags {
  geopolitics: boolean;
  credit: boolean;
  liquidity: boolean;
}

export interface AnalysisSection {
  title: string;
  key_metric: string;
  content: string;
}

export interface PortfolioProposal {
  asset_class: string;
  region: string;
  view: View;
  weight: number;
  rationale: string;
}

export interface AllocationSummary {
  equity: number;
  fixed_income: number;
  commodities_gold: number;
  cash: number;
}

// --- INTERFAZ PRINCIPAL (EL DOCUMENTO EN FIRESTORE) ---

export interface MacroReport {
  id?: string;
  // Metadatos obligatorios
  type: ReportType;
  date: string;       // YYYY-MM-DD
  title: string;
  provider?: string;  // ej: "J.P. Morgan"
  pdfUrl?: string;    // URL público del PDF generado
  createdAt?: any;    // Firestore Timestamp
  originalFileName?: string;

  // Resumen Global (Común)
  market_sentiment: Sentiment;
  executive_summary: string;

  // --- CAMPOS ESPECÍFICOS SEMANAL (Opcionales) ---
  market_pulse?: {
    currencies: MarketPulseItem;
    commodities: MarketPulseItem;
    gold_metals: MarketPulseItem;
  };
  drivers_calendar?: DriverEvent[];
  risk_flags?: RiskFlags;

  // --- CAMPOS ESPECÍFICOS MENSUAL (Opcionales) ---
  investment_thesis?: string;
  macro_analysis?: {
    rates: AnalysisSection;
    equity_valuation: AnalysisSection;
    credit_risk: AnalysisSection;
    flows_positioning: AnalysisSection;
    currencies_commodities: AnalysisSection;
  };
  model_portfolio?: PortfolioProposal[];
  allocation_summary?: AllocationSummary;

  // --- NUEVOS CAMPOS DEEP RESEARCH 2.0 ---
  regime?: string;
  geopolitics?: { summary: string; impact: string };
  catalysts_next_week?: { day: string; event: string; importance: string }[];
  structural_trends?: string;
  tail_risks?: { risk: string; probability: string; impact: string }[];
  asset_allocation?: { asset: string; view: string; rationale: string }[];

  // --- CAMPOS ESPECÍFICOS ESTRATEGIA (NEW TAB) ---
  house_view_summary?: string;
  equity?: { geo: any[]; sectors: any[] };
  fixed_income?: { subsectors: any[]; geo: any[] };
  real_assets?: { currencies: any[]; commodities: any[] };

  // --- CAMPOS DE GRÁFICO (CHART) ---
  chart_data?: { label: string; value: number; max: number; unit: string };
  asset_allocation_summary?: string;
}