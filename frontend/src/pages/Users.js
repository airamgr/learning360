import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Search, Trash2, Edit, Save, X } from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrador",
  project_manager: "Project Manager",
  collaborator: "Colaborador",
};

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700",
  project_manager: "bg-indigo-100 text-indigo-700",
  collaborator: "bg-slate-100 text-slate-700",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (error) {
      toast.error("Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.updateUser(userId, { role: newRole });
      toast.success("Rol actualizado");
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      toast.error("Error al actualizar el rol");
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.deleteUser(userToDelete.id);
      toast.success("Usuario eliminado");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar el usuario");
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" data-testid="users-loading">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-slate-900">
          Gestión de Usuarios
        </h1>
        <p className="text-slate-500 mt-1">
          Administra los usuarios y sus roles en la plataforma
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Buscar usuarios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white border-slate-200"
          data-testid="search-users-input"
        />
      </div>

      {/* Users Table */}
      <div className="card-base overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-heading font-semibold">
                Usuario
              </TableHead>
              <TableHead className="font-heading font-semibold">
                Email
              </TableHead>
              <TableHead className="font-heading font-semibold">Rol</TableHead>
              <TableHead className="font-heading font-semibold text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-medium text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900">
                      {user.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{user.email}</TableCell>
                <TableCell>
                  {editingUser === user.id ? (
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={user.role}
                        onValueChange={(value) =>
                          handleUpdateRole(user.id, value)
                        }
                      >
                        <SelectTrigger
                          className="w-40"
                          data-testid={`role-select-${user.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="project_manager">
                            Project Manager
                          </SelectItem>
                          <SelectItem value="collaborator">
                            Colaborador
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingUser(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge className={ROLE_COLORS[user.role]} variant="secondary">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {user.id !== currentUser?.id && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingUser(user.id)}
                        data-testid={`edit-user-${user.id}`}
                      >
                        <Edit className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                  {user.id === currentUser?.id && (
                    <span className="text-xs text-slate-400">Tú</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500">No se encontraron usuarios</p>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              usuario "{userToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-user-btn"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
