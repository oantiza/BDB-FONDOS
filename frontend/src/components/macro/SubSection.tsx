import React from 'react';

interface SubSectionProps {
    title: string;
    items?: { name: string; view: string }[];
}

export const SubSection: React.FC<SubSectionProps> = ({ title, items }) => {
    if (!items) return null;
    return (
        <div>
            <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-3 border-b border-[#eeeeee] pb-1 w-full block">{title}</h4>
            <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm group">
                        <span className="font-medium text-[#2C3E50] group-hover:text-slate-900 transition-colors">{item.name}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.view === 'POSITIVO' || item.view === 'SOBREPONDERAR' ? 'text-green-700 bg-green-50' :
                            item.view === 'NEGATIVO' || item.view === 'INFRAPONDERAR' ? 'text-red-700 bg-red-50' :
                                'text-slate-500 bg-slate-50'
                            }`}>
                            {item.view}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
