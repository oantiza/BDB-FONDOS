import React from 'react';

export function SectionTitle({ title, icon: Icon }: { title: string, icon: React.ElementType }) {
    return (
        <h3 className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm">
                <Icon className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-800">{title}</span>
        </h3>
    );
}

export function InputField({ label, value, onChange, prefix, suffix, type = "text", info }: { label: string; value: string | number; onChange: React.ChangeEventHandler<HTMLInputElement>; prefix?: string; suffix?: string; type?: string; info?: string }) {
    return (
        <div className="flex flex-col gap-2.5 h-full justify-end">
            <label className={`flex items-center gap-3 text-base font-semibold text-slate-600 ${info ? 'justify-between' : 'justify-center text-center'}`}>
                <span className="leading-snug">{label}</span>
                {info && <span className="flex-none text-xs font-semibold uppercase tracking-wider text-slate-400">{info}</span>}
            </label>
            <div className="relative mt-auto">
                {prefix && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-lg font-medium text-slate-400">{prefix}</div>}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    className={`block w-full text-center rounded-2xl border-transparent bg-slate-50 px-4 py-3.5 text-xl font-bold text-slate-800 transition-all placeholder:text-slate-300 hover:bg-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 ${prefix ? 'px-10' : ''} ${suffix ? 'px-14' : ''}`}
                />
                {suffix && <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-lg font-medium text-slate-400">{suffix}</div>}
            </div>
        </div>
    );
}

export function MetricTile({ label, value, subtext, colorClass = "text-slate-800", bgColor = "bg-slate-50", borderColor = "border-transparent" }: { label: string; value: string | React.ReactNode; subtext?: string; colorClass?: string; bgColor?: string; borderColor?: string }) {
    return (
        <div className={`${bgColor} flex min-h-[142px] flex-col justify-between gap-4 rounded-3xl border p-6 text-left shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:-translate-y-0.5 ${borderColor}`}>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <div className="space-y-1">
                <span className={`block text-3xl font-black tracking-tight ${colorClass}`}>{value}</span>
                {subtext && <span className="block text-sm font-medium text-slate-400">{subtext}</span>}
            </div>
        </div>
    );
}

export function SoftBadge({ children, active, onClick, className = "" }: { children: React.ReactNode; active: boolean; onClick?: () => void; className?: string }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-2xl px-5 py-3 text-base font-bold transition-all duration-300 ${
                active 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            } ${className}`}
        >
            {children}
        </button>
    );
}
