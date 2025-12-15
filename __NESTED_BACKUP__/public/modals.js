import { fundDatabase, vipFunds, setVipFunds } from './store.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showToast } from './ui.js';

// 1. Funciones de Apertura/Cierre
export function openModal(modal, fundIsin = null) {
    // Si pasamos el ID como string, buscar el elemento
    const m = (typeof modal === 'string') ? document.getElementById(modal) : modal;
    
    if (m) {
        if(fundIsin && m.id === 'fund-details-modal') {
            loadFundDetailsIntoModal(fundIsin);
        }

        m.classList.remove('hidden');
        m.classList.add('flex');
        setTimeout(() => {
            m.classList.remove('opacity-0');
            const inner = m.querySelector('div');
            if(inner) inner.classList.remove('scale-95');
        }, 10);
    }
}

export function closeModal(modal) {
    const m = (typeof modal === 'string') ? document.getElementById(modal) : modal;
    
    if (m) {
        m.classList.add('opacity-0');
        const inner = m.querySelector('div');
        if(inner) inner.classList.add('scale-95');
        setTimeout(() => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        }, 300);
    }
}

function loadFundDetailsIntoModal(isin) {
    const fund = fundDatabase.find(f => f.isin === isin);
    if(!fund) return;
    
    const nameEl = document.getElementById('fd-name');
    if(nameEl) nameEl.textContent = fund.name;
    
    const isinEl = document.getElementById('fd-isin');
    if(isinEl) isinEl.textContent = fund.isin;
    
    const classEl = document.getElementById('fd-class');
    if(classEl) classEl.textContent = fund.type || inferType(fund);
    
    const vol = fund.perf?.volatility || 0;
    const volEl = document.getElementById('fd-vol');
    if(volEl) volEl.textContent = vol.toFixed(2) + '%';
    
    const btn = document.getElementById('fd-btn-add');
    if(btn) {
        btn.onclick = () => {
            if(window.addFund) window.addFund(isin);
            closeModal('fund-details-modal');
        };
    }
}

function inferType(f) {
    return (f.metrics?.equity > 60) ? 'Renta Variable' : 'Renta Fija / Mixto';
}

// 2. Sistema VIP (Fondos Ancla)
let firestoreDb = null;

export async function initVipSystem(dbInstance) {
    firestoreDb = dbInstance;
    const auth = getAuth(); 
    const user = auth.currentUser;
    if (user && firestoreDb) loadUserVips(user.uid); 
    
    const searchInput = document.getElementById('vip-search-input');
    const resultsDiv = document.getElementById('vip-search-results');
    const saveBtn = document.getElementById('save-vips-btn');

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if(term.length < 3) { resultsDiv.classList.add('hidden'); return; }
            
            const matches = fundDatabase.filter(f => f.name.toLowerCase().includes(term) || f.isin.toLowerCase().includes(term)).slice(0,5);
            resultsDiv.innerHTML = matches.map(f => 
                `<div class="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-100" onclick="window.addVip('${f.isin}')">
                    <div class="truncate max-w-[200px]">
                        <div class="text-xs font-bold text-slate-700">${f.name}</div>
                        <div class="text-[10px] text-slate-400">${f.isin}</div>
                    </div>
                    <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Añadir</span>
                </div>`
            ).join('');
            resultsDiv.classList.remove('hidden');
        });
    }

    if(saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const auth = getAuth();
            if(!auth.currentUser || !firestoreDb) return;
            saveBtn.textContent = "Guardando...";
            try {
                await setDoc(doc(firestoreDb, "users", auth.currentUser.uid, "config", "settings"), { vipFunds: vipFunds }, { merge: true });
                saveBtn.textContent = "¡Guardado!";
                showToast("Preferencias guardadas", "success");
                setTimeout(() => saveBtn.textContent = "Guardar Lista Ancla", 1500);
            } catch(e) { console.error(e); saveBtn.textContent = "Error"; }
        });
    }
}

async function loadUserVips(uid) {
    if (!firestoreDb) return;
    try {
        const snap = await getDoc(doc(firestoreDb, "users", uid, "config", "settings"));
        if (snap.exists() && snap.data().vipFunds) {
            setVipFunds(snap.data().vipFunds);
            renderVipList();
        }
    } catch (e) { console.error(e); }
}

export function renderVipList() {
    const container = document.getElementById('vip-list-container');
    if(!container) return;
    container.innerHTML = vipFunds.map(isin => {
        const f = fundDatabase.find(x => x.isin === isin) || { name: isin, isin: isin };
        return `<div class="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 mb-2">
            <div class="text-xs font-bold text-slate-700 truncate w-4/5">${f.name}</div>
            <button onclick="window.removeVip('${isin}')" class="text-rose-400 hover:text-rose-600 font-bold">&times;</button>
        </div>`;
    }).join('');
}

// EXPOSICIÓN A WINDOW PARA HTML
window.addVip = (isin) => { 
    if(!vipFunds.includes(isin)) { 
        const newVips = [...vipFunds, isin];
        setVipFunds(newVips);
        renderVipList(); 
        document.getElementById('vip-search-results').classList.add('hidden');
        document.getElementById('vip-search-input').value = '';
    } 
};
window.removeVip = (isin) => {
    const newVips = vipFunds.filter(id => id !== isin);
    setVipFunds(newVips);
    renderVipList();
};

// IMPORTANTE: Exponemos openModal/closeModal globalmente
window.openModal = openModal;
window.closeModal = closeModal;
window.openVipModal = () => openModal('vip-modal');