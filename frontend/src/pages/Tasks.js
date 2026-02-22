import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    Search,
    Filter,
    CheckCircle2,
    Clock,
    TrendingUp,
    Calendar,
    FolderKanban,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

const COLOR_OPTIONS = [
    { id: "slate", name: "Gris", class: "bg-slate-100 text-slate-700" },
    { id: "red", name: "Rojo", class: "bg-red-100 text-red-700" },
    { id: "orange", name: "Naranja", class: "bg-orange-100 text-orange-700" },
    { id: "amber", name: "Ámbar", class: "bg-amber-100 text-amber-700" },
    { id: "yellow", name: "Amarillo", class: "bg-yellow-100 text-yellow-700" },
    { id: "lime", name: "Lima", class: "bg-lime-100 text-lime-700" },
    { id: "green", name: "Verde", class: "bg-green-100 text-green-700" },
    { id: "emerald", name: "Esmeralda", class: "bg-emerald-100 text-emerald-700" },
    { id: "teal", name: "Teal", class: "bg-teal-100 text-teal-700" },
    { id: "cyan", name: "Cian", class: "bg-cyan-100 text-cyan-700" },
    { id: "blue", name: "Azul", class: "bg-blue-100 text-blue-700" },
    { id: "indigo", name: "Índigo", class: "bg-indigo-100 text-indigo-700" },
    { id: "violet", name: "Violeta", class: "bg-violet-100 text-violet-700" },
    { id: "purple", name: "Púrpura", class: "bg-purple-100 text-purple-700" },
    { id: "fuchsia", name: "Fucsia", class: "bg-fuchsia-100 text-fuchsia-700" },
    { id: "pink", name: "Rosa", class: "bg-pink-100 text-pink-700" },
];

const getColorClass = (color) => {
    const found = COLOR_OPTIONS.find(c => c.id === color);
    return found ? found.class : "bg-slate-100 text-slate-700";
};

const STATUS_CONFIG = {
    pending: { label: "Pendiente", color: "bg-slate-100 text-slate-600", icon: Clock },
    in_progress: { label: "En progreso", color: "bg-indigo-100 text-indigo-600", icon: TrendingUp },
    completed: { label: "Completada", color: "bg-emerald-100 text-emerald-600", icon: CheckCircle2 },
};

export default function Tasks() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const { user } = useAuth();
    const navigate = useNavigate();

    const activeTab = searchParams.get("tab") || "my";

    useEffect(() => {
        fetchTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        filterTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, searchTerm]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            let params = {};
            if (activeTab === "my") {
                params.assigned_to = user.id;
            } else if (activeTab === "pending") {
                params.status = "pending_all";
            } else if (activeTab === "completed") {
                params.status = "completed";
            }

            const response = await api.getTasks(params);
            setTasks(response.data);
        } catch (error) {
            toast.error("Error al cargar las tareas");
        } finally {
            setLoading(false);
        }
    };

    const filterTasks = () => {
        if (!searchTerm) {
            setFilteredTasks(tasks);
            return;
        }
        const lowerSearch = searchTerm.toLowerCase();
        setFilteredTasks(
            tasks.filter(
                (t) =>
                    t.title.toLowerCase().includes(lowerSearch) ||
                    t.project_name.toLowerCase().includes(lowerSearch)
            )
        );
    };

    const handleTabChange = (val) => {
        setSearchParams({ tab: val });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "Sin fecha";
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-6" data-testid="tasks-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading font-bold text-2xl text-slate-900">Listado de Tareas</h1>
                    <p className="text-slate-500 mt-1">Gestión centralizada de actividades</p>
                </div>
            </div>

            {/* Main Container */}
            <div className="card-base p-6">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <TabsList className="bg-slate-100 p-1 rounded-xl">
                            <TabsTrigger value="my" className="rounded-lg px-4 flex gap-2 items-center">
                                <TrendingUp className="w-4 h-4" /> Mis Tareas
                            </TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg px-4 flex gap-2 items-center">
                                <Clock className="w-4 h-4" /> Pendientes Equipo
                            </TabsTrigger>
                            <TabsTrigger value="completed" className="rounded-lg px-4 flex gap-2 items-center">
                                <CheckCircle2 className="w-4 h-4" /> Finalizadas
                            </TabsTrigger>
                        </TabsList>

                        <div className="relative w-full lg:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por título o proyecto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 border-slate-200 focus:ring-indigo-100"
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <p className="text-slate-500 animate-pulse">Cargando tareas...</p>
                            </div>
                        ) : filteredTasks.length > 0 ? (
                            <div className="grid gap-4">
                                {filteredTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all group animate-slide-up"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] uppercase tracking-wider border-none ${getColorClass(task.module_color)}`}
                                                    >
                                                        {task.module_name}
                                                    </Badge>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CONFIG[task.status]?.color}`}>
                                                        {STATUS_CONFIG[task.status]?.label}
                                                    </span>
                                                </div>
                                                <h3 className="font-heading font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                    {task.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1.5">
                                                        <FolderKanban className="w-3.5 h-3.5" />
                                                        {task.project_name}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Entrega: {formatDate(task.due_date)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/projects/${task.project_id}`)}
                                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 group/btn"
                                            >
                                                Ver Proyecto
                                                <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <Filter className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="font-heading font-semibold text-slate-700">Sin tareas encontradas</h3>
                                <p className="text-sm text-slate-500">No hay registros que coincidan con la vista actual</p>
                            </div>
                        )}
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
