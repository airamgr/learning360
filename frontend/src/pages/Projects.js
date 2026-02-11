import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  Plus,
  Filter,
  ArrowRight,
  Calendar,
  Users,
  MoreVertical,
  Trash2,
  Edit,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";

const MODULE_NAMES = {
  design: "Diseño de Marca",
  tech: "Tecnología",
  marketing: "Marketing",
  sales: "Comercial",
  content: "Contenidos",
  admin: "Administrativo",
  academic: "Académico",
};

const MODULE_COLORS = {
  design: "module-design",
  tech: "module-tech",
  marketing: "module-marketing",
  sales: "module-sales",
  content: "module-content",
  admin: "module-admin",
  academic: "module-academic",
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const navigate = useNavigate();
  const { isManager, isAdmin } = useAuth();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, statusFilter]);

  const fetchProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (error) {
      toast.error("Error al cargar los proyectos");
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = [...projects];

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.client_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    setFilteredProjects(filtered);
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;

    try {
      await api.deleteProject(projectToDelete.id);
      toast.success("Proyecto eliminado");
      fetchProjects();
    } catch (error) {
      toast.error("Error al eliminar el proyecto");
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

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

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" data-testid="projects-loading">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="projects-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl text-slate-900">
            Proyectos
          </h1>
          <p className="text-slate-500 mt-1">
            {filteredProjects.length} proyectos encontrados
          </p>
        </div>
        {isManager && (
          <Button
            onClick={() => navigate("/projects/new")}
            className="bg-slate-900 hover:bg-slate-800 gap-2"
            data-testid="new-project-btn"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Buscar proyectos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200"
            data-testid="search-projects-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-full sm:w-48 bg-white"
            data-testid="status-filter"
          >
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="on_hold">En espera</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects List */}
      {filteredProjects.length > 0 ? (
        <div className="grid gap-4">
          {filteredProjects.map((project, index) => (
            <div
              key={project.id}
              className="card-base p-6 card-hover animate-slide-up"
              style={{
                animationDelay: `${index * 0.05}s`,
                animationFillMode: "both",
              }}
              data-testid={`project-item-${project.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Project Info - Corregido para no envolver elementos interactivos */}
                <div className="flex-1">
                  <div 
                    className="cursor-pointer group"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-heading font-semibold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {project.client_name}
                        </p>
                      </div>
                      <span
                        className={`status-badge ${statusColors[project.status]}`}
                      >
                        {statusLabels[project.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {project.start_date} - {project.end_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {project.total_tasks || 0} tareas
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {project.modules?.slice(0, 4).map((moduleId) => (
                        <span
                          key={moduleId}
                          className={`text-xs px-2 py-1 rounded-full border ${MODULE_COLORS[moduleId]}`}
                        >
                          {MODULE_NAMES[moduleId]}
                        </span>
                      ))}
                      {project.modules?.length > 4 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          +{project.modules.length - 4} más
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Progress
                        value={project.progress || 0}
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-medium text-slate-700 w-12 text-right">
                        {project.progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions - Fuera del div clickeable principal */}
                <div className="flex items-center gap-2 lg:ml-4">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="text-indigo-600 hover:text-indigo-700"
                    data-testid={`view-project-${project.id}`}
                  >
                    Ver detalles
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`project-menu-${project.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setProjectToDelete(project);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-base p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-heading font-semibold text-slate-700 mb-2">
            No se encontraron proyectos
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchTerm || statusFilter !== "all"
              ? "Intenta con otros filtros de búsqueda"
              : "Crea tu primer proyecto para comenzar"}
          </p>
          {isManager && !searchTerm && statusFilter === "all" && (
            <Button
              onClick={() => navigate("/projects/new")}
              className="bg-indigo-500 hover:bg-indigo-600"
              data-testid="empty-new-project-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Proyecto
            </Button>
          )}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todas las tareas
              asociadas al proyecto "{projectToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}