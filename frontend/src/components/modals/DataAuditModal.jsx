import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'

export default function DataAuditModal({ onClose }) {
    const [loading, setLoading] = useState(false)
    const [auditResult, setAuditResult] = useState(null)
    const [repairResult, setRepairResult] = useState(null)
    const [error, setError] = useState(null)

    const handleRunAudit = async () => {
        setLoading(true)
        setError(null)
        setAuditResult(null)
        setRepairResult(null)

        try {
            const analyzeIsin = httpsCallable(functions, 'analyze_isin_health')
            const result = await analyzeIsin()
            setAuditResult(result.data)
        } catch (e) {
            console.error("Audit failed", e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateRepair = async () => {
        setLoading(true)
        try {
            const generateRepair = httpsCallable(functions, 'generate_repair_manifest')
            const result = await generateRepair()
            setRepairResult(result.data.summary)
        } catch (e) {
            console.error("Repair Gen failed", e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm font-sans">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-white text-brand shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-[#0B2545]">
                        <span>🛡️</span> Data Integrity Audit
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    {!auditResult && !loading && (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="text-slate-500 mb-6 max-w-md">
                                This tool will scan the database for corrupted ISINs (truncated IDs, invalid prefixes).
                                It generates a report in Storage and returns a sample here.
                            </p>
                            <button
                                onClick={handleRunAudit}
                                className="bg-[#0B2545] text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                            >
                                <span>🔍</span> Run ISIN Health Check
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B2545] mb-4"></div>
                            <p className="text-slate-500 font-bold animate-pulse">Scanning database...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 mb-4">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {auditResult && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
                                    <div className="text-xs font-bold text-slate-400 uppercase">Total Scanned</div>
                                    <div className="text-2xl font-mono font-bold text-slate-700">{auditResult.summary.total}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm text-center">
                                    <div className="text-xs font-bold text-red-400 uppercase">Corrupted</div>
                                    <div className="text-2xl font-mono font-bold text-red-600">{auditResult.summary.corrupted}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm text-center">
                                    <div className="text-xs font-bold text-emerald-400 uppercase">Status</div>
                                    <div className="text-lg font-bold text-emerald-600">
                                        {auditResult.summary.corrupted > 0 ? 'Repairs Needed' : 'Healthy'}
                                    </div>
                                </div>
                            </div>

                            {/* Report Link */}
                            {auditResult.summary.report_url && (
                                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded text-xs border border-blue-200 flex items-center gap-2">
                                    <span>📄</span>
                                    Full report saved to: <span className="font-mono">{auditResult.summary.report_url}</span>
                                </div>
                            )}

                            {/* PHASE 2: REPAIR GENERATION */}
                            {auditResult.summary.corrupted > 0 && !repairResult && (
                                <div className="bg-amber-50 rounded-lg p-6 border border-amber-200 text-center">
                                    <h3 className="font-bold text-amber-800 mb-2">Phase 2: Repair Strategy</h3>
                                    <p className="text-sm text-amber-700 mb-4">
                                        Corrupted records found. Generate a repair plan to query EODHD for correct ISINs.
                                    </p>
                                    <button
                                        onClick={handleGenerateRepair}
                                        disabled={loading}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors"
                                    >
                                        🛠️ Generate Repair Manifest
                                    </button>
                                </div>
                            )}

                            {/* REPAIR RESULTS */}
                            {repairResult && (
                                <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                                    <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                        <span>📋</span> Repair Manifest Ready
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white p-3 rounded border border-indigo-100">
                                            <div className="text-xs text-indigo-400 font-bold uppercase">Analyzed</div>
                                            <div className="text-xl font-mono">{repairResult.total_analyzed}</div>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-indigo-100">
                                            <div className="text-xs text-indigo-400 font-bold uppercase">Auto-Resolvable</div>
                                            <div className="text-xl font-mono text-emerald-600">{repairResult.resolvable}</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-indigo-600 mb-2">
                                        Plan saved to: <strong>reports/repair_manifest.json</strong>
                                    </p>
                                    <p className="text-xs text-slate-500 italic">
                                        Review the manifest in Storage or wait for Phase 3 (Execution) implementation.
                                    </p>
                                </div>
                            )}

                            {/* PHASE 2: REPAIR GENERATION */}
                            {auditResult.summary.corrupted > 0 && !repairResult && (
                                <div className="bg-amber-50 rounded-lg p-6 border border-amber-200 text-center">
                                    <h3 className="font-bold text-amber-800 mb-2">Phase 2: Repair Strategy</h3>
                                    <p className="text-sm text-amber-700 mb-4">
                                        Corrupted records found. Generate a repair plan to query EODHD for correct ISINs.
                                    </p>
                                    <button
                                        onClick={handleGenerateRepair}
                                        disabled={loading}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors"
                                    >
                                        🛠️ Generate Repair Manifest
                                    </button>
                                </div>
                            )}

                            {/* REPAIR RESULTS */}
                            {repairResult && (
                                <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                                    <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                        <span>📋</span> Repair Manifest Ready
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white p-3 rounded border border-indigo-100">
                                            <div className="text-xs text-indigo-400 font-bold uppercase">Analyzed</div>
                                            <div className="text-xl font-mono">{repairResult.total_analyzed}</div>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-indigo-100">
                                            <div className="text-xs text-indigo-400 font-bold uppercase">Auto-Resolvable</div>
                                            <div className="text-xl font-mono text-emerald-600">{repairResult.resolvable}</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-indigo-600 mb-2">
                                        Plan saved to: <strong>reports/repair_manifest.json</strong>
                                    </p>
                                    <p className="text-xs text-slate-500 italic">
                                        Review the manifest in Storage or wait for Phase 3 (Execution) implementation.
                                    </p>
                                </div>
                            )}

                            {/* Corrupted Table */}
                            {auditResult.sample?.length > 0 && (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                                        <span>Corrupted Sample (Top 20)</span>
                                    </div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3">Corrupted ID</th>
                                                <th className="px-4 py-3">Suggested Ticker</th>
                                                <th className="px-4 py-3 min-w-[200px]">Asset Name</th>
                                                <th className="px-4 py-3">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {auditResult.sample.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 font-mono text-red-600 font-bold">{row.id}</td>
                                                    <td className="px-4 py-3 font-mono text-emerald-600">{row.eod_ticker || 'MISSING'}</td>
                                                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={row.name}>{row.name}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-400 bg-slate-50 rounded px-2 py-1">{row.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
