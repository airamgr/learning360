import { useState, useRef } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  MessageSquare,
  Plus,
  Loader2,
  File,
  Image,
  FileArchive,
  FileVideo,
} from "lucide-react";

const STATUS_CONFIG = {
  pending: {
    label: "Pendiente",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  in_review: {
    label: "En Revisión",
    color: "bg-blue-100 text-blue-700",
    icon: Eye,
  },
  approved: {
    label: "Aprobado",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rechazado",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

const getFileIcon = (fileType) => {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("zip") || fileType.includes("rar")) return FileArchive;
  if (fileType.startsWith("video/")) return FileVideo;
  return File;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function DeliverableCard({ deliverable, taskId, onUpdate, isManager }) {
  const [uploading, setUploading] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedback, setFeedback] = useState(deliverable.feedback || "");
  const [newStatus, setNewStatus] = useState(deliverable.status);
  const fileInputRef = useRef(null);

  const StatusIcon = STATUS_CONFIG[deliverable.status]?.icon || Clock;
  const FileIcon = getFileIcon(deliverable.file_type);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadDeliverableFile(taskId, deliverable.id, file);
      toast.success("Archivo subido correctamente");
      onUpdate();
    } catch (error) {
      toast.error("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      await api.updateDeliverable(taskId, deliverable.id, {
        status: newStatus,
        feedback: feedback,
      });
      toast.success("Entregable actualizado");
      setShowFeedbackDialog(false);
      onUpdate();
    } catch (error) {
      toast.error("Error al actualizar el entregable");
    }
  };

  const handleDownload = () => {
    if (deliverable.file_url) {
      window.open(
        `${process.env.REACT_APP_BACKEND_URL}${deliverable.file_url}`,
        "_blank"
      );
    }
  };

  return (
    <>
      <div
        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
        data-testid={`deliverable-card-${deliverable.id}`}
      >
        <div className="flex items-start gap-4">
          {/* File icon or upload area */}
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${deliverable.file_url
              ? "bg-indigo-50"
              : "bg-slate-100 border-2 border-dashed border-slate-300"
              }`}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            ) : deliverable.file_url ? (
              <FileIcon className="w-6 h-6 text-indigo-500" />
            ) : (
              <Upload className="w-6 h-6 text-slate-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-medium text-slate-900">
                {deliverable.name}
              </h4>
              <Badge
                className={STATUS_CONFIG[deliverable.status]?.color}
                variant="secondary"
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {STATUS_CONFIG[deliverable.status]?.label}
              </Badge>
            </div>

            {deliverable.description && (
              <p className="text-sm text-slate-500 mb-2">
                {deliverable.description}
              </p>
            )}

            {/* File info */}
            {deliverable.file_url ? (
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {deliverable.file_name}
                </span>
                <span>{formatFileSize(deliverable.file_size)}</span>
                {deliverable.uploaded_at && (
                  <span>
                    {new Date(deliverable.uploaded_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Sin archivo adjunto
              </p>
            )}

            {/* Feedback */}
            {deliverable.feedback && (
              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  {deliverable.feedback}
                </p>
              </div>
            )}

            {/* Due date */}
            {deliverable.due_date && (
              <p className="text-xs text-slate-400 mt-2">
                <Clock className="w-3 h-3 inline mr-1" />
                Fecha límite: {deliverable.due_date}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid={`upload-btn-${deliverable.id}`}
          >
            <Upload className="w-4 h-4 mr-1" />
            {deliverable.file_url ? "Reemplazar" : "Subir archivo"}
          </Button>

          {deliverable.file_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              data-testid={`download-btn-${deliverable.id}`}
            >
              <Download className="w-4 h-4 mr-1" />
              Descargar
            </Button>
          )}

          {isManager && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedbackDialog(true)}
                data-testid={`review-btn-${deliverable.id}`}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Revisar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (window.confirm("¿Estás seguro de que quieres eliminar este entregable?")) {
                    try {
                      await api.deleteDeliverable(taskId, deliverable.id);
                      toast.success("Entregable eliminado");
                      onUpdate();
                    } catch (error) {
                      toast.error("Error al eliminar el entregable");
                    }
                  }
                }}
                data-testid={`delete-deliverable-btn-${deliverable.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Entregable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Feedback / Comentarios</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Añade comentarios sobre el entregable..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFeedbackDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleStatusUpdate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeliverableRepository({
  deliverables,
  taskId,
  taskTitle,
  onUpdate,
  isManager,
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({
    name: "",
    description: "",
    due_date: "",
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newDeliverable.name) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setCreating(true);
    try {
      await api.createDeliverable(taskId, {
        task_id: taskId,
        ...newDeliverable,
      });
      toast.success("Entregable creado");
      setShowAddDialog(false);
      setNewDeliverable({ name: "", description: "", due_date: "" });
      onUpdate();
    } catch (error) {
      toast.error("Error al crear el entregable");
    } finally {
      setCreating(false);
    }
  };

  // Count by status
  const statusCounts = deliverables.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-slate-900">
            Repositorio de Entregables
          </h3>
          {taskTitle && (
            <p className="text-sm text-slate-500">{taskTitle}</p>
          )}
        </div>
        {isManager && (
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            data-testid="add-deliverable-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            Añadir Entregable
          </Button>
        )}
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge
            key={status}
            className={STATUS_CONFIG[status]?.color}
            variant="secondary"
          >
            {STATUS_CONFIG[status]?.label}: {count}
          </Badge>
        ))}
      </div>

      {/* Deliverables grid */}
      {deliverables.length > 0 ? (
        <div className="grid gap-4 grid-cols-1">
          {deliverables.map((deliverable) => (
            <DeliverableCard
              key={deliverable.id}
              deliverable={deliverable}
              taskId={taskId}
              onUpdate={onUpdate}
              isManager={isManager}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-slate-50 rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No hay entregables definidos</p>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Entregable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre del entregable *</Label>
              <Input
                value={newDeliverable.name}
                onChange={(e) =>
                  setNewDeliverable({ ...newDeliverable, name: e.target.value })
                }
                placeholder="Ej: Manual de usuario (PDF)"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={newDeliverable.description}
                onChange={(e) =>
                  setNewDeliverable({
                    ...newDeliverable,
                    description: e.target.value,
                  })
                }
                placeholder="Describe el entregable esperado..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input
                type="date"
                value={newDeliverable.due_date}
                onChange={(e) =>
                  setNewDeliverable({
                    ...newDeliverable,
                    due_date: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Crear Entregable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
