import React from 'react';

interface StrategyCardProps {
    title: string;
    icon: string;
    children: React.ReactNode;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({ title, icon, children }) => (
    // Minimalist Card: No Shadow, Clean Border
    <div className="bg-white border-t-2 border-[#2C3E50] pt-4">
        <div className="flex items-center gap-3 mb-6">
            <span className="text-xl opacity-80 grayscale">{icon}</span>
            <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-[10px]">{title}</h3>
        </div>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);
