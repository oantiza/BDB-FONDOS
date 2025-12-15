import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'

export default function NewsModal({ onClose }) {
    const [articles, setArticles] = useState([])
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-serif font-bold text-brand">📰 Noticias Financieras</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <div className="p-4 border-b flex gap-4 bg-white">
                    <select
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value); setTicker(''); }}
                        className="px-3 py-2 border rounded text-sm focus:border-brand outline-none"
                    >
                        <option value="general">General</option>
                        <option value="macro">Macroeconomía</option>
                        <option value="crypto">Cripto</option>
                        <option value="tech">Tecnología</option>
                    </select>
                    <div className="flex-1 flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar Ticker (ej: AAPL)..."
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadNews()}
                            className="flex-1 px-3 py-2 border rounded text-sm focus:border-brand outline-none"
                        />
                        <button
                            onClick={loadNews}
                            className="bg-brand text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-700"
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
                        <div className="flex flex-col gap-2">
                            {articles.map((a, i) => (
                                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200 shadow-sm hover:shadow-md hover:border-brand transition-all group">
                                    <span className="shrink-0 bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded uppercase w-16 text-center">{a.source || 'NEWS'}</span>
                                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                                        <h4 className="text-sm font-bold text-brand truncate group-hover:text-blue-600 transition-colors">{a.title}</h4>
                                        <span className="shrink-0 text-[10px] text-slate-400 font-mono">
                                            {a.date ? new Date(a.date).toLocaleDateString() : 'Hoy'}
                                        </span>
                                    </div>
                                    <span className="text-slate-300 text-xs">↗</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
