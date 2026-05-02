import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const ICONS = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <X className="w-5 h-5 text-red-500" />, // Using X for error icon usually, or AlertCircle
    info: <Info className="w-5 h-5 text-blue-500" />
};

const STYLES = {
    success: 'border-green-100 bg-green-50 text-green-800',
    error: 'border-red-100 bg-red-50 text-red-800',
    info: 'border-blue-100 bg-blue-50 text-blue-800'
};

export default function Toast({ id, message, type, duration = 3000, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);
        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            layout
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-md ${STYLES[type]} backdrop-blur-sm bg-opacity-95`}
        >
            <div className="shrink-0">
                {ICONS[type]}
            </div>
            <div className="flex-1 text-sm font-medium">
                {message}
            </div>
            <button
                onClick={() => onClose(id)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors opacity-60 hover:opacity-100"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}
