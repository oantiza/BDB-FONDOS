import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WeeklyReport } from '../types/WeeklyReport';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Quote, Activity, Calendar as CalendarIcon, FileText } from 'lucide-react';
import '../styles/report-print.css';

const COLORS_CORE = ['#1e293b', '#3b82f6', '#8b5cf6', '#0ea5e9', '#6366f1'];

export default function PrintMacroStrategyReport() {
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadReport = async () => {
            try {
                // 1. Try to load from localStorage first (passed from dashboard)
                const savedReport = localStorage.getItem('current_macro_report');
                if (savedReport) {
                    try {
                        const parsed = JSON.parse(savedReport);
                        if (parsed) {
                            setReport(parsed as any);
                            setLoading(false);
                            // Cleanup so it doesn't linger
                            localStorage.removeItem('current_macro_report');
                            return;
                        }
                    } catch (e) {
                        console.error("Error parsing saved report:", e);
                    }
                }

                // 2. Fallback to fetching latest if no local data (robustness)
                const q = query(
                    collection(db, 'reports'),
                    where('type', '==', 'WEEKLY_REPORT'),
                    orderBy('date', 'desc'),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docInfo = querySnapshot.docs[0];
                    setReport({ ...docInfo.data(), id: docInfo.id } as WeeklyReport);
                }
            } catch (error) {
                console.error("Error fetching report for printing:", error);
            } finally {
                setLoading(false);
            }
        };

        loadReport();
    }, []);

    // Auto-trigger print
    useEffect(() => {
        if (!loading && report) {
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loading, report]);

    const cleanFullReport = useMemo(() => {
        if (!report) return "";
        let narrative = report.fullReport?.narrative || report.summary.narrative || "";
        narrative = narrative.replace(/\\n/g, '\n');
        // Clean salutations
        narrative = narrative.replace(/A la atención del Comité de Inversiones,?\s*/gi, '');
        return narrative;
    }, [report]);

    const heroNarrative = useMemo(() => {
        if (!report?.summary.narrative) return "";
        return report.summary.narrative
            .replace(/\\n/g, '\n')
            .replace(/A la atención del Comité de Inversiones,?\s*/gi, '')
            .split('\n')[0]; // Just the first line or short summary
    }, [report]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center font-sans text-slate-400">
                <Activity className="w-6 h-6 animate-spin mr-3" />
                <span>Preparando documento institucional...</span>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-10 text-center font-sans">
                <h1 className="text-xl font-bold text-slate-800">Error</h1>
                <p className="text-slate-500">No se ha encontrado el informe solicitado.</p>
            </div>
        );
    }

    const formattedDate = new Date(report.date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="report-page bg-white min-h-screen p-8 md:p-16">
            <div className="report-container mx-auto max-w-[800px]">
                
                {/* 1. Document Header */}
                <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                    <div className="report-header-left">
                        <div className="flex items-center gap-2 mb-2">
                             <img src="/logo-black.png" alt="Logo" className="h-6 opacity-80" onError={(e) => (e.currentTarget.style.display = 'none')} />
                             <span className="text-xs font-bold tracking-tighter text-slate-900 uppercase">Investment Strategy</span>
                        </div>
                        <h1 className="report-title text-4xl font-serif font-black text-slate-900 italic leading-none">
                            Macro Strategy Note
                        </h1>
                        <p className="report-date font-mono text-xs uppercase tracking-[0.2em] text-slate-500 mt-2">
                            {formattedDate} | {report.id.substring(0, 8).toUpperCase()}
                        </p>
                    </div>
                    <div className="report-header-right text-right">
                        <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Global Alpha Engine</span>
                        <div className="inline-block px-4 py-1 border border-slate-200 rounded-sm">
                            <span className="text-2xl font-bold text-slate-800 tracking-tighter">
                                {report.summary.marketTemperature || "NEUTRAL"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Executive Summary Quote */}
                {heroNarrative && (
                    <div className="report-quote mb-12">
                        <p className="font-serif text-2xl leading-relaxed text-slate-700 font-light">
                            "{heroNarrative}"
                        </p>
                    </div>
                )}

                {/* 3. Distribution & Allocation Section */}
                <div className="grid grid-cols-2 gap-8 mb-12 break-inside-avoid">
                    <div className="report-chart-block">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4 border-l-4 border-indigo-500 pl-3">
                            Asset Allocation
                        </h3>
                        <div className="h-[300px] w-full">
                            <BarChart
                                width={350}
                                height={280}
                                data={report.assetAllocation.classes}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                barSize={40}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="assetClass" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                                <Bar dataKey="tacticalWeight" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tactical" />
                                <Bar dataKey="strategicWeight" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Strategic" />
                            </BarChart>
                        </div>
                    </div>

                    <div className="report-chart-block">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4 border-l-4 border-indigo-500 pl-3">
                            Risk Distribution
                        </h3>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" width={350} height={300} data={report.assetAllocation.classes}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="assetClass" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <Radar
                                    name="Weight"
                                    dataKey="tacticalWeight"
                                    stroke="#6366f1"
                                    fill="#6366f1"
                                    fillOpacity={0.6}
                                />
                            </RadarChart>
                        </div>
                    </div>
                </div>

                {/* 4. Full Narrative Report */}
                <div className="report-content prose prose-slate max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ ...props }) => <h2 className="report-section-title" {...props} />,
                            h2: ({ ...props }) => <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-100 pb-2" {...props} />,
                            h3: ({ ...props }) => <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2" {...props} />,
                            p: ({ ...props }) => <p className="report-paragraph" {...props} />,
                            li: ({ ...props }) => <li className="text-sm text-slate-700 mb-2 ml-4 list-disc" {...props} />,
                            table: ({ ...props }) => <table className="report-table" {...props} />,
                            blockquote: ({ node, children, ...props }) => <div className="report-quote my-6">{children}</div>,
                            strong: ({ node, children, ...props }) => <span className="font-bold text-slate-900">{children}</span>
                        }}
                    >
                        {cleanFullReport}
                    </ReactMarkdown>
                </div>

                {/* 5. Footer / Disclaimer */}
                <div className="footer-disclaimer mt-20 pt-10 border-t border-slate-200">
                    <div className="flex justify-between items-start text-[8pt] text-slate-400">
                        <div className="max-w-md text-left">
                            <p className="font-bold uppercase mb-1">Confidential Information</p>
                            <p>This document is intended solely for institutional use. The analysis presented here is driven by the Global Alpha Engine and consolidated via Deep Research protocols. Past performance is not indicative of future results.</p>
                        </div>
                        <div className="text-right">
                            <p>© {new Date().getFullYear()} BDB FONDOS</p>
                            <p>Strategic Intelligence Unit</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
