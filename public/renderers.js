// renderers.js - MOTOR DE RENDERIZADO (VISTA)
import { formatCurrency } from './ui.js'; // [Corrección] Importar desde UI para evitar dependencia circular
import { renderAllocationDonut } from './chartEngine.js';

// --- 1. TABLA DE COSTES ---
export function renderCostsTable(portfolio, totalCapital, globalCoef) {
    const tbody = document.getElementById('costs-table-body');
    if (!tbody) return;
    
    let totalRetroEUR = 0;

    tbody.innerHTML = portfolio.map(f => { //
        if (f.weight <= 0) return '';
        const retroPercent = f.costs?.retrocession || 0.5;
        const retroEUR = (retroPercent / 100) * (f.weight / 100) * totalCapital * globalCoef;
        totalRetroEUR += retroEUR;

        return `
        <tr class="border-b border-slate-50 text-[10px]">
            <td class="px-4 py-2 truncate max-w-[150px] text-slate-600">${f.name}</td>
            <td class="px-4 py-2 text-right font-mono">${f.weight.toFixed(1)}%</td>
            <td class="px-4 py-2 text-right font-mono text-violet-500">${retroPercent.toFixed(2)}%</td>
            <td class="px-4 py-2 text-right font-mono font-bold">${formatCurrency(retroEUR)}</td>
        </tr>`;
    }).join('');

    // Actualizar Totales en DOM
    const totalRetroPercent = totalCapital > 0 ? (totalRetroEUR / totalCapital) * 100 : 0;
    
    const elPercent = document.getElementById('total-retro-percent');
    if (elPercent) elPercent.textContent = totalRetroPercent.toFixed(2) + '%';
    
    const elAmount = document.getElementById('total-retro-amount');
    if (elAmount) elAmount.textContent = formatCurrency(totalRetroEUR);
    
    const elFinal = document.getElementById('final-cost-result');
    if (elFinal) elFinal.textContent = formatCurrency(totalRetroEUR);
}

// --- 2. STYLE BOX (Cuadrícula de Estilo) ---
export function renderStyleBox(portfolio) {
    const grid = document.getElementById('style-box-grid');
    const label = document.getElementById('style-box-label');
    if (!grid) return;
    
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = "bg-slate-100 border border-slate-200 rounded-sm transition-colors";
        grid.appendChild(cell);
    }

    const rvFunds = portfolio.filter(f => { //
        const type = f.manual_type || f.assetClass || 'Other';
        const equity = (f.metrics && f.metrics.equity) ? f.metrics.equity : 0;
        return (type.includes('RV') || equity > 50) && f.weight > 0;
    });
    
    if (rvFunds.length === 0) { 
        if (label) label.textContent = "N/A"; 
        return; 
    }

    let scoreX = 0, scoreY = 0, totalW = 0;
    rvFunds.forEach(f => {
        let x = 1, y = 1; 
        
        if (f.style && typeof f.style === 'object') {
            const size = String(f.style.market_cap || "").toLowerCase();
            const invStyle = String(f.style.investment_style || "").toLowerCase();
            if(size.includes('large')) y = 0; else if(size.includes('small')) y = 2; else y = 1;
            if(invStyle.includes('value')) x = 0; else if(invStyle.includes('growth')) x = 2; else x = 1;
        } else {
            const s = String(f.style || "").toLowerCase(); 
            if(s.includes('value')) x = 0; else if(s.includes('growth')) x = 2;
            const m = String(f.marketCap || f.cap_size || "").toLowerCase();
            if(m.includes('mid')) y = 1; else if(m.includes('small')) y = 2; else y = 0; 
        }
        
        scoreX += x * f.weight; 
        scoreY += y * f.weight; 
        totalW += f.weight;
    });

    if (totalW === 0) return;
    
    const safeX = Math.max(0, Math.min(2, Math.round(scoreX / totalW)));
    const safeY = Math.max(0, Math.min(2, Math.round(scoreY / totalW)));
    const finalIndex = (safeY * 3) + safeX;
    
    if (grid.children[finalIndex]) {
        grid.children[finalIndex].classList.remove('bg-slate-100');
        grid.children[finalIndex].classList.add('bg-blue-600', 'shadow-lg', 'scale-110');
    }
    
    const sizes = ["Large", "Mid", "Small"];
    const styles = ["Value", "Blend", "Growth"];
    if (label) label.textContent = `${sizes[safeY]} ${styles[safeX]}`;
}

// --- 3. TABLA PRINCIPAL DE CARTERA ---
export function renderPortfolioTable(portfolio, totalAmount) {
    const tbody = document.getElementById('portfolio-table-body');
    if (!tbody) return;

    let sumW = 0;
    tbody.innerHTML = portfolio.map(f => { //
        sumW += f.weight;
        return `
        <tr class="hover:bg-slate-50 border-b border-slate-50 group">
            <td class="px-6 py-3 cursor-pointer" onclick="window.openModal(document.getElementById('fund-details-modal'), '${f.isin}')">
                <div class="font-bold text-slate-700 text-xs leading-tight whitespace-normal">${f.name}</div>
            </td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                    <input type="number" step="0.5" min="0" max="100" 
                        class="w-14 text-right font-bold text-blue-600 border-b border-blue-100 focus:border-blue-500 outline-none bg-transparent py-0.5 text-xs transition-colors hover:border-blue-300" 
                        value="${f.weight.toFixed(1)}" 
                        onchange="window.updateFundWeight('${f.isin}', this.value)" 
                        onclick="this.select()">
                    <span class="text-xs text-blue-400 font-bold">%</span>
                </div>
            </td>
            <td class="px-6 py-3 text-right font-mono text-slate-600">${formatCurrency((f.weight/100)*totalAmount)}</td>
            <td class="px-4 py-3 text-right">
                <button onclick="window.removeFund('${f.isin}')" class="text-slate-300 hover:text-rose-500 text-lg">&times;</button>
            </td>
        </tr>`;
    }).join(''); 
    
    const footerW = document.getElementById('footer-total-weight');
    if (footerW) {
        footerW.textContent = sumW.toFixed(2) + '%';
        footerW.className = Math.abs(sumW - 100) > 0.1 ? 'font-black text-sm text-rose-500' : 'font-black text-sm text-slate-800';
    }
    
    document.getElementById('footer-total-amount').textContent = formatCurrency(totalAmount);
}

// --- 4. PANEL DE ASIGNACIÓN ---
export function renderAllocationPanel(allocation) {
     renderAllocationDonut(allocation);
}