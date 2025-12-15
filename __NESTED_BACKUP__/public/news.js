import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

let functionsInstance = null;

export function initNewsModule(functions) {
    functionsInstance = functions; 
    
    // Botón Campana (Navbar)
    const bellBtn = document.getElementById('btn-news-bell');
    if (bellBtn) {
        const newBell = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBell, bellBtn);
        newBell.addEventListener('click', openNewsModal);
    }

    // Botón Buscar (Dentro del Modal)
    const btnSearch = document.getElementById('btn-search-news');
    if (btnSearch) {
        // En caso de que exista un botón específico en el modal
        btnSearch.addEventListener('click', searchCompanyNews);
    }
    
    // Botón Buscar Empresa (Panel Derecho)
    const btnSearchCompany = document.getElementById('btn-search-company');
    if (btnSearchCompany) {
        const newBtn = btnSearchCompany.cloneNode(true);
        btnSearchCompany.parentNode.replaceChild(newBtn, btnSearchCompany);
        newBtn.addEventListener('click', searchCompanyNews);
    }

    // Dropdown Macro (Recarga al cambiar)
    const macroSelect = document.getElementById('news-macro-select');
    if (macroSelect) {
        const newSelect = macroSelect.cloneNode(true);
        macroSelect.parentNode.replaceChild(newSelect, macroSelect);
        newSelect.addEventListener('change', loadGeneralNews);
    }
}

export function openNewsModal() {
    const m = document.getElementById('news-modal');
    if(m && window.openModal) {
        window.openModal(m); 
        loadGeneralNews();   // Carga inicial
    }
}

async function loadGeneralNews() {
    if(!functionsInstance) return;
    const container = document.getElementById('news-general-container');
    const category = document.getElementById('news-macro-select').value;
    
    if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 text-xs animate-pulse">Cargando noticias generales...</div>';
    
    try {
        const fn = httpsCallable(functionsInstance, 'getFinancialNews');
        const res = await fn({ type: 'macro', category: category });
        
        if(res.data.articles && res.data.articles.length > 0) {
            renderNewsList(res.data.articles, container);
        } else {
            if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 text-xs">No hay noticias recientes.</div>';
        }
    } catch(e) {
        console.error(e);
        if(container) container.innerHTML = '<div class="text-center py-10 text-rose-400 text-xs">Error de conexión.</div>';
    }
}

async function searchCompanyNews() {
    if(!functionsInstance) return;
    const container = document.getElementById('news-company-container');
    const query = document.getElementById('news-ticker-input').value.trim();
    
    if(!query) return;

    if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 text-xs animate-pulse">Buscando noticias...</div>';
    
    try {
        const fn = httpsCallable(functionsInstance, 'getFinancialNews');
        const res = await fn({ type: 'company_search', query: query });
        
        if(res.data.articles && res.data.articles.length > 0) {
            renderNewsList(res.data.articles, container);
        } else {
            if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 text-xs">No se encontraron noticias.</div>';
        }
    } catch(e) {
        console.error(e);
        if(container) container.innerHTML = '<div class="text-center py-10 text-rose-400 text-xs">Error en la búsqueda.</div>';
    }
}

function renderNewsList(articles, container) {
    if(!container) return;
    container.innerHTML = articles.map(a => {
        const sentimentScore = a.sentimentScore || 0;
        return `
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden mb-3">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${sentimentScore >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}"></div>
            <div class="flex justify-between items-start mb-1 pl-2">
                <div class="flex items-center gap-2">
                    <span class="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">${a.source || 'News'}</span>
                    <span class="text-[10px] text-slate-400 font-mono">${new Date(a.publishedAt).toLocaleDateString()}</span>
                </div>
            </div>
            <a href="${a.url}" target="_blank" class="block pl-2">
                <h4 class="text-xs font-bold text-slate-800 leading-tight mb-1 group-hover:text-blue-600 transition-colors">${a.title}</h4>
                <p class="text-[10px] text-slate-500 leading-relaxed line-clamp-2">${a.summary || ''}</p>
            </a>
        </div>
    `}).join('');
}