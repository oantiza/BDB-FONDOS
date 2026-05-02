import React, { useState, useEffect, useRef } from 'react';

interface EditableCapitalProps {
    value: number;
    onChange: (newValue: number) => void;
}

export const EditableCapital: React.FC<EditableCapitalProps> = ({ value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value.toString());
        }
    }, [value, isEditing]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(localValue.replace(/,/g, '.').replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
            onChange(parsed);
        } else {
            setLocalValue(value.toString()); // Revert if invalid
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
        if (e.key === 'Escape') {
            setIsEditing(false);
            setLocalValue(value.toString());
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-white text-[#0B2545] font-black text-[15px] tracking-tight w-28 text-right outline-none ring-2 ring-emerald-400 rounded px-1 -mx-1"
                />
            </div>
        );
    }

    return (
        <div 
            className="group relative cursor-pointer flex items-center px-1 -mx-1 rounded transition-colors hover:bg-slate-200"
            onClick={() => setIsEditing(true)}
            title="Haz clic para editar el capital"
        >
            <span className="text-[#0B2545] font-black text-[15px] tracking-tight pointer-events-none">
                {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}
            </span>
            {/* Pequeño icono indicador (opcional) que aparece en hover */}
            <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 absolute -right-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </div>
    );
};
