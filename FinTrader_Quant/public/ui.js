// ui.js - Utilidades de Interfaz

/**
 * Muestra una notificación flotante (Toast).
 */
export function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2';
        document.body.appendChild(toastContainer);
    }

    const styles = {
        success: 'bg-[#0B2545] border-l-4 border-[#10B981] text-white',
        error: 'bg-white border-l-4 border-red-500 text-slate-800 shadow-lg',
        info: 'bg-[#0B2545] border-l-4 border-[#D4AF37] text-white'
    };

    const activeStyle = styles[type] || styles.info;
    const toast = document.createElement('div');
    toast.className = `${activeStyle} px-4 py-3 rounded shadow-xl flex items-center gap-3 min-w-[250px] transform transition-all duration-300 translate-x-full opacity-0`;
    
    let icon = '';
    if(type === 'success') icon = '✅';
    else if(type === 'error') icon = '⚠️';
    else icon = 'ℹ️';

    toast.innerHTML = `<span class="text-lg">${icon}</span><span class="text-xs font-bold font-sans">${message}</span>`;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3500);
}

/**
 * Formatea un número como moneda Euro.
 */
export function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '0,00 €';
    return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
    }).format(value);
}