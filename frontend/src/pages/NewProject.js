import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  Palette,
  Code,
  Megaphone,
  Users,
  BookOpen,
  Calculator,
  GraduationCap,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MODULE_CONFIG = [
  {
    id: "design",
    name: "Diseño de Marca e Identidad Visual",
    description: "Logotipos, identidad visual, señalética",
    icon: Palette,
    color: "bg-pink-100 text-pink-600 border-pink-200",
  },
  {
    id: "tech",
    name: "Tecnología y Desarrollo",
    description: "Portales web, LMS, sistemas de pago",
    icon: Code,
    color: "bg-blue-100 text-blue-600 border-blue-200",
  },
  {
    id: "marketing",
    name: "Comunicación y Marketing",
    description: "Campañas, SEO, paid media",
    icon: Megaphone,
    color: "bg-purple-100 text-purple-600 border-purple-200",
  },
  {
    id: "sales",
    name: "Atención Comercial",
    description: "Argumentarios, training, autogeneración",
    icon: Users,
    color: "bg-emerald-100 text-emerald-600 border-emerald-200",
  },
  {
    id: "content",
    name: "Factoría de Contenidos y Cursos",
    description: "Diseño instruccional, LMS, videoclases",
    icon: BookOpen,
    color: "bg-amber-100 text-amber-600 border-amber-200",
  },
  {
    id: "admin",
    name: "Gestión Administrativa y Financiera",
    description: "Pagos, facturación, comisiones",
    icon: Calculator,
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
  {
    id: "academic",
    name: "Gestión Académica",
    description: "Calendarios, coordinación, dinamización",
    icon: GraduationCap,
    color: "bg-cyan-100 text-cyan-600 border-cyan-200",
  },
];

export default function NewProject() {
  const [formData, setFormData] = useState({
    name: "",
    client_name: "",
    description: "",
    cost_per_module: "",
    total_project_cost: "",
    enrollment_payment: "",
    start_date: null,
    end_date: null,
    modules: [],
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleModuleToggle = (moduleId) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.includes(moduleId)
        ? prev.modules.filter((id) => id !== moduleId)
        : [...prev.modules, moduleId],
    }));
  };

  const handleSelectAllModules = () => {
    if (formData.modules.length === MODULE_CONFIG.length) {
      setFormData((prev) => ({ ...prev, modules: [] }));
    } else {
      setFormData((prev) => ({
        ...prev,
        modules: MODULE_CONFIG.map((m) => m.id),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.client_name) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      toast.error("Por favor selecciona las fechas del proyecto");
      return;
    }

    if (formData.modules.length === 0) {
      toast.error("Por favor selecciona al menos un módulo");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        start_date: format(formData.start_date, "yyyy-MM-dd"),
        end_date: format(formData.end_date, "yyyy-MM-dd"),
        cost_per_module: Number(formData.cost_per_module) || 0,
        total_project_cost: Number(formData.total_project_cost) || 0,
        enrollment_payment: Number(formData.enrollment_payment) || 0,
      };

      const response = await api.createProject(payload);
      toast.success(
        `Proyecto creado con ${response.data.tasks_created} tareas generadas`
      );
      navigate(`/projects/${response.data.project.id}`);
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al crear el proyecto"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto" data-testid="new-project-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/projects")}
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading font-bold text-2xl text-slate-900">
            Nuevo Proyecto
          </h1>
          <p className="text-slate-500 mt-1">
            Configura los detalles y módulos del proyecto
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="card-base p-6">
          <h2 className="font-heading font-semibold text-lg text-slate-900 mb-4">
            Información Básica
          </h2>
          <div className="grid gap-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">
                  Nombre del Proyecto *
                </Label>
                <Input
                  id="name"
                  placeholder="Ej: Máster en Marketing Digital"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="bg-slate-50 border-slate-200"
                  data-testid="project-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client" className="text-slate-700">
                  Cliente *
                </Label>
                <Input
                  id="client"
                  placeholder="Ej: Universidad de Valladolid"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  className="bg-slate-50 border-slate-200"
                  data-testid="client-name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-700">
                Descripción
              </Label>
              <Textarea
                id="description"
                placeholder="Breve descripción del proyecto..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="bg-slate-50 border-slate-200 min-h-[100px]"
                data-testid="project-description-input"
              />
            </div>

            {/* Financial Info */}
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cost_per_module" className="text-slate-700">
                  Coste por Módulo
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">€</span>
                  <Input
                    id="cost_per_module"
                    type="number"
                    placeholder="0.00"
                    value={formData.cost_per_module}
                    onChange={(e) =>
                      setFormData({ ...formData, cost_per_module: parseFloat(e.target.value) || 0 })
                    }
                    className="pl-7 bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_project_cost" className="text-slate-700">
                  Coste Total del Proyecto
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">€</span>
                  <Input
                    id="total_project_cost"
                    type="number"
                    placeholder="0.00"
                    value={formData.total_project_cost}
                    onChange={(e) =>
                      setFormData({ ...formData, total_project_cost: parseFloat(e.target.value) || 0 })
                    }
                    className="pl-7 bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment_payment" className="text-slate-700">
                  Pago por Matrícula
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">€</span>
                  <Input
                    id="enrollment_payment"
                    type="number"
                    placeholder="0.00"
                    value={formData.enrollment_payment}
                    onChange={(e) =>
                      setFormData({ ...formData, enrollment_payment: parseFloat(e.target.value) || 0 })
                    }
                    className="pl-7 bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700">Fecha de Inicio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-slate-50 border-slate-200"
                      data-testid="start-date-btn"
                    >
                      <CalendarIcon className="w-4 h-4 mr-2 text-slate-500" />
                      {formData.start_date ? (
                        format(formData.start_date, "PPP", { locale: es })
                      ) : (
                        <span className="text-slate-500">
                          Selecciona fecha
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(date) =>
                        setFormData({ ...formData, start_date: date })
                      }
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Fecha de Fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-slate-50 border-slate-200"
                      data-testid="end-date-btn"
                    >
                      <CalendarIcon className="w-4 h-4 mr-2 text-slate-500" />
                      {formData.end_date ? (
                        format(formData.end_date, "PPP", { locale: es })
                      ) : (
                        <span className="text-slate-500">
                          Selecciona fecha
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.end_date}
                      onSelect={(date) =>
                        setFormData({ ...formData, end_date: date })
                      }
                      locale={es}
                      disabled={(date) =>
                        formData.start_date && date < formData.start_date
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Module Selection */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-semibold text-lg text-slate-900">
                Módulos Contratados
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Selecciona los módulos que incluirá el proyecto
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllModules}
              data-testid="select-all-modules-btn"
            >
              {formData.modules.length === MODULE_CONFIG.length
                ? "Deseleccionar todos"
                : "Seleccionar todos"}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {MODULE_CONFIG.map((module) => {
              const Icon = module.icon;
              const isSelected = formData.modules.includes(module.id);

              return (
                <div
                  key={module.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                  onClick={() => handleModuleToggle(module.id)}
                  data-testid={`module-${module.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${module.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-slate-900 text-sm">
                          {module.name}
                        </h3>
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? "bg-indigo-500 border-indigo-500" 
                              : "border-slate-300 bg-white"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {module.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {formData.modules.length > 0 && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
              <p className="text-sm text-indigo-700">
                <span className="font-medium">
                  {formData.modules.length} módulos seleccionados
                </span>{" "}
                — Se generarán automáticamente las tareas, checklists y
                entregables correspondientes.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/projects")}
            data-testid="cancel-btn"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 min-w-[150px]"
            data-testid="create-project-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creando...
              </>
            ) : (
              "Crear Proyecto"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
