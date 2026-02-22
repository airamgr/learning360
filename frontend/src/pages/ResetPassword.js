import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            toast.error("Token no válido");
            return;
        }

        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        setLoading(true);
        try {
            await api.resetPassword(token, password);
            setSuccess(true);
            toast.success("Contraseña actualizada correctamente");
        } catch (error) {
            toast.error(
                error.response?.data?.detail || "Error al restablecer la contraseña"
            );
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace inválido</h1>
                    <p className="text-slate-500 mb-4">El enlace de recuperación no es válido o ha expirado.</p>
                    <Link to="/login">
                        <Button>Ir al Login</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-slide-up">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
                        <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="font-heading font-bold text-2xl text-slate-900">
                        Nueva Contraseña
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Introduce tu nueva contraseña
                    </p>
                </div>

                {!success ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700">
                                    Nueva Contraseña
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-slate-700">
                                    Confirmar Contraseña
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="h-11 bg-slate-50 border-slate-200"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Actualizando...
                                </>
                            ) : (
                                "Cambiar Contraseña"
                            )}
                        </Button>
                    </form>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">¡Contraseña Actualizada!</h3>
                            <p className="text-slate-500">
                                Ya puedes iniciar sesión con tu nueva contraseña.
                            </p>
                        </div>
                        <Link to="/login" className="block">
                            <Button className="w-full">
                                Ir al Inicio de Sesión
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
