import { PortfolioItem } from "../types";

/**
 * Calculates a portfolio's expected return and volatility (risk) algebraically
 * using given weights and a pre-calculated Covariance matrix and Returns vector.
 * 
 * This allows real-time interactive plotting of the "Red Point" on the Efficient Frontier
 * without querying the Python backend on every keystroke.
 * 
 * @param manualWeights Array or record mapping ISIN to decimal weight (e.g. 0.20 for 20%)
 * @param expectedReturns Record mapping ISIN to annualized expected return scalar
 * @param covarianceMatrix 2D Array or mapping representing the N x N covariance matrix 
 * @param orderedIsins The exact ordered list of ISINs used to construct the covariance array
 * @returns { x: volatility (risk), y: return } or null if data is invalid/missing
 */
export function calculatePortfolioPoint(
    manualWeights: Record<string, number>,
    expectedReturns: Record<string, number>,
    covarianceMatrix: number[][],
    orderedIsins: string[]
): { x: number, y: number } | null {

    try {
        if (!orderedIsins || orderedIsins.length === 0 || !covarianceMatrix || covarianceMatrix.length === 0) {
            return null;
        }

        const size = orderedIsins.length;

        // 1. Build the Normalized Weight Vector (W)
        let totalWeight = 0;
        const w: number[] = new Array(size).fill(0);

        for (let i = 0; i < size; i++) {
            const isin = orderedIsins[i];
            const weightRaw = manualWeights[isin] || 0;
            // Since the next step explicitly forces all weights to sum to 1.0, 
            // no conditional scaling is needed. Scale differences like 99 and 1 
            // vs 0.99 and 0.01 will be mathematically equalized correctly.
            w[i] = weightRaw;
            totalWeight += w[i];
        }

        if (totalWeight <= 0) return null;

        // Maintain raw interactive scale to match backend.
        // If the user inputs 25%, 25% (total 50%), the point should reflect 50% scale,
        // rather than mutating to 50%/50% internally which would inflate risk/return artificially.

        // 2. Calculate Portfolio Return (W^T * Mu)
        let portfolioReturn = 0;
        for (let i = 0; i < size; i++) {
            const isin = orderedIsins[i];
            const mu = expectedReturns[isin] || 0;
            portfolioReturn += w[i] * mu;
        }

        // 3. Calculate Portfolio Volatility (Variance = W^T * Sig * W)
        let portfolioVariance = 0;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                // S[i][j] is the covariance between asset i and asset j
                const cov = covarianceMatrix[i][j] || 0;
                portfolioVariance += w[i] * w[j] * cov;
            }
        }

        // Volatility is standard deviation (sqrt of variance)
        const portfolioVolatility = Math.sqrt(portfolioVariance);

        // Round to 4 decimal places for consistency with PyPortfolioOpt
        return {
            x: Number(portfolioVolatility.toFixed(4)),
            y: Number(portfolioReturn.toFixed(4))
        };

    } catch (e) {
        console.error("[PortfolioAnalyticsEngine] Algebraic simulation failed:", e);
        return null;
    }
}
