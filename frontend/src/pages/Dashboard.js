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

      {/* Stats Grid */}
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
          label="Tareas Completadas"
          value={stats?.tasks?.completed || 0}
          subValue={`de ${stats?.tasks?.total || 0} tareas`}
          color="bg-emerald-100 text-emerald-600"
          onClick={() => navigate("/projects")}
        />
        <StatCard
          icon={Clock}
          label="Tareas Pendientes"
          value={stats?.tasks?.pending || 0}
          subValue={`${stats?.tasks?.in_progress || 0} en progreso`}
          color="bg-amber-100 text-amber-600"
          onClick={() => navigate("/projects")}
        />
        <StatCard
          icon={TrendingUp}
          label="Mis Tareas"
          value={stats?.my_tasks?.total || 0}
          subValue={`${stats?.my_tasks?.pending || 0} pendientes`}
          color="bg-blue-100 text-blue-600"
          onClick={() => navigate("/projects")}
        />
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
