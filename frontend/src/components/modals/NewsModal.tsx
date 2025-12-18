import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'

export default function NewsModal({ onClose }) {
    const [articles, setArticles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('general')
    const [ticker, setTicker] = useState('')

    useEffect(() => {
        loadNews()
    }, [filter])

    const loadNews = async () => {
        setLoading(true)
        try {
            const getNews = httpsCallable(functions, 'getFinancialNews')
            const mode = ticker ? 'ticker' : 'general'
            const query = ticker || filter

            const res = await getNews({ query, mode })
            if (res.data?.articles) {
                setArticles(res.data.articles)
            } else {
                setArticles([])
            }
        } catch (error) {
            console.error("Error loading news:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header Standardized */}
                <div className="p-2 border-b flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span>📰</span> Noticias Financieras
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
                </div>

                <div className="p-2 border-b flex gap-2 bg-white shrink-0">
                    <select
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value); setTicker(''); }}
                        className="px-2 py-1 border rounded text-xs focus:border-brand outline-none"
                    >
                        <option value="general">General</option>
                        <option value="macro">Macro</option>
                        <option value="crypto">Cripto</option>
                        <option value="tech">Tecnología</option>
                    </select>
                    <div className="flex-1 flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadNews()}
                            className="flex-1 px-2 py-1 border rounded text-xs focus:border-brand outline-none"
                        />
                        <button
                            onClick={loadNews}
                            className="bg-brand text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-700"
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 scrollbar-thin">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-4"></div>
                            <p className="text-xs font-bold text-slate-500 animate-pulse">Cargando noticias...</p>
                        </div>
                    ) : articles.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <span className="text-4xl block mb-2">📭</span>
                            No se encontraron noticias recientes.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {articles.map((a, i) => (
                                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                                    className="flex gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-brand transition-all group items-start">

                                    {/* Number Circle */}
                                    <div className="shrink-0 w-8 h-8 rounded-full bg-blue-50 text-brand font-bold flex items-center justify-center text-sm border border-blue-100 group-hover:bg-brand group-hover:text-white transition-colors">
                                        {i + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-bold text-brand leading-tight group-hover:text-blue-600 transition-colors truncate pr-2">
                                                {a.title}
                                            </h4>
                                            <span className="text-[9px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                                                {a.date ? new Date(a.date).toLocaleDateString() : 'Hoy'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">
                                            {a.description || a.summary || a.content || 'Sin descripción disponible.'}
                                        </p>

                                        {/* Detail Line */}
                                        <div className="border-t border-slate-100 pt-1 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{a.source || 'Fuente Externa'}</span>
                                            <span className="text-[10px] text-blue-500 font-bold group-hover:underline flex items-center gap-1">
                                                Leer Detalle <span>➜</span>
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
