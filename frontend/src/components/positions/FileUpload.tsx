import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { clsx } from 'clsx';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type === "text/csv" || file.name.endsWith('.csv') || file.type === "application/vnd.ms-excel") {
                onFileSelect(file);
            } else {
                alert("Por favor, sube un archivo con extensión .csv");
            }
        }
    }, [onFileSelect]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === "text/csv" || file.name.endsWith('.csv') || file.type === "application/vnd.ms-excel") {
                onFileSelect(file);
            } else {
                alert("Por favor, sube un archivo con extensión .csv");
            }
            // Reset input to allow selecting the same file again if needed
            e.target.value = '';
        }
    }, [onFileSelect]);

    return (
        <div className="mb-8">
            <div
                className={`
                    border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer
                    ${isDragActive
                        ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    type="file"
                    id="file-input"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleChange}
                />
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('file-input')?.click();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition shadow-sm"
                >
                    Seleccionar Archivo
                </button>
                <p className="text-xs text-gray-400 mt-4">Formato esperado: CSV separado por punto y coma (;)</p>
            </div>
        </div>
    );
};
