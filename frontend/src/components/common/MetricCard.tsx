import React from 'react'

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string | number; // For comparison deltas
    color?: string; // Text color class for value
    subColor?: string; // Text color for subValue
    inverse?: boolean; // For comparison logic
}

export default function MetricCard({ label, value, subValue, color = "text-[#2C3E50]", subColor }: MetricCardProps) {
    return (
        <div className="bg-[#fcfcfc] border border-[#eeeeee] p-4 flex flex-col justify-center items-center text-center hover:border-[#dcdcdc] transition-colors rounded-lg">
            <div className="text-[10px] uppercase font-bold text-[#A07147] tracking-[0.2em] mb-2">
                {label}
            </div>
            <div className={`text-2xl font-light tracking-tight ${color}`}>
                {value}
            </div>
            {subValue && (
                <div className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${subColor || 'text-slate-400'}`}>
                    {subValue}
                </div>
            )}
        </div>
    )
}
