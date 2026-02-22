import { useState, useEffect, useCallback, memo } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Loader2, Palette, Code, Megaphone, Users, BookOpen, Calculator, GraduationCap, Package } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const MODULES = [
    { id: "design", name: "Diseño Gráfico", icon: Palette, color: "bg-pink-100 text-pink-600" },
    { id: "tech", name: "Tecnología", icon: Code, color: "bg-blue-100 text-blue-600" },
    { id: "marketing", name: "Marketing Digital", icon: Megaphone, color: "bg-purple-100 text-purple-600" },
    { id: "sales", name: "Ventas y Negocio", icon: Users, color: "bg-emerald-100 text-emerald-600" },
    { id: "content", name: "Creación de Contenido", icon: BookOpen, color: "bg-amber-100 text-amber-600" },
    { id: "admin", name: "Administración", icon: Calculator, color: "bg-slate-100 text-slate-600" },
    { id: "academic", name: "Académico", icon: GraduationCap, color: "bg-cyan-100 text-cyan-600" },
];

const DEFAULT_MODULE_COSTS = {
    design: 1000.0,
    tech: 2000.0,
    marketing: 1500.0,
    sales: 1200.0,
    content: 800.0,
    admin: 500.0,
    academic: 1000.0,
};

// Memoized individual module item to prevent bulk re-renders and ref loops
const ModuleItem = memo(({ module, isSelected, isCostDisabled, onToggle, onCostChange, costValue }) => {
    const Icon = module.icon;
    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${isSelected
                ? "bg-slate-50 border-indigo-600 ring-1 ring-indigo-600"
                : "bg-white border-slate-200"
                }`}
        >
            <div className="flex items-center gap-3 flex-1">
                <Checkbox
                    id={`check-${module.id}`}
                    checked={isSelected}
                    onCheckedChange={() => onToggle(module.id)}
                />
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${module.color}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <Label
                    htmlFor={`check-${module.id}`}
                    className="text-sm font-medium text-slate-900 cursor-pointer flex-1 py-1"
                >
                    {module.name}
                </Label>
            </div>

            {isSelected && (
                <div className={`flex items-center gap-2 mt-2 sm:mt-0 pl-11 sm:pl-0 ${isCostDisabled ? "opacity-50" : ""}`}>
                    <Label htmlFor={`cost-${module.id}`} className="text-xs text-slate-500 whitespace-nowrap">Presupuesto:</Label>
                    <Input
                        id={`cost-${module.id}`}
                        type="number"
                        className="w-32 h-8"
                        value={costValue || 0}
                        onChange={(e) => onCostChange(module.id, e.target.value)}
                        disabled={isCostDisabled}
                    />
                    <span className="text-sm text-slate-500">€</span>
                </div>
            )}
        </div>
    );
});

// Recalculate total logic outside to keep references stable
const calculateTotal = (modules, costs, mode, currentTotal) => {
    if (mode === "module") {
        return modules.reduce((sum, moduleId) => {
            return sum + (Number(costs[moduleId]) || 0);
        }, 0);
    }
    return currentTotal;
};

export function EditProjectDialog({ project, open, onOpenChange, onProjectUpdated }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        client_name: "",
        description: "",
        total_project_cost: 0,
        enrollment_payment: "",
        start_date: "",
        end_date: "",
        modules: [],
        module_costs: {},
        billing_mode: "module", // module | project
    });

    useEffect(() => {
        if (project && open) {
            // CLONE to avoid mutating props
            const initialModuleCosts = { ...(project.module_costs || {}) };

            project.modules?.forEach(m => {
                if (!(m in initialModuleCosts)) {
                    initialModuleCosts[m] = DEFAULT_MODULE_COSTS[m] || 0;
                }
            });

            setFormData({
                name: project.name || "",
                client_name: project.client_name || "",
                description: project.description || "",
                total_project_cost: project.total_project_cost || 0,
                enrollment_payment: project.enrollment_payment || 0,
                start_date: project.start_date || "",
                end_date: project.end_date || "",
                modules: project.modules || [],
                module_costs: initialModuleCosts,
                billing_mode: project.billing_mode || "module",
            });
        }
    }, [project, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name: formData.name,
                client_name: formData.client_name,
                description: formData.description,
                total_project_cost: Number(formData.total_project_cost),
                enrollment_payment: Number(formData.enrollment_payment) || 0,
                start_date: formData.start_date,
                end_date: formData.end_date,
                modules: formData.modules,
                module_costs: formData.module_costs,
                billing_mode: formData.billing_mode,
            };

            await api.updateProject(project.id, payload);
            toast.success("Proyecto actualizado correctamente");
            onProjectUpdated();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating project:", error);
            toast.error(error.response?.data?.detail || "Error al actualizar el proyecto");
        } finally {
            setLoading(false);
        }
    };

    const toggleModule = useCallback((moduleId) => {
        setFormData((prev) => {
            const isSelected = prev.modules.includes(moduleId);
            let newModules = [];
            let newCosts = { ...prev.module_costs };

            if (isSelected) {
                newModules = prev.modules.filter((id) => id !== moduleId);
            } else {
                newModules = [...prev.modules, moduleId];
                if (!(moduleId in newCosts)) {
                    newCosts[moduleId] = DEFAULT_MODULE_COSTS[moduleId] || 0;
                }
            }

            return {
                ...prev,
                modules: newModules,
                module_costs: newCosts,
                total_project_cost: calculateTotal(newModules, newCosts, prev.billing_mode, prev.total_project_cost)
            };
        });
    }, []);

    const handleModuleCostChange = useCallback((moduleId, value) => {
        const numericValue = parseFloat(value) || 0;
        setFormData(prev => {
            const newCosts = {
                ...prev.module_costs,
                [moduleId]: numericValue
            };
            return {
                ...prev,
                module_costs: newCosts,
                total_project_cost: calculateTotal(prev.modules, newCosts, prev.billing_mode, prev.total_project_cost)
            };
        });
    }, []);

    const handleBillingModeChange = useCallback((mode) => {
        setFormData(prev => ({
            ...prev,
            billing_mode: mode,
            total_project_cost: calculateTotal(prev.modules, prev.module_costs, mode, prev.total_project_cost)
        }));
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Editar Proyecto</DialogTitle>
                    <DialogDescription>
                        Modifica los detalles y el presupuesto del proyecto.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre del Proyecto</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, name: val }));
                                }}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client_name">Cliente</Label>
                            <Input
                                id="client_name"
                                value={formData.client_name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, client_name: val }));
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, description: val }));
                            }}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <Label className="text-base font-semibold">Modo de Facturación</Label>
                        <RadioGroup
                            value={formData.billing_mode}
                            onValueChange={handleBillingModeChange}
                            className="flex flex-col sm:flex-row gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="module" id="mode-module" />
                                <Label htmlFor="mode-module" className="cursor-pointer">Por Módulo (Suma Automática)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="project" id="mode-project" />
                                <Label htmlFor="mode-project" className="cursor-pointer">Por Proyecto Completo (Fijo)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="total_project_cost">
                                {formData.billing_mode === "module" ? "Coste Total (Calculado)" : "Coste Total (Fijo)"} (€)
                            </Label>
                            <Input
                                id="total_project_cost"
                                type="number"
                                step="0.01"
                                value={formData.total_project_cost}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, total_project_cost: val }));
                                }}
                                readOnly={formData.billing_mode === "module"}
                                className={formData.billing_mode === "module" ? "bg-slate-100 font-bold" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="enrollment_payment">Pago Matrícula (€)</Label>
                            <Input
                                id="enrollment_payment"
                                type="number"
                                step="0.01"
                                value={formData.enrollment_payment}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, enrollment_payment: val }));
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_date">Fecha Inicio</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, start_date: val }));
                                }}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end_date">Fecha Fin</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, end_date: val }));
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Módulos y Presupuestos</Label>
                        <div className="grid grid-cols-1 gap-3">
                            {MODULES.map((module) => (
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    isSelected={formData.modules.includes(module.id)}
                                    isCostDisabled={formData.billing_mode === "project"}
                                    onToggle={toggleModule}
                                    onCostChange={handleModuleCostChange}
                                    costValue={formData.module_costs[module.id]}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar Cambios"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
