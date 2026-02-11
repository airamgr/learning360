import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
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
import { toast } from "sonner";
import {
  Users,
  Shield,
  Briefcase,
  Package,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Settings,
  CheckSquare,
  FileText,
} from "lucide-react";

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

// ============ USER TYPES TAB ============
function UserTypesTab() {
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", color: "slate" });

  useEffect(() => { fetchUserTypes(); }, []);

  const fetchUserTypes = async () => {
    try {
      const response = await api.adminGetUserTypes();
      setUserTypes(response.data);
    } catch (error) {
      toast.error("Error al cargar tipos de usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name) {
      toast.error("ID y nombre son obligatorios");
      return;
    }

    try {
      if (editingType) {
        await api.adminUpdateUserType(editingType.id, formData);
        toast.success("Tipo de usuario actualizado");
      } else {
        await api.adminCreateUserType(formData);
        toast.success("Tipo de usuario creado");
      }
      setDialogOpen(false);
      setEditingType(null);
      setFormData({ id: "", name: "", color: "slate" });
      fetchUserTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDelete = async () => {
    try {
      await api.adminDeleteUserType(editingType.id);
      toast.success("Tipo de usuario eliminado");
      setDeleteDialogOpen(false);
      setEditingType(null);
      fetchUserTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    }
  };

  const openEdit = (type) => {
    setEditingType(type);
    setFormData({ ...type });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingType(null);
    setFormData({ id: "", name: "", color: "slate" });
    setDialogOpen(true);
  };

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Los tipos de usuario se asignan a las tareas para indicar qué departamento debe realizarlas.
        </p>
        <Button onClick={openCreate} data-testid="add-user-type-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      <div className="card-base overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-mono text-sm">{type.id}</TableCell>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>
                  <Badge className={getColorClass(type.color)}>{type.color}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(type)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingType(type); setDeleteDialogOpen(true); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Editar Tipo de Usuario" : "Nuevo Tipo de Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>ID (único, sin espacios)</Label>
              <Input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                disabled={!!editingType}
                placeholder="ej: ventas"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej: Ventas"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Color</Label>
              <Select value={formData.color} onValueChange={(v) => setFormData({ ...formData, color: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${c.class.split(" ")[0]}`} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{editingType?.name}". Las tareas existentes con este tipo no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ ROLES TAB ============
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", description: "", permissions: [] });

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.adminGetRoles();
      setRoles(response.data);
    } catch (error) {
      toast.error("Error al cargar roles");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name) {
      toast.error("ID y nombre son obligatorios");
      return;
    }

    try {
      if (editingRole) {
        await api.adminUpdateRole(editingRole.id, formData);
        toast.success("Rol actualizado");
      } else {
        await api.adminCreateRole(formData);
        toast.success("Rol creado");
      }
      setDialogOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDelete = async () => {
    try {
      await api.adminDeleteRole(editingRole.id);
      toast.success("Rol eliminado");
      setDeleteDialogOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    }
  };

  const isSystemRole = (roleId) => ["admin", "project_manager", "collaborator"].includes(roleId);

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Los roles determinan los permisos de cada usuario en el sistema.
        </p>
        <Button onClick={() => { setEditingRole(null); setFormData({ id: "", name: "", description: "", permissions: [] }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Rol
        </Button>
      </div>

      <div className="card-base overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-mono text-sm">{role.id}</TableCell>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell className="text-slate-500">{role.description}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingRole(role); setFormData({ ...role }); setDialogOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!isSystemRole(role.id) && (
                    <Button variant="ghost" size="icon" onClick={() => { setEditingRole(role); setDeleteDialogOpen(true); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>ID (único)</Label>
              <Input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                disabled={!!editingRole}
                placeholder="ej: supervisor"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej: Supervisor"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe los permisos de este rol..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el rol "{editingRole?.name}". Los usuarios con este rol mantendrán su asignación actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ MODULES TAB ============
function ModulesTab() {
  const [modules, setModules] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTaskDialogOpen, setDeleteTaskDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleForm, setModuleForm] = useState({ name: "", description: "", icon: "Package", color: "slate" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assigned_user_type: "", checklist: [], deliverables: [] });
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newDeliverable, setNewDeliverable] = useState("");

  useEffect(() => {
    fetchModules();
    fetchUserTypes();
  }, []);

  const fetchModules = async () => {
    try {
      const response = await api.adminGetModules();
      setModules(response.data);
    } catch (error) {
      toast.error("Error al cargar módulos");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTypes = async () => {
    try {
      const response = await api.getUserTypes();
      setUserTypes(response.data);
    } catch (error) {
      console.error("Error loading user types");
    }
  };

  const handleSaveModule = async () => {
    if (!moduleForm.name) {
      toast.error("El nombre es obligatorio");
      return;
    }

    try {
      if (editingModule) {
        await api.adminUpdateModule(editingModule.id, moduleForm);
        toast.success("Módulo actualizado");
      } else {
        await api.adminCreateModule(moduleForm);
        toast.success("Módulo creado");
      }
      setModuleDialogOpen(false);
      setEditingModule(null);
      fetchModules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDeleteModule = async () => {
    try {
      await api.adminDeleteModule(editingModule.id);
      toast.success("Módulo eliminado");
      setDeleteDialogOpen(false);
      setEditingModule(null);
      fetchModules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title) {
      toast.error("El título es obligatorio");
      return;
    }

    try {
      if (editingTask) {
        await api.adminUpdateTaskTemplate(selectedModule.id, editingTask.id || editingTask.title, taskForm);
        toast.success("Tarea actualizada");
      } else {
        await api.adminCreateTaskTemplate(selectedModule.id, taskForm);
        toast.success("Tarea creada");
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
      fetchModules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDeleteTask = async () => {
    try {
      await api.adminDeleteTaskTemplate(selectedModule.id, editingTask.id || editingTask.title);
      toast.success("Tarea eliminada");
      setDeleteTaskDialogOpen(false);
      setEditingTask(null);
      fetchModules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    }
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setTaskForm({
        ...taskForm,
        checklist: [...taskForm.checklist, { text: newChecklistItem.trim(), completed: false }]
      });
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (index) => {
    setTaskForm({
      ...taskForm,
      checklist: taskForm.checklist.filter((_, i) => i !== index)
    });
  };

  const addDeliverable = () => {
    if (newDeliverable.trim()) {
      setTaskForm({
        ...taskForm,
        deliverables: [...taskForm.deliverables, { name: newDeliverable.trim() }]
      });
      setNewDeliverable("");
    }
  };

  const removeDeliverable = (index) => {
    setTaskForm({
      ...taskForm,
      deliverables: taskForm.deliverables.filter((_, i) => i !== index)
    });
  };

  const openCreateModule = () => {
    setEditingModule(null);
    setModuleForm({ name: "", description: "", icon: "Package", color: "slate" });
    setModuleDialogOpen(true);
  };

  const openEditModule = (module) => {
    setEditingModule(module);
    setModuleForm({
      name: module.name,
      description: module.description || "",
      icon: module.icon || "Package",
      color: module.color || "slate"
    });
    setModuleDialogOpen(true);
  };

  const openCreateTask = (module) => {
    setSelectedModule(module);
    setEditingTask(null);
    setTaskForm({ title: "", description: "", assigned_user_type: "", checklist: [], deliverables: [] });
    setTaskDialogOpen(true);
  };

  const openEditTask = (module, task) => {
    setSelectedModule(module);
    setEditingTask(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      assigned_user_type: task.assigned_user_type || "",
      checklist: task.checklist || [],
      deliverables: task.deliverables || []
    });
    setTaskDialogOpen(true);
  };

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Los módulos definen los bloques de trabajo y sus tareas predefinidas.
        </p>
        <Button onClick={openCreateModule} data-testid="add-module-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Módulo
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {modules.map((module) => (
          <AccordionItem key={module.id} value={module.id} className="card-base overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50">
              <div className="flex items-center gap-3 w-full pr-4">
                <Badge className={getColorClass(module.color)}>{module.name}</Badge>
                <span className="text-sm text-slate-500">
                  {module.tasks?.length || 0} tareas
                </span>
                <div className="ml-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openEditModule(module)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingModule(module); setDeleteDialogOpen(true); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">Tareas del módulo</span>
                  <Button size="sm" variant="outline" onClick={() => openCreateTask(module)}>
                    <Plus className="w-3 h-3 mr-1" />
                    Nueva Tarea
                  </Button>
                </div>
                {module.tasks?.length > 0 ? (
                  module.tasks.map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {task.assigned_user_type && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {userTypes.find(t => t.id === task.assigned_user_type)?.name || task.assigned_user_type}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            {task.checklist?.length || 0} items
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {task.deliverables?.length || 0} entregables
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditTask(module, task)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedModule(module); setEditingTask(task); setDeleteTaskDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No hay tareas definidas</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? "Editar Módulo" : "Nuevo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={moduleForm.name}
                onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                placeholder="ej: Gestión de Calidad"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                placeholder="Describe el módulo..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Color</Label>
              <Select value={moduleForm.color} onValueChange={(v) => setModuleForm({ ...moduleForm, color: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${c.class.split(" ")[0]}`} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveModule}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarea" : "Nueva Tarea"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Título</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="ej: Diseño de propuesta"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Describe la tarea..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de Usuario Asignado</Label>
              <Select value={taskForm.assigned_user_type || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_user_type: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {userTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checklist */}
            <div>
              <Label>Checklist</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Nuevo item..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
                />
                <Button type="button" variant="outline" onClick={addChecklistItem}>Añadir</Button>
              </div>
              <div className="mt-2 space-y-1">
                {taskForm.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">{item.text}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeChecklistItem(idx)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverables */}
            <div>
              <Label>Entregables</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newDeliverable}
                  onChange={(e) => setNewDeliverable(e.target.value)}
                  placeholder="Nuevo entregable..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDeliverable())}
                />
                <Button type="button" variant="outline" onClick={addDeliverable}>Añadir</Button>
              </div>
              <div className="mt-2 space-y-1">
                {taskForm.deliverables.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">{item.name || item}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeDeliverable(idx)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTask}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar módulo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el módulo "{editingModule?.name}" y todas sus tareas predefinidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModule} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Dialog */}
      <AlertDialog open={deleteTaskDialogOpen} onOpenChange={setDeleteTaskDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la tarea "{editingTask?.title}" del módulo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ MAIN ADMIN PAGE ============
export default function Admin() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.adminGetStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching admin stats");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-page">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-slate-900">
          Administración
        </h1>
        <p className="text-slate-500 mt-1">
          Configura usuarios, roles, tipos de usuario y módulos del sistema
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.users}</p>
            <p className="text-xs text-slate-500">Usuarios</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.projects}</p>
            <p className="text-xs text-slate-500">Proyectos</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.tasks}</p>
            <p className="text-xs text-slate-500">Tareas</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.modules}</p>
            <p className="text-xs text-slate-500">Módulos</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.user_types}</p>
            <p className="text-xs text-slate-500">Tipos Usuario</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.roles}</p>
            <p className="text-xs text-slate-500">Roles</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="user-types" className="gap-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">Tipos</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Módulos</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="roles">
            <RolesTab />
          </TabsContent>
          <TabsContent value="user-types">
            <UserTypesTab />
          </TabsContent>
          <TabsContent value="modules">
            <ModulesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ============ USERS TAB (imported from existing) ============
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", role: "", user_type: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes, typesRes] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
        api.getUserTypes()
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setUserTypes(typesRes.data);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await api.updateUser(selectedUser.id, formData);
      toast.success("Usuario actualizado");
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteUser(selectedUser.id);
      toast.success("Usuario eliminado");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setFormData({ name: user.name, role: user.role, user_type: user.user_type || "" });
    setEditDialogOpen(true);
  };

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Gestiona los usuarios del sistema, sus roles y tipos de usuario.
      </p>

      <div className="card-base overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-500">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {roles.find(r => r.id === user.role)?.name || user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.user_type ? (
                    <Badge className={getColorClass(userTypes.find(t => t.id === user.user_type)?.color || "slate")}>
                      {userTypes.find(t => t.id === user.user_type)?.name || user.user_type}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDeleteDialogOpen(true); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Usuario</Label>
              <Select value={formData.user_type || "none"} onValueChange={(v) => setFormData({ ...formData, user_type: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {userTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el usuario "{selectedUser?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
