import { useState, useEffect } from "react";
import { api } from "../lib/api";
import {
    TrendingUp,
    Wallet,
    BarChart3,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    Coins,
    ArrowRight
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart as RePieChart,
    Pie
} from "recharts";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Income() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        completed: 0,
        byModule: [],
        byStatus: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await api.getProjects();
            const projectsData = response.data;
            setProjects(projectsData);
            calculateStats(projectsData);
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        let total = 0;
        let active = 0;
        let completed = 0;
        const moduleMap = {};
        const statusMap = {
            active: 0,
            completed: 0,
            on_hold: 0,
            cancelled: 0
        };

        data.forEach(p => {
            const cost = parseFloat(p.total_project_cost) || 0;
            total += cost;
            if (p.status === 'active') active += cost;
            if (p.status === 'completed') completed += cost;

            statusMap[p.status] = (statusMap[p.status] || 0) + cost;

            // Aggregating by module costs if available
            if (p.module_costs) {
                Object.entries(p.module_costs).forEach(([modId, modCost]) => {
                    moduleMap[modId] = (moduleMap[modId] || 0) + (parseFloat(modCost) || 0);
                });
            }
        });

        const byModule = Object.entries(moduleMap).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value
        })).sort((a, b) => b.value - a.value);

        const byStatus = Object.entries(statusMap).map(([name, value]) => ({
            name: name === 'active' ? 'Activos' :
                name === 'completed' ? 'Completados' :
                    name === 'on_hold' ? 'En Espera' : 'Cancelados',
            value
        }));

        setStats({ total, active, completed, byModule, byStatus });
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(val);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading font-bold text-2xl text-slate-900">Análisis de Ingresos</h1>
                    <p className="text-slate-500 mt-1">Resumen financiero basado en proyectos gestionados</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Proyectado</p>
                        <p className="font-bold text-lg text-slate-900 leading-tight">{formatCurrency(stats.total)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-base p-6 border-l-4 border-l-indigo-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Cartera Activa</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.active)}</p>
                    <p className="text-xs text-slate-400 mt-2">Impacto inmediato en tesorería</p>
                </div>

                <div className="card-base p-6 border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Facturación Cerrada</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.completed)}</p>
                    <p className="text-xs text-slate-400 mt-2">Proyectos completados con éxito</p>
                </div>

                <div className="card-base p-6 border-l-4 border-l-amber-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <div className="flex items-center text-amber-600 text-xs font-bold">
                            {Math.round((stats.completed / (stats.total || 1)) * 100)}%
                        </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Tasa de Conversión</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.total - stats.completed)}</p>
                    <p className="text-xs text-slate-400 mt-2">Volumen pendiente de liquidación</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card-base p-6 flex flex-col min-h-[400px]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <h3 className="font-heading font-semibold text-slate-900">Ingresos por Módulo</h3>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.byModule} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={80}
                                    tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val) => formatCurrency(val)}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.byModule.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card-base p-6 flex flex-col min-h-[400px]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-pink-50 p-2 rounded-lg text-pink-600">
                            <PieChart className="w-5 h-5" />
                        </div>
                        <h3 className="font-heading font-semibold text-slate-900">Estado de la Cartera</h3>
                    </div>
                    <div className="flex-1 w-full flex flex-col md:flex-row items-center">
                        <div className="w-full h-full min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={stats.byStatus}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.byStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(val) => formatCurrency(val)}
                                    />
                                </RePieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global</span>
                                <span className="text-xl font-bold text-slate-900">{formatCurrency(stats.total).split(',')[0]}</span>
                            </div>
                        </div>
                        <div className="w-full md:w-48 space-y-4">
                            {stats.byStatus.map((item, idx) => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                        <span className="text-xs text-slate-500">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-900">{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
