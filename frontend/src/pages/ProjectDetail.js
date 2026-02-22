import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { DialogFooter } from "../components/ui/dialog";
import { DeliverableRepository } from "../components/DeliverableRepository";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Download,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  FileText,
  Package,
  Palette,
  Code,
  Megaphone,
  Users,
  BookOpen,
  Calculator,
  GraduationCap,
  FolderOpen,
  ListChecks,
  Euro,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";
import { EditProjectDialog } from "../components/EditProjectDialog";

const MODULE_ICONS = {
  design: Palette,
  tech: Code,
  marketing: Megaphone,
  sales: Users,
  content: BookOpen,
  admin: Calculator,
  academic: GraduationCap,
};

const MODULE_COLORS = {
  design: "bg-pink-100 text-pink-600",
  tech: "bg-blue-100 text-blue-600",
  marketing: "bg-purple-100 text-purple-600",
  sales: "bg-emerald-100 text-emerald-600",
  content: "bg-amber-100 text-amber-600",
  admin: "bg-slate-100 text-slate-600",
  academic: "bg-cyan-100 text-cyan-600",
};

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "status-pending", icon: Circle },
  in_progress: { label: "En Progreso", color: "status-in_progress", icon: Clock },
  completed: { label: "Completada", color: "status-completed", icon: CheckCircle2 },
};

