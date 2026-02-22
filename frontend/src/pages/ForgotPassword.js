import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error("Por favor ingresa tu email");
            return;
        }

        setLoading(true);
        try {
            await api.requestPasswordReset(email);
            setSubmitted(true);
            toast.success("Si el email existe, recibirás instrucciones");
        } catch (error) {
            console.error("Forgot password error:", error);
            toast.error(error.response?.data?.detail || "Error de conexión o servidor. Intenta más tarde.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-slide-up">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
                        <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="font-heading font-bold text-2xl text-slate-900">
                        Recuperar Contraseña
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Ingresa tu email para recibir instrucciones
                    </p>
                </div>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11 bg-slate-50 border-slate-200"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Enviando...
                                </>
                            ) : (
                                "Enviar Instrucciones"
                            )}
                        </Button>
                    </form>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                            Hemos enviado un enlace de recuperación a <strong>{email}</strong>.
                            Por favor revisa tu bandeja de entrada.
                        </div>
                        <p className="text-sm text-slate-500">
                            ¿No recibiste el correo? Revisa tu carpeta de spam o intenta de nuevo.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => setSubmitted(false)}
                            className="w-full"
                        >
                            Intentar con otro email
                        </Button>
                    </div>
                )}

                <div className="mt-8 text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        </div>
    );
}
