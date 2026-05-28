import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader, Plus, Trash2, KeyRound, X, Building2, User } from "lucide-react";

const API = "https://toolbox-backend-rkit.onrender.com";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modales
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);

  // Forms
  const [orgForm, setOrgForm] = useState({ name: "", plan: "basic" });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "owner", org_id: "" });
  const [newPassword, setNewPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");
    setUser({ email, role });
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, usersRes] = await Promise.all([
        fetch(`${API}/api/dashboard-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!dashRes.ok) { localStorage.clear(); navigate("/login"); return; }

      const dashData = await dashRes.json();
      setData(dashData);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
      }
    } catch (err) {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch(`${API}/api/create-org`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(orgForm),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error); return; }
      setFormSuccess("Organización creada");
      setShowCreateOrg(false);
      setOrgForm({ name: "", plan: "basic" });
      fetchData();
    } catch { setFormError("Error de conexión"); }
    finally { setFormLoading(false); }
  };

  const handleCreateUser = async () => {
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch(`${API}/api/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...userForm, org_id: parseInt(userForm.org_id) }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error); return; }
      setFormSuccess("Usuario creado");
      setShowCreateUser(false);
      setUserForm({ name: "", email: "", password: "", role: "owner", org_id: "" });
      fetchData();
    } catch { setFormError("Error de conexión"); }
    finally { setFormLoading(false); }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await fetch(`${API}/api/delete-user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowDeleteConfirm(null);
      fetchData();
    } catch { setError("Error al eliminar usuario"); }
  };

  const handleResetPassword = async () => {
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch(`${API}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: showResetPassword.id, new_password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error); return; }
      setFormSuccess("Contraseña actualizada");
      setShowResetPassword(null);
      setNewPassword("");
    } catch { setFormError("Error de conexión"); }
    finally { setFormLoading(false); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader className="animate-spin text-[var(--brand-red)]" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src="/Logo Transparente.png" alt="ToolBox Logo" style={{ height: "auto", width: "150px" }} />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Panel de Administración</h1>
          <p className="mt-2 text-muted-foreground">Gestiona organizaciones y usuarios de ToolBox</p>
        </div>

        {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}
        {formSuccess && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 mb-6">{formSuccess}</div>}

        {/* Stats */}
        {data && (
          <div className="grid gap-6 md:grid-cols-3 mb-12">
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">Total de Organizaciones</p>
              <p className="text-4xl font-bold text-foreground">{data.total_organizations}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">Total de Usuarios</p>
              <p className="text-4xl font-bold text-foreground">{data.total_users}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">Tu Rol</p>
              <p className="text-2xl font-bold text-[var(--brand-red)]">{user?.role?.toUpperCase()}</p>
            </div>
          </div>
        )}

        {/* Organizaciones */}
        <div className="rounded-2xl border border-border bg-background overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Organizaciones</h2>
            <button
              onClick={() => { setShowCreateOrg(true); setFormError(""); setFormSuccess(""); }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-red)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> Nueva organización
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Plan</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Usuarios</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Creada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.organizations?.map((org: any) => (
                  <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{org.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{org.plan}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{org.users_count}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usuarios */}
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Usuarios</h2>
            <button
              onClick={() => { setShowCreateUser(true); setFormError(""); setFormSuccess(""); }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-red)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> Nuevo usuario
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Rol</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Organización</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{u.name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{u.role}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{u.org_name || "—"}</td>
                    <td className="px-6 py-4 text-sm flex items-center gap-2">
                      <button
                        onClick={() => { setShowResetPassword(u); setFormError(""); setNewPassword(""); }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <KeyRound size={14} /> Reset
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: Crear Organización */}
      {showCreateOrg && (
        <Modal title="Nueva Organización" icon={<Building2 size={20} />} onClose={() => setShowCreateOrg(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
              <input type="text" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="Ej: Al Agua Patos" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Plan</label>
              <select value={orgForm.plan} onChange={(e) => setOrgForm({ ...orgForm, plan: e.target.value })} className="input-field">
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {formError && <p className="text-sm text-[var(--brand-red)]">{formError}</p>}
            <button onClick={handleCreateOrg} disabled={formLoading} className="btn-primary w-full justify-center">
              {formLoading ? "Creando..." : "Crear organización"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: Crear Usuario */}
      {showCreateUser && (
        <Modal title="Nuevo Usuario" icon={<User size={20} />} onClose={() => setShowCreateUser(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
              <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="Nombre completo" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="correo@empresa.com" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
              <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Contraseña segura" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rol</label>
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="input-field">
                <option value="owner">Owner (Dueño)</option>
                <option value="employee">Employee (Empleado)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">ID de Organización</label>
              <input type="number" value={userForm.org_id} onChange={(e) => setUserForm({ ...userForm, org_id: e.target.value })}
                placeholder="Ej: 4" className="input-field" />
            </div>
            {formError && <p className="text-sm text-[var(--brand-red)]">{formError}</p>}
            <button onClick={handleCreateUser} disabled={formLoading} className="btn-primary w-full justify-center">
              {formLoading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: Reset Contraseña */}
      {showResetPassword && (
        <Modal title="Reset Contraseña" icon={<KeyRound size={20} />} onClose={() => setShowResetPassword(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Reseteando contraseña de <strong>{showResetPassword.email}</strong></p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña" className="input-field" />
            </div>
            {formError && <p className="text-sm text-[var(--brand-red)]">{formError}</p>}
            <button onClick={handleResetPassword} disabled={formLoading} className="btn-primary w-full justify-center">
              {formLoading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: Confirmar Eliminar */}
      {showDeleteConfirm && (
        <Modal title="Eliminar Usuario" icon={<Trash2 size={20} />} onClose={() => setShowDeleteConfirm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-foreground">¿Estás seguro que quieres eliminar a <strong>{showDeleteConfirm.email}</strong>?</p>
            <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDeleteUser(showDeleteConfirm.id)}
                className="flex-1 rounded-lg bg-[var(--brand-red)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Componente Modal reutilizable
function Modal({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-[var(--brand-red)]">{icon}</span>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}