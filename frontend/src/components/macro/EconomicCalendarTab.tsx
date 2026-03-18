import React, { useState, useEffect } from 'react';
import { CalendarDays, AlertTriangle, AlertCircle, Clock, Globe } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

interface CalendarEvent {
    title: string;
    country: string;
    date: string;
    impact: 'High' | 'Medium' | 'Low' | 'Holiday';
    forecast: string;
    previous: string;
}

export const EconomicCalendarTab: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCalendarData = async () => {
            try {
                const getCalendar = httpsCallable(functions, 'get_economic_calendar');
                const result = await getCalendar();
                const responseData = result.data as any;

                if (!responseData.success) {
                    throw new Error(responseData.error || "Error al obtener datos del calendario desde el servidor");
                }

                const data = responseData.data;

                // Filtrar eventos. Ocultamos 'Low' para reducir ruido.
                const filteredData = data.filter((e: any) => e.impact === 'High' || e.impact === 'Medium' || e.impact === 'Holiday');

                // Ordenar cronológicamente
                filteredData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                setEvents(filteredData);
            } catch (err: any) {
                console.error("Error fetching economic calendar:", err);
                setError(err.message || "Error desconocido al cargar el calendario");
            } finally {
                setLoading(false);
            }
        };

        fetchCalendarData();
    }, []);

    // Agrupar eventos por día
    const groupedEvents = events.reduce((acc, event) => {
        const dateObj = new Date(event.date);
        // Formato: "Lunes, 22 Feb"
        const dayStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
        const capitalizedDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);

        if (!acc[capitalizedDay]) {
            acc[capitalizedDay] = [];
        }
        acc[capitalizedDay].push(event);
        return acc;
    }, {} as Record<string, CalendarEvent[]>);

    const getImpactStyles = (impact: string) => {
        switch (impact) {
            case 'High':
                return { badge: 'bg-rose-50 text-rose-600 border border-rose-100', icon: <AlertTriangle className="w-3 h-3 text-rose-500" />, border: 'border-l-rose-500' };
            case 'Medium':
                return { badge: 'bg-amber-50 text-amber-600 border border-amber-100', icon: <AlertCircle className="w-3 h-3 text-amber-500" />, border: 'border-l-amber-400' };
            case 'Holiday':
                return { badge: 'bg-slate-50 text-slate-500 border border-slate-100', icon: <Globe className="w-3 h-3 text-slate-400" />, border: 'border-l-slate-300' };
            default:
                return { badge: 'bg-slate-50 text-slate-500 border border-slate-100', icon: null, border: 'border-l-slate-200' };
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    // Obtenemos qué día es hoy para resaltarlo
    const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
    const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-in fade-in">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Conectando con el calendario global...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 text-center bg-rose-50 border border-rose-100 rounded-3xl max-w-2xl mx-auto mt-10">
                <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-rose-800 mb-2">Error de Sincronización</h3>
                <p className="text-rose-600/80 mb-4">{error}</p>
                <p className="text-sm text-slate-500">Es posible que el feed público esté temporalmente inaccesible o bloqueado por red.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden py-8 px-6 md:px-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-5xl mx-auto">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pb-6 border-b border-slate-100">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <CalendarDays className="w-6 h-6" />
                            </div>
                            <h2 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Calendario Económico</h2>
                        </div>
                        <p className="text-slate-500 ml-1">Eventos macroeconómicos clave para la semana en curso (Impacto Medio/Alto).</p>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Fuente de Datos</span>
                        <div className="inline-flex items-center px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                            Forex Factory Data Feed
                        </div>
                    </div>
                </div>

                {Object.keys(groupedEvents).length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No hay eventos relevantes programados para esta semana.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedEvents).map(([day, dayEvents]) => {
                            const isToday = day === capitalizedToday;

                            return (
                                <div key={day} className={`relative ${isToday ? 'bg-indigo-50/30 -mx-4 px-4 py-3 rounded-2xl border border-indigo-50' : ''}`}>
                                    {isToday && (
                                        <div className="absolute top-3 right-4">
                                            <span className="bg-indigo-600 text-white text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full shadow-sm">Hoy</span>
                                        </div>
                                    )}
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center border-b border-slate-100 pb-1.5">
                                        <span className={isToday ? 'text-indigo-600' : ''}>{day}</span>
                                    </h3>

                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                        {dayEvents.map((ev, idx) => {
                                            const styles = getImpactStyles(ev.impact);
                                            const isLast = idx === dayEvents.length - 1;

                                            return (
                                                <div key={idx} className={`group relative px-3 py-2 md:py-2.5 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50/50 transition-colors ${!isLast ? 'border-b border-slate-50' : ''}`}>

                                                    {/* Impact Indicator Line */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.badge.split('text-')[1] ? 'bg-' + styles.badge.split('text-')[1].split(' ')[0] : 'bg-slate-200'}`} style={{ opacity: 0.8 }} />

                                                    {/* Left: Time & Country */}
                                                    <div className="flex items-center gap-3 pl-2 md:w-1/4">
                                                        <span className="text-xs font-medium text-slate-500 w-10">{formatTime(ev.date)}</span>
                                                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                                                            <span className="text-[10px] font-bold text-slate-700">{ev.country}</span>
                                                        </div>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 bg-transparent border-0 ${styles.badge.replace(/bg-\S+/g, '').replace(/border-\S+/g, '')}`}>
                                                            {styles.icon}
                                                            {ev.impact === 'Holiday' ? 'Festivo' : ev.impact}
                                                        </span>
                                                    </div>

                                                    {/* Center: Title */}
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-slate-800 text-xs leading-snug group-hover:text-indigo-600 transition-colors">{ev.title}</h4>
                                                    </div>

                                                    {/* Right: Data */}
                                                    <div className="flex items-center gap-4 md:w-1/4 md:justify-end">
                                                        {ev.impact !== 'Holiday' ? (
                                                            <>
                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[9px] uppercase font-bold text-slate-400">Prev</span>
                                                                    <span className="font-bold text-slate-800 text-xs">{ev.forecast || '-'}</span>
                                                                </div>
                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[9px] uppercase font-bold text-slate-400">Ant</span>
                                                                    <span className="font-medium text-slate-500 text-xs">{ev.previous || '-'}</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs italic text-slate-400 font-medium">Mercados cerrados</span>
                                                        )}
                                                    </div>

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
