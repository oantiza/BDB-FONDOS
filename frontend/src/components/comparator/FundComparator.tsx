import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, X, TrendingUp, Activity, AlertTriangle, Star } from 'lucide-react';
import { normalizeFundData, adaptFundV3ToLegacy } from '../../utils/normalizer';
import { translateAssetClass, translateRegion } from '../../utils/fundTaxonomy';
import { translateAssetSubtype } from '../../utils/taxonomyTranslators';

export default function FundComparator() {
    // --- State ---
    const [allFunds, setAllFunds] = useState<any[]>([]);
    const [loadingFunds, setLoadingFunds] = useState(false);

    // Selection
    const [selectedFunds, setSelectedFunds] = useState<any[]>([]);
    const [fundHistories, setFundHistories] = useState<Record<string, any[]>>({});

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [subcategoryFilter, setSubcategoryFilter] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [showRetroModal, setShowRetroModal] = useState(false);

    // View
    const [period, setPeriod] = useState<1 | 3 | 5 | 10>(3);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // --- Data Loaders ---

    // 1. Load Fund List (Index)
    useEffect(() => {
        const loadFunds = async () => {
            setLoadingFunds(true);
            try {
                const q = query(collection(db, 'funds_v3'));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => {
                    const raw = { id: d.id, ...d.data() } as any;
                    const norm = normalizeFundData(adaptFundV3ToLegacy(raw));
                    return {
                        id: norm.id || raw.id,
                        isin: norm.isin || raw.id,
                        name: norm.name || norm.fondo || raw.id,
                        category: raw.classification_v2?.asset_type || 'UNKNOWN',
                        subcategory: raw.classification_v2?.asset_subtype || 'General',
                        region: raw.classification_v2?.region_primary || 'GLOBAL',
                        retro: norm.std_extra?.retrocession ?? norm.manual?.costs?.retrocession ?? norm.costs?.retrocession ?? null,
                        rating: norm.std_extra?.rating_stars ?? 0
                    };
                });
                setAllFunds(list);
            } catch (error) {
                console.error("Error loading funds", error);
            } finally {
                setLoadingFunds(false);
            }
        };
        loadFunds();
    }, []);

    // 2. Load History for Selected
    const addFund = async (fund: any) => {
        if (selectedFunds.find(f => f.id === fund.id)) return;
        if (selectedFunds.length >= 5) return alert("Máximo 5 fondos para comparar");

        const newSelection = [...selectedFunds, fund];
        setSelectedFunds(newSelection);

        // Fetch history if not present
        if (!fundHistories[fund.id]) {
            setLoadingHistory(true);
            try {
                const historyId = fund.isin || fund.id;
                const docRef = doc(db, 'historico_vl_v2', historyId);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    const history = Array.isArray(data.history) ? data.history : [];
                    history.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    setFundHistories(prev => ({ ...prev, [fund.id]: history }));
                } else {
                    console.warn(`No history for ${historyId}`);
                    setFundHistories(prev => ({ ...prev, [fund.id]: [] }));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingHistory(false);
            }
        }
    };

    const removeFund = (id: string) => {
        setSelectedFunds(prev => prev.filter(f => f.id !== id));
    };

    // --- Derived Data ---
    const classes = useMemo(() => Array.from(new Set(allFunds.map(f => f.category))).sort(), [allFunds]);
    const subcategories = useMemo(() => {
        const filtered = categoryFilter ? allFunds.filter(f => f.category === categoryFilter) : allFunds;
        return Array.from(new Set(filtered.map(f => f.subcategory).filter(s => s && s !== 'UNKNOWN' && s !== 'General'))).sort();
    }, [allFunds, categoryFilter]);
    const regions = useMemo(() => Array.from(new Set(allFunds.map(f => f.region))).sort(), [allFunds]);

    const searchResults = useMemo(() => {
        if (!searchTerm && !categoryFilter && !subcategoryFilter && !regionFilter) return [];
        return allFunds.filter(f => {
            const matchesTerm = !searchTerm ||
                f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                f.isin.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = !categoryFilter || f.category === categoryFilter;
            const matchesSub = !subcategoryFilter || f.subcategory === subcategoryFilter;
            const matchesReg = !regionFilter || f.region === regionFilter;
            return matchesTerm && matchesCat && matchesSub && matchesReg;
        }).slice(0, 10);
    }, [allFunds, searchTerm, categoryFilter, subcategoryFilter, regionFilter]);

    const filteredForModal = useMemo(() => {
        return allFunds.filter(f => {
            const matchesCat = !categoryFilter || f.category === categoryFilter;
            const matchesSub = !subcategoryFilter || f.subcategory === subcategoryFilter;
            const matchesReg = !regionFilter || f.region === regionFilter;
            return matchesCat && matchesSub && matchesReg;
        }).sort((a, b) => {
            const retroA = typeof a.retro === 'number' ? a.retro : parseFloat(a.retro) || 0;
            const retroB = typeof b.retro === 'number' ? b.retro : parseFloat(b.retro) || 0;
            return retroB - retroA;
        });
    }, [allFunds, categoryFilter, subcategoryFilter, regionFilter]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        if (selectedFunds.length === 0) return [];
        const now = new Date();
        const startYear = now.getFullYear() - period;
        const startDate = new Date(now.setFullYear(startYear));

        const dateMap = new Map<string, any>();

        selectedFunds.forEach(fund => {
            const hist = fundHistories[fund.id] || [];
            const relevant = hist.filter((pt: any) => new Date(pt.date) >= startDate);

            if (relevant.length === 0) return;

            const baseVal = relevant[0].nav;
            relevant.forEach((pt: any) => {
                const day = pt.date.split('T')[0];
                if (!dateMap.has(day)) dateMap.set(day, { date: day });
                const entry = dateMap.get(day);
                entry[fund.id] = (pt.nav / baseVal) * 100;
            });
        });

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [selectedFunds, fundHistories, period]);


    // --- Metrics ---
    const Metrics = useMemo(() => {
        const calc = (fundId: string) => {
            const history = fundHistories[fundId] || [];
            if (history.length < 2) return null;

            const now = new Date();
            const getSlice = (years: number) => {
                const start = new Date(new Date().setFullYear(now.getFullYear() - years));
                const slice = history.filter((p: any) => new Date(p.date) >= start);
                return slice;
            }

            const slice1Y = getSlice(1);
            const slice3Y = getSlice(3);
            const slice5Y = getSlice(5);
            const slice10Y = getSlice(10);

            const getReturn = (slice: any[]) => {
                if (slice.length === 0) return '-';
                const first = slice[0].nav;
                const last = slice[slice.length - 1].nav;
                return ((last - first) / first * 100).toFixed(2) + '%';
            }

            const getVol = (slice: any[]) => {
                if (slice.length < 30) return '-';
                const returns = [];
                for (let i = 1; i < slice.length; i++) {
                    returns.push((slice[i].nav - slice[i - 1].nav) / slice[i - 1].nav);
                }
                const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
                const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
                const vol = Math.sqrt(variance) * Math.sqrt(252) * 100;
                return vol.toFixed(2) + '%';
            }

            const getSharpe = (slice: any[]) => {
                if (slice.length < 30) return '-';
                const returns = [];
                for (let i = 1; i < slice.length; i++) {
                    returns.push((slice[i].nav - slice[i - 1].nav) / slice[i - 1].nav);
                }
                const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
                const annualReturn = mean * 252;

                const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
                const vol = Math.sqrt(variance) * Math.sqrt(252);

                const rf = 0.02;
                const sharpe = (annualReturn - rf) / vol;
                return sharpe.toFixed(2);
            }

            const getMaxDD = (slice: any[]) => {
                if (slice.length === 0) return '-';
                let maxVal = -Infinity;
                let maxDD = 0;
                for (const p of slice) {
                    if (p.nav > maxVal) maxVal = p.nav;
                    const dd = (p.nav - maxVal) / maxVal;
                    if (dd < maxDD) maxDD = dd;
                }
                return (maxDD * 100).toFixed(2) + '%';
            }

            return {
                ret1Y: getReturn(slice1Y),
                ret3Y: getReturn(slice3Y),
                ret5Y: getReturn(slice5Y),
                ret10Y: getReturn(slice10Y),
                vol1Y: getVol(slice1Y),
                vol3Y: getVol(slice3Y),
                sharpe3Y: getSharpe(slice3Y),
                maxDD3Y: getMaxDD(slice3Y)
            }
        };

        return selectedFunds.reduce((acc, f) => {
            acc[f.id] = calc(f.id);
            return acc;
        }, {} as Record<string, any>);

    }, [selectedFunds, fundHistories]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-300">
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            <TrendingUp className="text-blue-600" size={32} />
                            Comparador de Fondos
                        </h1>
                        <p className="text-base text-slate-500 mt-1 ml-11">Analiza y compara el rendimiento histórico de fondos individuales</p>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                        {[1, 3, 5, 10].map((y) => (
                            <button
                                key={y}
                                onClick={() => setPeriod(y as any)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${period === y ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                                    }`}
                            >
                                {y}Y
                            </button>
                        ))}
                    </div>
                </div>

                {/* Selection Area */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 mb-6">
                    <div className="flex gap-4">
                        {/* Filters */}
                        <div className="w-48 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                            <select
                                className="w-full bg-slate-50 border-slate-200 border rounded-lg p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={categoryFilter}
                                onChange={e => {
                                    setCategoryFilter(e.target.value);
                                    setSubcategoryFilter('');
                                }}
                            >
                                <option value="">Todas</option>
                                {classes.map(c => <option key={c} value={c}>{translateAssetClass(c)}</option>)}
                            </select>
                        </div>

                        <div className="w-48 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Subcategoría</label>
                            <select
                                className="w-full bg-slate-50 border-slate-200 border rounded-lg p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={subcategoryFilter}
                                onChange={e => setSubcategoryFilter(e.target.value)}
                            >
                                <option value="">Todas</option>
                                {subcategories.map(s => <option key={s} value={s}>{translateAssetSubtype(s) || s}</option>)}
                            </select>
                        </div>

                        <div className="w-48 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Región</label>
                            <select
                                className="w-full bg-slate-50 border-slate-200 border rounded-lg p-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={regionFilter}
                                onChange={e => setRegionFilter(e.target.value)}
                            >
                                <option value="">Todas</option>
                                {regions.map(r => <option key={r} value={r}>{translateRegion(r)}</option>)}
                            </select>
                        </div>

                        {/* Search & Action */}
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Añadir Fondo / Ver Filtro</label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        className="w-full bg-slate-50 border-slate-200 border rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:bg-white"
                                        placeholder="Buscar por Nombre o ISIN..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    {/* Dropdown Results */}
                                    {searchTerm.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                                            {loadingFunds ? <div className="p-4 text-center text-slate-500">Cargando...</div> :
                                                searchResults.length === 0 ? <div className="p-4 text-center text-slate-500">No encontrado</div> :
                                                    searchResults.map(f => (
                                                        <div
                                                            key={f.id}
                                                            onClick={() => { addFund(f); setSearchTerm(''); }}
                                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                        >
                                                            <div className="font-bold text-slate-800 text-sm">{f.name}</div>
                                                            <div className="flex gap-2 text-[11px] text-slate-500 mt-1 uppercase items-center">
                                                                <span className="font-mono bg-slate-100 px-1.5 rounded text-blue-600">{f.isin}</span>
                                                                <span className="bg-blue-50 text-blue-700 font-bold px-1.5 rounded border border-blue-100">{translateAssetClass(f.category)}</span>
                                                                {f.subcategory && f.subcategory !== 'General' && f.subcategory !== 'UNKNOWN' && (
                                                                    <>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span>{translateAssetSubtype(f.subcategory) || f.subcategory}</span>
                                                                    </>
                                                                )}
                                                                <span className="text-slate-300">•</span>
                                                                <span>{translateRegion(f.region)}</span>
                                                                {f.rating > 0 && (
                                                                    <>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="flex items-center text-amber-400">
                                                                            {Array.from({ length: f.rating }).map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowRetroModal(true)}
                                    className="bg-purple-50 text-purple-600 px-5 py-2.5 rounded-lg text-sm font-bold border border-purple-200 hover:bg-purple-100 transition whitespace-nowrap shadow-sm flex items-center gap-2"
                                    title="Ver todos los fondos filtrados con sus retrocesiones"
                                >
                                    Ver Todos ({filteredForModal.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Selected Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pt-2">
                        {selectedFunds.map((f, i) => (
                            <div key={f.id} className="flex flex-col bg-white pl-4 pr-3 py-3 rounded-xl border border-slate-200 group shadow-sm transition-all hover:shadow-md relative" style={{ borderTop: `4px solid ${COLORS[i % COLORS.length]}` }}>
                                <div className="flex items-start justify-between w-full mb-2">
                                    <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight pr-4" title={f.name}>{f.name}</div>
                                    <button onClick={() => removeFund(f.id)} className="absolute top-2 right-2 p-1 bg-slate-50 hover:bg-red-50 hover:text-red-600 rounded-md transition text-slate-400 group-hover:block"><X size={14} /></button>
                                </div>
                                <div className="mt-auto flex flex-wrap gap-1.5 items-center">
                                    <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-bold">
                                        {translateAssetClass(f.category)}
                                    </span>
                                    {f.subcategory && f.subcategory !== 'General' && f.subcategory !== 'UNKNOWN' && (
                                        <span className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide truncate max-w-[120px]" title={translateAssetSubtype(f.subcategory) || f.subcategory}>
                                            {translateAssetSubtype(f.subcategory) || f.subcategory}
                                        </span>
                                    )}
                                    <span className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide">
                                        {translateRegion(f.region)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {selectedFunds.length === 0 && <span className="text-slate-400 text-sm italic py-2">Selecciona fondos para comparar...</span>}
                    </div>
                </div>

                {/* Chart Section */}
                {selectedFunds.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative flex-1 min-h-0">
                        {loadingHistory && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
                                <Activity className="animate-spin text-blue-600" size={48} />
                            </div>
                        )}

                        {/* Chart */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-[400px] flex flex-col">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Activity size={20} className="text-slate-400" /> Performance Relativa (Rebase 100)</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#94a3b8"
                                            fontSize={12}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString()}
                                            minTickGap={50}
                                        />
                                        <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                            formatter={(val: any) => typeof val === 'number' ? val.toFixed(2) : val}
                                        />
                                        <Legend />
                                        {selectedFunds.map((f, i) => (
                                            <Line
                                                key={f.id}
                                                type="monotone"
                                                dataKey={f.id}
                                                name={f.name}
                                                stroke={COLORS[i % COLORS.length]}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Metrics Table */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2"><AlertTriangle size={20} className="text-slate-400" /> Métricas de Riesgo y Retorno</h3>
                                <span className="text-xs text-slate-400">* Sharpe calculado sobre 3 años (RF 2%). Volatilidad anualizada.</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-lg font-semibold">Fondo</th>
                                            <th className="px-4 py-3 text-right text-emerald-600 font-semibold">Ret 1Y</th>
                                            <th className="px-4 py-3 text-right text-emerald-600 font-semibold">Ret 3Y</th>
                                            <th className="px-4 py-3 text-right text-emerald-600 font-semibold">Ret 5Y</th>
                                            <th className="px-4 py-3 text-right text-emerald-600 font-semibold">Ret 10Y</th>
                                            <th className="px-4 py-3 text-center text-amber-500 font-semibold">Nota</th>
                                            <th className="px-4 py-3 text-right text-purple-600 font-semibold">Retro</th>
                                            <th className="px-4 py-3 text-right text-amber-600 font-semibold">Vol 1Y</th>
                                            <th className="px-4 py-3 text-right text-amber-600 font-semibold">Vol 3Y</th>
                                            <th className="px-4 py-3 text-right text-blue-600 font-semibold">Sharpe 3Y</th>
                                            <th className="px-4 py-3 text-right text-red-600 font-semibold rounded-tr-lg">DD 3Y</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedFunds.map((f, i) => {
                                            const m = Metrics[f.id];
                                            if (!m) return null;
                                            return (
                                                <tr key={f.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium flex items-center gap-2 text-slate-800">
                                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                                        <span className="truncate max-w-xs" title={f.name}>{f.name}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.ret1Y}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.ret3Y}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.ret5Y}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.ret10Y}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex justify-center text-amber-400 gap-0.5">
                                                            {f.rating > 0 ? Array.from({ length: f.rating }).map((_, i) => (
                                                                <Star key={i} size={12} fill="currentColor" />
                                                            )) : <span className="text-slate-300 text-xs">-</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-purple-600 font-bold">{f.retro ? f.retro + '%' : '-'}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.vol1Y}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{m.vol3Y}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-blue-700">{m.sharpe3Y}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-red-500">{m.maxDD3Y}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Retrocession Modal */}
            {showRetroModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 lg:p-8">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/80">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Star className="text-purple-500" size={24} />
                                    Listado de Fondos por Filtro
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Mostrando {filteredForModal.length} fondo{filteredForModal.length !== 1 && 's'}
                                    {categoryFilter && <span> en categoría <strong className="text-slate-700">{categoryFilter}</strong></span>}
                                    {subcategoryFilter && <span>, subcategoría <strong className="text-slate-700">{subcategoryFilter}</strong></span>}
                                    {regionFilter && <span> y región <strong className="text-slate-700">{regionFilter}</strong></span>}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRetroModal(false)}
                                className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-sm border border-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1 bg-white">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 w-12 text-center text-xs font-bold">
                                            {selectedFunds.length}/5
                                        </th>
                                        <th className="px-6 py-4 font-bold text-slate-700">Fondo</th>
                                        <th className="px-6 py-4 font-bold">ISIN</th>
                                        <th className="px-6 py-4 font-bold">Categoría</th>
                                        <th className="px-6 py-4 font-bold">Región</th>
                                        <th className="px-6 py-4 font-bold text-center">Nota</th>
                                        <th className="px-6 py-4 font-bold text-right text-purple-700">Retrocesión</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredForModal.map(f => {
                                        const isSelected = selectedFunds.some(sel => sel.id === f.id);
                                        return (
                                        <tr key={f.id} 
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/40' : ''}`}
                                            onClick={() => {
                                                if (isSelected) removeFund(f.id);
                                                else addFund(f);
                                            }}
                                        >
                                            <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) addFund(f);
                                                        else removeFund(f.id);
                                                    }}
                                                />
                                            </td>
                                            <td className="px-6 py-3 font-medium text-slate-800">{f.name}</td>
                                            <td className="px-6 py-3 text-slate-500 font-mono text-xs">{f.isin}</td>
                                            <td className="px-6 py-3 text-slate-500">
                                                <div className="font-medium text-slate-700">{translateAssetClass(f.category)}</div>
                                                {f.subcategory && f.subcategory !== 'General' && f.subcategory !== 'UNKNOWN' && (
                                                    <div className="text-[11px] text-slate-400 uppercase tracking-wide mt-0.5">{translateAssetSubtype(f.subcategory) || f.subcategory}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-slate-500">{translateRegion(f.region)}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-center text-amber-400 gap-0.5">
                                                    {f.rating > 0 ? Array.from({ length: f.rating }).map((_, i) => (
                                                        <Star key={i} size={12} fill="currentColor" />
                                                    )) : <span className="text-slate-300 text-xs">-</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-purple-600 font-bold bg-purple-50/30">
                                                {f.retro ? f.retro + '%' : <span className="text-slate-300">-</span>}
                                            </td>
                                        </tr>
                                    )})}
                                    {filteredForModal.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <Search size={48} className="mb-4 opacity-20" />
                                                    <p className="text-lg text-slate-500 font-medium">No hay fondos que coincidan con los filtros seleccionados.</p>
                                                    <p className="text-sm mt-1">Intenta seleccionar de nuevo la categoría o región.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
