import React from 'react';

export function SectionTitle({ title, icon: Icon }: { title: string, icon: React.ElementType }) {
    return (
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Icon className="w-5 h-5 text-slate-400" /> {title}
        </h3>
    );
}

export function InputField({ label, value, onChange, prefix, suffix, type = "text", info }: { label: string; value: string | number; onChange: React.ChangeEventHandler<HTMLInputElement>; prefix?: string; suffix?: string; type?: string; info?: string }) {
    return (
        <div>
            <label className="block text-[15px] font-bold text-[#0B2545] mb-2 flex items-center justify-between">
                <span>{label}</span>
                {info && <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{info}</span>}
            </label>
            <div className="relative">
                {prefix && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium sm:text-base">{prefix}</div>}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    className={`block w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-400 focus:ring-slate-400 sm:text-base font-medium text-slate-800 transition-colors py-2.5 placeholder:text-slate-300 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
                />
                {suffix && <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-medium sm:text-base">{suffix}</div>}
            </div>
        </div>
    );
}

export function MetricTile({ label, value, subtext, colorClass = "text-slate-800", bgColor = "bg-slate-50", borderColor = "border-slate-100" }: { label: string; value: string | React.ReactNode; subtext?: string; colorClass?: string; bgColor?: string; borderColor?: string }) {
    return (
        <div className={`${bgColor} rounded-lg p-3 border ${borderColor} flex flex-col items-center justify-center text-center`}>
            <span className="block text-slate-500 text-[9px] uppercase tracking-wider font-bold mb-1">{label}</span>
            <span className={`block font-bold text-xl ${colorClass}`}>{value}</span>
            {subtext && <span className="text-[9px] text-slate-400 block mt-1 uppercase tracking-wider font-semibold">{subtext}</span>}
        </div>
    );
}

export function SoftBadge({ children, active, onClick, className = "" }: { children: React.ReactNode; active: boolean; onClick?: () => void; className?: string }) {
    return (
        <button
            onClick={onClick}
            className={`py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
                active 
                ? 'bg-[#0B2545] text-white shadow-sm border border-[#0B2545]' 
                : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200'
            } ${className}`}
        >
            {children}
        </button>
    );
}
