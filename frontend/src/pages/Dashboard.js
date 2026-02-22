import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  FolderKanban,
  CheckSquare,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";

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

const StatCard = ({ icon: Icon, label, value, subValue, color, onClick }) => (
  <div
    className="card-base p-6 card-hover cursor-pointer"
    onClick={onClick}
    data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 mb-1">{label}</p>
        <p className="font-heading font-bold text-3xl text-slate-900">
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-slate-400 mt-1">{subValue}</p>
        )}
      </div>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const ProjectCard = ({ project, onClick }) => {
  const statusColors = {
    active: "status-active",
    completed: "status-completed",
    on_hold: "status-on_hold",
    cancelled: "status-cancelled",
  };

  const statusLabels = {
    active: "Activo",
    completed: "Completado",
    on_hold: "En espera",
    cancelled: "Cancelado",
  };

  return (
    <div
      className="card-base p-5 card-hover cursor-pointer"
      onClick={onClick}
      data-testid={`project-card-${project.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-heading font-semibold text-slate-900 mb-1">
            {project.name}
          </h3>
          <p className="text-sm text-slate-500">{project.client_name}</p>
        </div>
        <span className={`status-badge ${statusColors[project.status]}`}>
          {statusLabels[project.status]}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Progreso</span>
          <span className="font-medium text-slate-700">
            {project.progress || 0}%
          </span>
        </div>
        <Progress value={project.progress || 0} className="h-2" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {project.modules?.length || 0} módulos
        </span>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isManager } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" data-testid="dashboard-loading">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Resumen de tus proyectos y tareas
          </p>
        </div>
        {isManager && (
          <Button
            onClick={() => navigate("/projects/new")}
            className="bg-slate-900 hover:bg-slate-800 gap-2"
            data-testid="dashboard-new-project-btn"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={FolderKanban}
          label="Proyectos Activos"
          value={stats?.projects?.active || 0}
          subValue={`${stats?.projects?.total || 0} en total`}
          color="bg-indigo-100 text-indigo-600"
          onClick={() => navigate("/projects")}
        />
        <StatCard
          icon={CheckSquare}
          label="Total Completadas"
          value={stats?.tasks?.completed || 0}
          subValue="Acumulado total"
          color="bg-emerald-100 text-emerald-600"
          onClick={() => navigate("/tasks?tab=completed")}
        />
        <StatCard
          icon={Clock}
          label="Total Pendientes"
          value={stats?.tasks?.pending || 0}
          subValue={`${stats?.tasks?.in_progress || 0} en curso`}
          color="bg-amber-100 text-amber-600"
          onClick={() => navigate("/tasks?tab=pending")}
        />
        <StatCard
          icon={TrendingUp}
          label="Mis Tareas"
          value={stats?.my_tasks?.total || 0}
          subValue={`${stats?.my_tasks?.pending || 0} por hacer`}
          color="bg-blue-100 text-blue-600"
          onClick={() => navigate("/tasks?tab=my")}
        />
      </div>

      {/* Detailed Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* My Tasks Detailed Panel */}
        <div className="card-base p-6 flex flex-col h-[500px]" data-testid="stat-mis-tareas-detalle">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="font-heading font-semibold text-lg text-slate-900">Mis Tareas</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">Personal</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-3 space-y-6 custom-scrollbar">
            {stats?.my_tasks_grouped && Object.keys(stats.my_tasks_grouped).length > 0 ? (
              Object.entries(stats.my_tasks_grouped).map(([projectName, modules]) => (
                <div key={projectName} className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {projectName}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 ml-4">
                    {Object.entries(modules).map(([moduleName, data]) => (
                      <div key={moduleName} className="space-y-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${getColorClass(data.color)}`}>
                          {moduleName}
                        </span>
                        <ul className="space-y-1 pl-1">
                          {data.tasks.map((taskTitle, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                              {taskTitle}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60 text-center">
                <TrendingUp className="w-12 h-12" />
                <p className="text-sm italic">No tienes tareas asignadas</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Tasks Detailed Panel */}
        <div className="card-base p-6 flex flex-col h-[500px]" data-testid="stat-tareas-pendientes-detalle">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="font-heading font-semibold text-lg text-slate-900">Tareas Pendientes</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase">Equipo</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-3 space-y-6 custom-scrollbar">
            {stats?.pending_tasks_grouped && Object.keys(stats.pending_tasks_grouped).length > 0 ? (
              Object.entries(stats.pending_tasks_grouped).map(([projectName, modules]) => (
                <div key={projectName} className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {projectName}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 ml-4">
                    {Object.entries(modules).map(([moduleName, data]) => (
                      <div key={moduleName} className="space-y-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${getColorClass(data.color)}`}>
                          {moduleName}
                        </span>
                        <ul className="space-y-1 pl-1">
                          {data.tasks.map((taskTitle, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                              {taskTitle}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60 text-center">
                <Clock className="w-12 h-12" />
                <p className="text-sm italic">No hay tareas pendientes en el equipo</p>
              </div>
            )}
          </div>
        </div>

        {/* Completed Tasks Detailed Panel */}
        <div className="card-base p-6 flex flex-col h-[500px]" data-testid="stat-tareas-completadas-detalle">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckSquare className="w-5 h-5" />
              </div>
              <h2 className="font-heading font-semibold text-lg text-slate-900">Tareas Completadas</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">Histórico</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-3 space-y-6 custom-scrollbar">
            {stats?.completed_tasks_grouped && Object.keys(stats.completed_tasks_grouped).length > 0 ? (
              Object.entries(stats.completed_tasks_grouped).map(([projectName, modules]) => (
                <div key={projectName} className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {projectName}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 ml-4">
                    {Object.entries(modules).map(([moduleName, data]) => (
                      <div key={moduleName} className="space-y-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${getColorClass(data.color)}`}>
                          {moduleName}
                        </span>
                        <ul className="space-y-1 pl-1">
                          {data.tasks.map((taskTitle, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                              {taskTitle}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60 text-center">
                <CheckSquare className="w-12 h-12" />
                <p className="text-sm italic">Sin tareas completadas recientemente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-lg text-slate-900">
            Proyectos Recientes
          </h2>
          <Button
            variant="ghost"
            onClick={() => navigate("/projects")}
            className="text-indigo-600 hover:text-indigo-700"
            data-testid="view-all-projects-btn"
          >
            Ver todos
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {stats?.recent_projects?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.recent_projects.map((project, index) => (
              <div
                key={project.id}
                className={`animate-slide-up stagger-${index + 1}`}
                style={{ animationFillMode: "both" }}
              >
                <ProjectCard
                  project={project}
                  onClick={() => navigate(`/projects/${project.id}`)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="card-base p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-heading font-semibold text-slate-700 mb-2">
              No hay proyectos todavía
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Crea tu primer proyecto para comenzar a gestionar tus tareas
            </p>
            {isManager && (
              <Button
                onClick={() => navigate("/projects/new")}
                className="bg-indigo-500 hover:bg-indigo-600"
                data-testid="empty-state-new-project-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Proyecto
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
