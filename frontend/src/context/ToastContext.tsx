import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from '../components/common/Toast';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    addToast: (message: string, type: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType, duration: number = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const success = useCallback((msg: string, dur?: number) => addToast(msg, 'success', dur), [addToast]);
    const error = useCallback((msg: string, dur?: number) => addToast(msg, 'error', dur), [addToast]);
    const info = useCallback((msg: string, dur?: number) => addToast(msg, 'info', dur), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, info }}>
            {children}
            {/* Toast Container - Fixed Position */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto transition-all duration-300 ease-in-out">
                        <Toast {...t} onClose={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
