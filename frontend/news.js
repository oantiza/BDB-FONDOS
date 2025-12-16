import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

let functionsInstance = null;

export function initNewsModule(functions) {
    functionsInstance = functions; 
    
    // 1. Botón Campana (Navbar)
    const bellBtn = document.getElementById('btn-news-bell');
    if (bellBtn) {
        // Clonación para limpiar listeners viejos
        const newBell = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBell, bellBtn);
        newBell.addEventListener('click', openNewsModal);
    }

    // 2. Dropdown Macro
    const macroSelect = document.getElementById('news-macro-select');
    if (macroSelect) {
        macroSelect.addEventListener('change', () => {
            // Limpiar input de ticker para que el usuario sepa que busca macro
            const tickerInput = document.getElementById('news-ticker-input');
            if(tickerInput) tickerInput.value = ''; 
            loadNews('macro');
        });
    }

    // 3. Botón Buscar (Ticker/Empresa)
    const btnSearch = document.getElementById('btn-search-news');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => loadNews('ticker'));
    }
    
    // 4. Enter en el input de Ticker
    const inputTicker = document.getElementById('news-ticker-input');
    if(inputTicker) {
        inputTicker.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadNews('ticker');
        });
    }
}

export function openNewsModal() {
    // Usamos el sistema de modales global
    if(window.openModal) {
        window.openModal('news-modal');
        // Reset inicial a noticias generales
        const sel = document.getElementById('news-macro-select');
        const inp = document.getElementById('news-ticker-input');
        if(sel) sel.value = 'general';
        if(inp) inp.value = '';
        loadNews('macro');
    }
}

async function loadNews(type) {
    if(!functionsInstance) return;
    
    const container = document.getElementById('news-general-container');
    const select = document.getElementById('news-macro-select');
    const input = document.getElementById('news-ticker-input');
    
    let query = '';
    let mode = 'general';

    // Lógica de parámetros
    if (type === 'macro') {
        query = select ? select.value : 'general'; 
        mode = 'general';     
    } else if (type === 'ticker') {
        query = input ? input.value.trim().toUpperCase() : '';
        if(!query) return; // Evitar búsquedas vacías
        mode = 'ticker';      
    }

    // Estado de Carga
    if(container) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-50">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B2545] mb-4"></div>
                <p class="text-xs font-bold text-slate-500 animate-pulse">
                    Analizando feed de noticias (${query || 'General'})...
                </p>
            </div>`;
    }
    
    try {
        const fn = httpsCallable(functionsInstance, 'getFinancialNews');
        // Enviamos query y mode al backend (Python)
        const res = await fn({ query: query, mode: mode });
        
        if(res.data.articles && res.data.articles.length > 0) {
            renderNewsList(res.data.articles, container);
        } else {
            if(container) {
                container.innerHTML = `
                    <div class="text-center py-20">
                        <p class="text-4xl mb-2">📭</p>
                        <p class="text-slate-500 text-sm">No se encontraron noticias recientes para "<b>${query}</b>".</p>
                        <p class="text-slate-400 text-xs mt-1">Prueba con otro término, categoría o ticker.</p>
                    </div>`;
            }
        }
    } catch(e) {
        console.error(e);
        if(container) container.innerHTML = '<div class="text-center py-20 text-rose-500 text-sm font-bold">Error de conexión con el proveedor de noticias.</div>';
    }
}

function renderNewsList(articles, container) {
    if(!container) return;
    container.innerHTML = articles.map(a => {
        // Simulación de sentimiento para borde de color
        const sentiment = Math.random() > 0.5 ? 'positive' : (Math.random() > 0.5 ? 'neutral' : 'negative');
        const borderCol = sentiment === 'positive' ? 'bg-emerald-500' : (sentiment === 'negative' ? 'bg-rose-500' : 'bg-slate-300');
        
        return `
        <div class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group relative pl-5 overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${borderCol}"></div>
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                    <span class="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">${a.source || 'News'}</span>
                    <span class="text-[10px] text-slate-400 font-mono">${a.date ? new Date(a.date).toLocaleDateString() : 'Hoy'}</span>
                </div>
            </div>
            <a href="${a.link || '#'}" target="_blank" class="block">
                <h4 class="text-sm font-bold text-[#0B2545] leading-tight mb-2 group-hover:text-blue-700 transition-colors font-serif">${a.title}</h4>
                <p class="text-xs text-slate-500 leading-relaxed line-clamp-2">${a.summary || 'Click para leer el artículo completo...'}</p>
            </a>
        </div>
    `}).join('');
}