const USER_TYPE_CONFIG = {
  comercial: { name: "Comercial", color: "bg-emerald-100 text-emerald-700" },
  marketing: { name: "Marketing", color: "bg-purple-100 text-purple-700" },
  administracion: { name: "Administración", color: "bg-slate-100 text-slate-700" },
  creativo: { name: "Creativo", color: "bg-pink-100 text-pink-700" },
  contenido: { name: "Contenido", color: "bg-amber-100 text-amber-700" },
  academico: { name: "Académico", color: "bg-cyan-100 text-cyan-700" },
  desarrollo: { name: "Desarrollo", color: "bg-blue-100 text-blue-700" },
  direccion: { name: "Dirección", color: "bg-red-100 text-red-700" },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager, user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedModuleForNewTask, setSelectedModuleForNewTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
  });
  const [users, setUsers] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState("");

  useEffect(() => {
    fetchProject();
    fetchUsers();
    fetchUserTypes();
  }, [id]);

  const fetchUserTypes = async () => {
    try {
      const response = await api.getUserTypes();
      setUserTypes(response.data);
    } catch (error) {
      console.error("Error fetching user types");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Pendiente";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Fallback for YYYY-MM-DD
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
      }
      return new Intl.DateTimeFormat('es-ES').format(date);
    } catch (e) {
      return date_str;
    }
  };

  const fetchProject = async () => {
    try {
      const response = await api.getProject(id);
      setProject(response.data);
    } catch (error) {
      toast.error("Error al cargar el proyecto");
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users");
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      toast.success("Estado actualizado");
      fetchProject();
    } catch (error) {
      toast.error("Error al actualizar el estado");
    }
  };

  const handleUserTypeChange = async (taskId, newUserType) => {
    try {
      await api.updateTask(taskId, { assigned_user_type: newUserType });
      toast.success("Tipo de usuario actualizado");
      fetchProject();
    } catch (error) {
      toast.error("Error al actualizar el tipo de usuario");
    }
  };

  const handleChecklistToggle = async (task, checklistItemId) => {
    const updatedChecklist = task.checklist.map((item) =>
      item.id === checklistItemId ? { ...item, completed: !item.completed } : item
    );

    try {
      await api.updateTask(task.id, { checklist: updatedChecklist });
      fetchProject();
    } catch (error) {
      toast.error("Error al actualizar el checklist");
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItemText.trim() || !selectedTask) return;

    const newItem = {
      id: Math.random().toString(36).substr(2, 9), // Temporary ID if needed, backend usually generates it but here we send the whole list
      text: newChecklistItemText.trim(),
      completed: false
    };

    const updatedChecklist = [...(selectedTask.checklist || []), newItem];

    try {
      await api.updateTask(selectedTask.id, { checklist: updatedChecklist });
      setSelectedTask({ ...selectedTask, checklist: updatedChecklist });
      setNewChecklistItemText("");
      fetchProject();
      toast.success("Hito añadido");
    } catch (error) {
      toast.error("Error al añadir hito");
    }
  };

  const handleDeleteChecklistItem = async (itemId) => {
    if (!selectedTask) return;

    const updatedChecklist = selectedTask.checklist.filter(item => item.id !== itemId);

    try {
      await api.updateTask(selectedTask.id, { checklist: updatedChecklist });
      setSelectedTask({ ...selectedTask, checklist: updatedChecklist });
      fetchProject();
      toast.success("Hito eliminado");
    } catch (error) {
      toast.error("Error al eliminar hito");
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta tarea? Esto borrará también sus entregables y archivos.")) {
      return;
    }
    try {
      await api.deleteTask(taskId);
      toast.success("Tarea eliminada");
      fetchProject();
    } catch (error) {
      toast.error("Error al eliminar la tarea");
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error("El título es obligatorio");
      return;
    }
    try {
      await api.createTask(id, {
        ...newTask,
        module_id: selectedModuleForNewTask,
        checklist: [],
        deliverables: []
      });
      toast.success("Tarea creada exitosamente");
      setCreateTaskOpen(false);
      setNewTask({ title: "", description: "", due_date: "" });
      fetchProject();
    } catch (error) {
      toast.error("Error al crear la tarea");
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const response = await api.exportProjectPdf(id);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proyecto_${project.name.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF exportado correctamente");
    } catch (error) {
      toast.error("Error al exportar el PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleProjectStatusChange = async (newStatus) => {
    try {
      await api.updateProject(id, { status: newStatus });
      toast.success("Estado del proyecto actualizado");
      fetchProject();
    } catch (error) {
      toast.error("Error al actualizar el estado");
    }
  };

  const openTaskDialog = (task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" data-testid="project-detail-loading">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!project) return null;

  const modules_metadata = Object.keys(project.modules_data || {}).reduce((acc, mid) => {
    acc[mid] = project.modules_data[mid].name;
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="shrink-0 mt-1"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading font-bold text-2xl text-slate-900">
              {project.name}
            </h1>
            <p className="text-slate-500 mt-1">{project.client_name}</p>
            {project.description && (
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-12 lg:ml-0">
        {isManager && (
          <>
            {/* Admin Edit Button */}
            {/* Note: In a real app we would check for 'admin' role, effectively checking isManager for now as strict requirement was 'Administrador' but logically Project Managers might also edit. Sticking to isManager which includes admins */}
            {/* But user requested specifically 'Administrator'. Let's check role if possible, or use isManager as proxy if current_user role not available in context easily beyond isManager bool. 
                   Actually useAuth provides 'user' object. */}
          </>
        )}

        {/* Explicitly check for admin role for the Edit button as requested */}
        {user?.role === 'admin' && (
          <Button
            variant="outline"
            onClick={() => setEditProjectOpen(true)}
            className="gap-2"
          >
            <Edit className="w-4 h-4" />
            Editar Proyecto
          </Button>
        )}

        {isManager && (
          <Select
            value={project.status}
            onValueChange={handleProjectStatusChange}
          >
            <SelectTrigger
              className="w-40"
              data-testid="project-status-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="on_hold">En Espera</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          onClick={handleExportPdf}
          disabled={exporting}
          data-testid="export-pdf-btn"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Exportar PDF
        </Button>
      </div>


      {/* Project Stats */}
      <div className="card-base p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Progreso General</p>
            <div className="flex items-center gap-3">
              <Progress value={project.progress || 0} className="flex-1 h-3" />
              <span className="font-heading font-bold text-xl text-slate-900">
                {project.progress || 0}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Tareas</p>
            <p className="font-heading font-bold text-xl text-slate-900">
              {project.completed_tasks || 0}{" "}
              <span className="text-slate-400 font-normal text-base">
                / {project.total_tasks || 0}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Fecha Inicio</p>
            <p className="font-medium text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {formatDate(project.start_date)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Fecha Fin</p>
            <p className="font-medium text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {formatDate(project.end_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Financial Stats */}
      {
        isManager && (
          <div className="card-base p-6">
            <h2 className="font-heading font-semibold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5 text-emerald-600" />
              Información Financiera
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-600 mb-1 font-medium flex items-center gap-2">
                  Coste Total Proyecto
                  {project.billing_mode === "project" && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200">
                      FIJO
                    </span>
                  )}
                </p>
                <p className="font-heading font-bold text-2xl text-slate-900">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(project.total_project_cost || 0)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-sm text-purple-600 mb-1 font-medium">Pago por Matrícula</p>
                <p className="font-heading font-bold text-2xl text-slate-900">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(project.enrollment_payment || 0)}
                </p>
              </div>
            </div>
          </div>
        )
      }

      {/* Modules */}
      <div className="card-base">
        <div className="p-6 border-b border-slate-200">
          <h2 className="font-heading font-semibold text-lg text-slate-900">
            Módulos del Proyecto
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {project.modules?.length} módulos contratados
          </p>
        </div>

        <Accordion type="multiple" className="w-full">
          {project.modules?.map((moduleId) => {
            const moduleData = project.modules_data?.[moduleId];
            if (!moduleData) return null;

            const Icon = MODULE_ICONS[moduleId] || Package;
            const colorClass = MODULE_COLORS[moduleId] || "bg-slate-100 text-slate-600";
            const moduleProgress =
              moduleData.total > 0
                ? Math.round((moduleData.completed / moduleData.total) * 100)
                : 0;

            return (
              <AccordionItem
                key={moduleId}
                value={moduleId}
                className="border-b border-slate-200 last:border-0"
              >
                <AccordionTrigger
                  className="px-6 py-4 hover:no-underline hover:bg-slate-50"
                  data-testid={`module-accordion-${moduleId}`}
                >
                  <div className="flex items-center gap-4 w-full pr-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-slate-900">
                        {moduleData.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <span>{moduleData.completed}/{moduleData.total} tareas</span>
                          {project.billing_mode === "module" && project.module_costs?.[moduleId] !== undefined && (
                            <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(project.module_costs[moduleId])}
                            </span>
                          )}
                        </div>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-32">
                      <Progress value={moduleProgress} className="flex-1 h-2" />
                      <span className="text-sm font-medium text-slate-600 w-10 text-right">
                        {moduleProgress}%
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-3 mt-2">
                    {moduleData.tasks?.map((task) => {
                      const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
                      const checklistCompleted = task.checklist?.filter((c) => c.completed).length;
                      const deliverablesWithFiles = task.deliverables?.filter((d) => d.file_url).length;

                      return (
                        <div
                          key={task.id}
                          className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group"
                          onClick={() => openTaskDialog(task)}
                          data-testid={`task-${task.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <StatusIcon
                                  className={`w-4 h-4 ${task.status === "completed"
                                    ? "text-emerald-500"
                                    : task.status === "in_progress"
                                      ? "text-indigo-500"
                                      : "text-slate-400"
                                    }`}
                                />
                                <h4 className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {task.title}
                                </h4>
                                {task.assigned_user_type && USER_TYPE_CONFIG[task.assigned_user_type] && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${USER_TYPE_CONFIG[task.assigned_user_type].color}`}>
                                    {USER_TYPE_CONFIG[task.assigned_user_type].name}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 line-clamp-1">
                                {task.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                {task.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(task.due_date)}
                                  </span>
                                )}
                                {task.assigned_to && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {users.find(u => u.id === task.assigned_to)?.name || 'Cargando...'}
                                  </span>
                                )}
                                {task.checklist?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {checklistCompleted}/{task.checklist.length} checklist
                                  </span>
                                )}
                                {task.deliverables?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FolderOpen className="w-3 h-3" />
                                    {deliverablesWithFiles}/{task.deliverables.length} archivos
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className={STATUS_CONFIG[task.status]?.color} variant="secondary">
                              {STATUS_CONFIG[task.status]?.label}
                            </Badge>
                            {isManager && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDeleteTask(task.id, e)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isManager && (
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-2 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 group py-6"
                        onClick={() => {
                          setSelectedModuleForNewTask(moduleId);
                          setNewTask({ ...newTask, due_date: project.end_date });
                          setCreateTaskOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                        Añadir Tarea Personalizada
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        {/* CORRECCIÓN: Max-height y overflow en el DialogContent */}
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {selectedTask?.title}
            </DialogTitle>
            {/* CORRECCIÓN: Añadida DialogDescription para accesibilidad */}
            <DialogDescription>
              Gestiona el progreso, checklist y archivos entregables de esta tarea.
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="details" className="gap-2">
                  <ListChecks className="w-4 h-4" />
                  Detalles y Checklist
                </TabsTrigger>
                <TabsTrigger value="deliverables" className="gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Entregables ({selectedTask.deliverables?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-hidden pt-4">
                <ScrollArea className="h-full max-h-[60vh]">
                  <div className="space-y-6 pr-4 pb-6">
                    {selectedTask.description && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Descripción</h4>
                        <p className="text-slate-700 text-sm">{selectedTask.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-2">Estado</h4>
                          <Select
                            value={selectedTask.status}
                            onValueChange={(value) => {
                              handleStatusChange(selectedTask.id, value);
                              setSelectedTask({ ...selectedTask, status: value });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="in_progress">En Progreso</SelectItem>
                              <SelectItem value="completed">Completada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-2">Asignado a (Departamento)</h4>
                          <Select
                            value={selectedTask.assigned_user_type || "none"}
                            onValueChange={async (value) => {
                              const newValue = value === "none" ? null : value;
                              try {
                                await api.updateTask(selectedTask.id, {
                                  assigned_user_type: newValue,
                                  assigned_to: null // Reset specific user when department changes
                                });
                                setSelectedTask({
                                  ...selectedTask,
                                  assigned_user_type: newValue,
                                  assigned_to: null
                                });
                                fetchProject();
                                toast.success("Departamento asignado");
                              } catch (error) {
                                toast.error("Error al asignar departamento");
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {Object.entries(USER_TYPE_CONFIG).map(([id, cfg]) => (
                                <SelectItem key={id} value={id}>{cfg.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Asignado a (Usuario)</h4>
                        <Select
                          disabled={!selectedTask.assigned_user_type}
                          value={selectedTask.assigned_to || "none"}
                          onValueChange={async (value) => {
                            const newValue = value === "none" ? null : value;
                            try {
                              await api.updateTask(selectedTask.id, { assigned_to: newValue });
                              setSelectedTask({ ...selectedTask, assigned_to: newValue });
                              fetchProject();
                              toast.success("Usuario asignado correctamente");
                            } catch (error) {
                              toast.error("Error al asignar usuario");
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={!selectedTask.assigned_user_type ? "Selecciona primero un departamento" : "Seleccionar usuario..."} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {users
                              .filter(u => u.user_type === selectedTask.assigned_user_type)
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {selectedTask.assigned_user_type && users.filter(u => u.user_type === selectedTask.assigned_user_type).length === 0 && (
                          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                            No hay usuarios registrados en este departamento
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-3">
                        Checklist ({selectedTask.checklist?.filter(c => c.completed).length || 0}/{selectedTask.checklist?.length || 0})
                      </h4>
                      <div className="space-y-2">
                        {selectedTask.checklist?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group/check">
                            <div className="flex items-center gap-3 flex-1">
                              <Checkbox
                                id={`check-${item.id}`}
                                checked={item.completed}
                                onCheckedChange={() => {
                                  handleChecklistToggle(selectedTask, item.id);
                                  const updated = selectedTask.checklist.map((c) =>
                                    c.id === item.id ? { ...c, completed: !c.completed } : c
                                  );
                                  setSelectedTask({ ...selectedTask, checklist: updated });
                                }}
                              />
                              <label htmlFor={`check-${item.id}`} className={`text-sm cursor-pointer select-none ${item.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                {item.text}
                              </label>
                            </div>
                            {isManager && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-300 hover:text-red-500 opacity-0 group-hover/check:opacity-100 transition-opacity"
                                onClick={() => handleDeleteChecklistItem(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}

                        {isManager && (
                          <div className="flex items-center gap-2 mt-4 pt-2">
                            <Input
                              placeholder="Nuevo hito o requisito..."
                              value={newChecklistItemText}
                              onChange={(e) => setNewChecklistItemText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                              className="flex-1 text-sm h-9"
                            />
                            <Button size="sm" className="h-9 px-3" onClick={handleAddChecklistItem}>
                              <Plus className="w-4 h-4 mr-1" />
                              Añadir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="deliverables" className="flex-1 overflow-hidden pt-4">
                <ScrollArea className="h-full max-h-[60vh]">
                  <div className="pr-4 pb-6">
                    <DeliverableRepository
                      deliverables={selectedTask.deliverables || []}
                      taskId={selectedTask.id}
                      taskTitle={null}
                      onUpdate={() => {
                        fetchProject();
                        api.getTask(selectedTask.id).then(res => setSelectedTask(res.data));
                      }}
                      isManager={isManager}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>


      <EditProjectDialog
        project={project}
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        onProjectUpdated={fetchProject}
      />

      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tarea para {modules_metadata[selectedModuleForNewTask]}</DialogTitle>
            <DialogDescription>
              Añade una tarea personalizada para este proyecto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título *</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ej: Revisión de artes finales"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Descripción</Label>
              <Textarea
                id="task-desc"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Detalles sobre la tarea..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Fecha de Entrega</Label>
              <Input
                id="task-due"
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask}>Crear Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}