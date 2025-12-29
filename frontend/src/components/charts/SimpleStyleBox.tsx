
import React from 'react';

interface SimpleStyleBoxProps {
    type: 'equity' | 'fixed-income';
    vertical: string; // Large/Mid/Small OR High/Med/Low
    horizontal: string; // Value/Blend/Growth OR Short/Med/Long
}

export default function SimpleStyleBox({ type, vertical, horizontal }: SimpleStyleBoxProps) {
    const isEquity = type === 'equity';

    const cols = isEquity ? ['VAL', 'BLN', 'GRW'] : ['SHT', 'MED', 'LNG']; // Short, Medium, Long
    const rows = isEquity ? ['LRG', 'MID', 'SML'] : ['HGH', 'MED', 'LOW']; // High, Medium, Low (Credit)

    // Map input strings to internal keys for comparison
    const xMap: Record<string, string> = isEquity
        ? { 'Value': 'VAL', 'Blend': 'BLN', 'Growth': 'GRW' }
        : { 'Short': 'SHT', 'Medium': 'MED', 'Long': 'LNG' };

    const yMap: Record<string, string> = isEquity
        ? { 'Large': 'LRG', 'Mid': 'MID', 'Small': 'SML' }
        : { 'High': 'HGH', 'Med': 'MED', 'Low': 'LOW' };

    const activeCol = xMap[horizontal] || (isEquity ? 'BLN' : 'MED');
    const activeRow = yMap[vertical] || (isEquity ? 'LRG' : 'MED');

    // Colors
    const activeBg = isEquity ? 'bg-[#0B2545]' : 'bg-[#166534]'; // Navy for Equity, Green for FI
    const activeBorder = isEquity ? 'border-[#0B2545]' : 'border-[#166534]';

    return (
        <div className="flex flex-col items-center pb-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-wider">
                {isEquity ? 'Renta Variable' : 'Renta Fija'}
            </span>
            <div className="relative">
                {/* Horizontal Labels (Top) */}
                <div className="flex justify-between pl-5 pr-1 mb-1.5 text-[9px] font-bold text-slate-400 w-full max-w-[110px] ml-auto">
                    {cols.map(c => <span key={c}>{c}</span>)}
                </div>

                <div className="flex">
                    {/* Vertical Labels (Left) */}
                    <div className="flex flex-col justify-between py-2 mr-1.5 text-[9px] font-bold text-slate-400 h-[100px]">
                        {rows.map(r => <span key={r}>{r}</span>)}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-1 w-[100px] h-[100px]">
                        {cols.map((cVal, colIdx) => (
                            <div key={colIdx} className="flex flex-col gap-1 h-full">
                                {rows.map((rVal, rowIdx) => {
                                    const isActive = activeCol === cVal && activeRow === rVal;
                                    return (
                                        <div
                                            key={`${cVal}-${rVal}`}
                                            className={`
                                                flex-1 rounded-sm border transition-all duration-500
                                                ${isActive ? `${activeBg} ${activeBorder} shadow-sm z-10 scale-110` : 'bg-slate-50 border-slate-200'}
                                            `}
                                            title={`${rVal} ${cVal}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
