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
} from "../components/ui/dialog";
import { ScrollArea } from "../components/ui/scroll-area";
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
} from "lucide-react";

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

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchProject();
    fetchUsers();
  }, [id]);

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

  const handleDeliverableToggle = async (task, deliverableId) => {
    const updatedDeliverables = task.deliverables.map((item) =>
      item.id === deliverableId ? { ...item, completed: !item.completed } : item
    );

    try {
      await api.updateTask(task.id, { deliverables: updatedDeliverables });
      fetchProject();
    } catch (error) {
      toast.error("Error al actualizar el entregable");
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

  const statusLabels = {
    active: "Activo",
    completed: "Completado",
    on_hold: "En Espera",
    cancelled: "Cancelado",
  };

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

        <div className="flex items-center gap-3 ml-12 lg:ml-0">
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
              {project.start_date}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Fecha Fin</p>
            <p className="font-medium text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {project.end_date}
            </p>
          </div>
        </div>
      </div>

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
                        {moduleData.completed}/{moduleData.total} tareas
                        completadas
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
                      const checklistCompleted = task.checklist?.filter(
                        (c) => c.completed
                      ).length;
                      const deliverablesCompleted = task.deliverables?.filter(
                        (d) => d.completed
                      ).length;

                      return (
                        <div
                          key={task.id}
                          className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => openTaskDialog(task)}
                          data-testid={`task-${task.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <StatusIcon
                                  className={`w-4 h-4 ${
                                    task.status === "completed"
                                      ? "text-emerald-500"
                                      : task.status === "in_progress"
                                      ? "text-indigo-500"
                                      : "text-slate-400"
                                  }`}
                                />
                                <h4 className="font-medium text-slate-900">
                                  {task.title}
                                </h4>
                              </div>
                              <p className="text-sm text-slate-500 line-clamp-1">
                                {task.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                {task.checklist?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {checklistCompleted}/{task.checklist.length}{" "}
                                    checklist
                                  </span>
                                )}
                                {task.deliverables?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {deliverablesCompleted}/
                                    {task.deliverables.length} entregables
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              className={STATUS_CONFIG[task.status]?.color}
                              variant="secondary"
                            >
                              {STATUS_CONFIG[task.status]?.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Description */}
                {selectedTask.description && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-2">
                      Descripción
                    </h4>
                    <p className="text-slate-700">{selectedTask.description}</p>
                  </div>
                )}

                {/* Status */}
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-2">
                    Estado
                  </h4>
                  <Select
                    value={selectedTask.status}
                    onValueChange={(value) => {
                      handleStatusChange(selectedTask.id, value);
                      setSelectedTask({ ...selectedTask, status: value });
                    }}
                  >
                    <SelectTrigger
                      className="w-48"
                      data-testid="task-status-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Checklist */}
                {selectedTask.checklist?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-3">
                      Checklist
                    </h4>
                    <div className="space-y-2">
                      {selectedTask.checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => {
                              handleChecklistToggle(selectedTask, item.id);
                              const updated = selectedTask.checklist.map((c) =>
                                c.id === item.id
                                  ? { ...c, completed: !c.completed }
                                  : c
                              );
                              setSelectedTask({
                                ...selectedTask,
                                checklist: updated,
                              });
                            }}
                            data-testid={`checklist-${item.id}`}
                          />
                          <span
                            className={`text-sm ${
                              item.completed
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deliverables */}
                {selectedTask.deliverables?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-3">
                      Entregables
                    </h4>
                    <div className="space-y-2">
                      {selectedTask.deliverables.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => {
                              handleDeliverableToggle(selectedTask, item.id);
                              const updated = selectedTask.deliverables.map(
                                (d) =>
                                  d.id === item.id
                                    ? { ...d, completed: !d.completed }
                                    : d
                              );
                              setSelectedTask({
                                ...selectedTask,
                                deliverables: updated,
                              });
                            }}
                            data-testid={`deliverable-${item.id}`}
                          />
                          <FileText
                            className={`w-4 h-4 ${
                              item.completed
                                ? "text-emerald-500"
                                : "text-slate-400"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              item.completed
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
