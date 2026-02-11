import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { User, Mail, Shield, Loader2 } from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrador",
  project_manager: "Project Manager",
  collaborator: "Colaborador",
};

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto" data-testid="profile-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-slate-900">
          Mi Perfil
        </h1>
        <p className="text-slate-500 mt-1">
          Información de tu cuenta
        </p>
      </div>

      {/* Profile Card */}
      <div className="card-base p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-200">
          <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-white font-heading font-bold text-2xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-heading font-semibold text-xl text-slate-900">
              {user.name}
            </h2>
            <p className="text-slate-500">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <Label className="text-slate-500 text-xs uppercase tracking-wider">
                Nombre
              </Label>
              <p className="font-medium text-slate-900">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <Label className="text-slate-500 text-xs uppercase tracking-wider">
                Email
              </Label>
              <p className="font-medium text-slate-900">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <Label className="text-slate-500 text-xs uppercase tracking-wider">
                Rol
              </Label>
              <p className="font-medium text-slate-900">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
