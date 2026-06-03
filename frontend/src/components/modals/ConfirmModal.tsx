import React from 'react';
import ModalHeader from '../common/ModalHeader';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    subtitle = "Confirmación necesaria",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col border border-slate-100">
                <ModalHeader
                    title={title}
                    subtitle={subtitle}
                    icon=""
                    onClose={onCancel}
                    compact={true}
                />

                <div className="p-8 bg-white flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 border-4 border-amber-50">
                        <AlertCircle className="w-8 h-8" strokeWidth={2} />
                    </div>

                    <p className="text-slate-700 text-[15px] leading-relaxed mb-8 whitespace-pre-wrap">
                        {message}
                    </p>

                    <div className="flex w-full gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 text-slate-500 hover:text-slate-800 font-bold text-xs py-3 px-5 transition-colors uppercase tracking-widest bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 bg-[#0B2545] hover:bg-[#133a6b] text-white font-bold text-xs py-3 px-5 rounded-lg transition-colors shadow-sm uppercase tracking-widest"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
