import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WeeklyReport } from '../../types/WeeklyReport';
import { Clock, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FullReportTabProps {
    report: WeeklyReport;
}

const FullReportTab: React.FC<FullReportTabProps> = ({ report }) => {
    // 1. Preprocesar el markdown para curar los saltos de línea escapados que envía Gemini
    const cleanMarkdown = useMemo(() => {
        const markdownSource = report.fullReport?.narrative || report.summary.narrative || "";
        // Reemplazar "\\n" literal por verdaderos "\n"
        return markdownSource.replace(/\\n/g, '\n');
    }, [report.fullReport, report.summary.narrative]);

    // 2. Calcular tiempo de lectura estimado (aprox 250 palabras por minuto)
    const readingTime = useMemo(() => {
        const words = cleanMarkdown.split(/\s+/).length;
        const minutes = Math.ceil(words / 250);
        return minutes > 0 ? minutes : 1;
    }, [cleanMarkdown]);

    // Fecha actual para el informe
    const currentDate = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

    return (
        <div className="flex justify-center bg-gray-50/50 py-8">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

                {/* Cabecera Editorial Premium */}
                <div className="bg-brand-dark text-white p-10 border-b border-gray-200">
                    <div className="flex items-center space-x-2 text-accent-light mb-4 text-sm font-semibold tracking-wider uppercase">
                        <FileText className="w-4 h-4" />
                        <span>Informe Análisis</span>
                    </div>
                    <h2 className="text-3xl font-serif font-bold text-white mb-6 leading-tight">
                        Estrategia Global y Asignación de Activos
                    </h2>

                    <div className="flex items-center space-x-6 text-gray-300 text-sm">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>{currentDate}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{readingTime} min de lectura</span>
                        </div>
                    </div>
                </div>

                {/* Contenido Principal con Custom Markdown Renderers */}
                <div className="p-10 md:p-14">
                    <article className="prose prose-lg max-w-none text-gray-700">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Sobrescribir H1, H2, H3 para darles toques corporativos
                                h1: ({ node, ...props }) => <h1 className="text-3xl font-serif font-bold text-brand-dark mt-10 mb-6 border-b pb-4" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-2xl font-serif font-bold text-brand-dark mt-8 mb-4" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3" {...props} />,
                                // Negritas en azul corporativo para escaneo rápido
                                strong: ({ node, ...props }) => <strong className="font-bold text-brand-dark" {...props} />,
                                // Estilizar listas con viñetas doradas
                                ul: ({ node, ...props }) => <ul className="space-y-2 my-6 list-none" {...props} />,
                                li: ({ node, children, ...props }) => (
                                    <li className="flex items-start" {...props}>
                                        <span className="text-accent-DEFAULT mr-3 mt-1.5 text-lg leading-none">•</span>
                                        <span className="flex-1">{children}</span>
                                    </li>
                                ),
                                // Estilizar Tablas tipo Banca de Inversión
                                table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-8 rounded-lg border border-gray-200">
                                        <table className="min-w-full text-sm text-left whitespace-nowrap" {...props} />
                                    </div>
                                ),
                                thead: ({ node, ...props }) => <thead className="bg-brand-dark text-white uppercase text-xs tracking-wider" {...props} />,
                                th: ({ node, ...props }) => <th className="px-6 py-4 font-medium" {...props} />,
                                td: ({ node, ...props }) => <td className="px-6 py-4 border-b border-gray-100 text-gray-800" {...props} />,
                                tr: ({ node, ...props }) => <tr className="hover:bg-gray-50 transition-colors" {...props} />,
                                // Blockquotes elegantes para citas
                                blockquote: ({ node, ...props }) => (
                                    <blockquote className="border-l-4 border-accent-DEFAULT pl-6 py-2 my-8 italic text-gray-600 bg-gray-50 rounded-r-lg" {...props} />
                                ),
                            }}
                        >
                            {cleanMarkdown}
                        </ReactMarkdown>
                    </article>

                    {/* Disclaimer Base */}
                    <div className="mt-16 pt-8 border-t border-gray-200 text-xs text-gray-500 text-center leading-relaxed">
                        <p>
                            Este informe ha sido generado automáticamente por nuestro modelo de inteligencia artificial
                            ({report.provider}) y consolidado mediante <strong>Deep Research</strong>.
                        </p>
                        <p className="mt-2">
                            La información aquí contenida tiene carácter puramente informativo y no constituye una recomendación de compra o venta.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullReportTab;
