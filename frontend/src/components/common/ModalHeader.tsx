import React from 'react'

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    onClose: () => void;
    icon?: React.ReactNode;
}

export default function ModalHeader({ title, subtitle, onClose, icon }: ModalHeaderProps) {
    return (
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-[#003399] to-[#0055CC] flex justify-between items-center shrink-0 shadow-md relative overflow-hidden">
            <div className="relative z-10 flex items-center gap-3">
                {icon && (
                    <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20 backdrop-blur-sm text-white">
                        {typeof icon === 'string' ? <span className="text-sm">{icon}</span> : icon}
                    </div>
                )}
                <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-[0.2em]">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-white/70 text-[10px] uppercase tracking-[0.2em] font-bold mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            <button
                onClick={onClose}
                className="relative z-10 text-white/70 hover:text-white transition-colors text-2xl leading-none"
            >
                &times;
            </button>
        </div>
    )
}
