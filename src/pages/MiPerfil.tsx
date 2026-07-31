import { useEffect, useState } from "react";
import {
  X, ChevronDown, KeyRound, UserPlus, Pencil, TrendingUp,
  Building2, CreditCard, Users, Loader, Check, Settings, Clock,
} from "lucide-react";
import AgregarHerramienta from "./AgregarHerramienta";

interface MiPerfilProps {
  token: string;
  orgId: number;
  role: string;
}

interface OrgUser {
  id: number;
  username: string;
  role: string;
  full_name: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
}

interface PerfilData {
  org: { id: number; name: string; industry: string | null; created_at: string | null };
  plan: { name: string; base_price: number; included_tools: number; max_users: number | null };
  subscription: { status: string | null; total_monthly: number; next_billing: string | null };
  users: OrgUser[];
  stats: {
    total_ventas: number;
    total_ingresos: number;
    ventas_este_mes: number;
    growth_pct: number | null;
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño", employee: "Empleado", admin: "Admin",
};

export default function MiPerfil({ token, orgId, role }: MiPerfilProps) {
  const [data, setData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Plan dinámico: cuenta y precio total en vivo según herramientas activas
  const [addonCount, setAddonCount] = useState(0);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [showMarketplace, setShowMarketplace] = useState(false);

  // Cadencia de contacto con clientes (alimenta colores en Clientes)
  const [cadenceDays, setCadenceDays] = useState(30);
  const [cadenceSubmitting, setCadenceSubmitting] = useState(false);
  const [cadenceSuccess, setCadenceSuccess] = useState(false);

  // Cambiar mi contraseña
  const [pwForm, setPwForm] = useState({ current: "", nueva: "", confirmar: "" });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Modal agregar usuario
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", password: "", full_name: "", role: "employee" });
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userError, setUserError] = useState("");

  // Modal editar usuario del equipo
  const [editUser, setEditUser] = useState<OrgUser | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", new_password: "", active: true });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const isOwner = role === "owner";

  const fetchPerfil = async () => {
    setLoading(true);
    setError("");
    const url = `https://toolbox-backend-rkit.onrender.com/api/perfil?org_id=${orgId}`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setCadenceDays(d.org?.contact_cadence_days ?? 30);
    } catch {
      // Reintento único: si Render acaba de despertar, la primera llamada
      // a veces se cae aunque el servidor ya esté sirviendo bien.
      try {
        await new Promise((r) => setTimeout(r, 1800));
        const retryRes = await fetch(url, { headers });
        if (!retryRes.ok) throw new Error();
        const d = await retryRes.json();
        setData(d);
        setCadenceDays(d.org?.contact_cadence_days ?? 30);
      } catch {
        setError("No se pudo cargar tu perfil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchGestion = async () => {
    if (role !== "owner") return;
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/org-tools/gestion?org_id=${orgId}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      setAddonCount(d.addon_count ?? 0);
      // Usamos el total proyectado: lo que se pagará una vez que las bajas
      // pendientes se hagan efectivas, no lo que se cobra en el ciclo actual.
      setTotalMonthly(d.total_monthly_proyectado ?? d.total_monthly ?? 0);
    } catch { /* silencioso */ }
  };

  useEffect(() => { fetchPerfil(); fetchGestion(); }, [orgId]);

  const saveCadence = async () => {
    setCadenceSubmitting(true);
    setCadenceSuccess(false);
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/perfil/cadencia", {
        method: "POST", headers,
        body: JSON.stringify({ org_id: orgId, contact_cadence_days: cadenceDays }),
      });
      if (res.ok) setCadenceSuccess(true);
    } catch { /* silencioso */ } finally {
      setCadenceSubmitting(false);
    }
  };

  const cambiarPassword = async () => {
    setPwError("");
    setPwSuccess(false);
    if (!pwForm.current || !pwForm.nueva) { setPwError("Llena todos los campos."); return; }
    if (pwForm.nueva.length < 6) { setPwError("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    if (pwForm.nueva !== pwForm.confirmar) { setPwError("Las contraseñas no coinciden."); return; }
    setPwSubmitting(true);
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/perfil/change-password", {
        method: "POST", headers,
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.nueva }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al cambiar la contraseña");
      }
      setPwSuccess(true);
      setPwForm({ current: "", nueva: "", confirmar: "" });
    } catch (e: any) {
      setPwError(e.message);
    } finally {
      setPwSubmitting(false);
    }
  };

  const crearUsuario = async () => {
    setUserError("");
    if (!userForm.username || !userForm.password) { setUserError("Usuario y contraseña son obligatorios."); return; }
    if (userForm.password.length < 6) { setUserError("La contraseña debe tener al menos 6 caracteres."); return; }
    setUserSubmitting(true);
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/create-user", {
        method: "POST", headers,
        body: JSON.stringify({
          username: userForm.username,
          password: userForm.password,
          full_name: userForm.full_name,
          role: userForm.role,
          org_id: orgId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el usuario");
      }
      setShowUserModal(false);
      setUserForm({ username: "", password: "", full_name: "", role: "employee" });
      fetchPerfil();
    } catch (e: any) {
      setUserError(e.message);
    } finally {
      setUserSubmitting(false);
    }
  };

  const openEditUser = (u: OrgUser) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name ?? "", new_password: "", active: u.active });
    setEditError("");
  };

  const guardarUsuario = async () => {
    if (!editUser) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const body: any = { full_name: editForm.full_name, active: editForm.active };
      if (editForm.new_password) body.new_password = editForm.new_password;

      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/org-users/${editUser.id}`, {
        method: "PATCH", headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setEditUser(null);
      fetchPerfil();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader className="animate-spin text-[var(--brand-red)]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {data && (
        <>
          {/* Banner de stats */}
          {isOwner && data.stats.total_ventas > 0 && (
            <div className="rounded-2xl bg-[#1A2332] p-6 mb-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm text-white/70 mb-1">Desde que usas ToolBox</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(data.stats.total_ingresos)}
                  <span className="text-base font-normal text-white/70 ml-2">
                    en {data.stats.total_ventas} ventas
                  </span>
                </p>
                {data.stats.growth_pct !== null && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                    <TrendingUp size={13} className={data.stats.growth_pct >= 0 ? "text-emerald-400" : "text-red-400"} />
                    <span className="text-sm font-medium">
                      {data.stats.growth_pct >= 0 ? "+" : ""}{data.stats.growth_pct}% este mes vs el anterior
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-[var(--brand-red)]/20" />
            </div>
          )}

          {/* Org + Plan */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Mi organización</h3>
              </div>
              <p className="text-lg font-bold text-foreground">{data.org.name}</p>
              {data.org.industry && <p className="text-sm text-muted-foreground mt-0.5">{data.org.industry}</p>}
              <p className="text-xs text-muted-foreground mt-3">
                Cliente desde {formatDate(data.org.created_at)}
              </p>
            </div>

            {isOwner && (
              <div className="rounded-2xl border border-border bg-background p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={15} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Mi plan</h3>
                  </div>
                  <button
                    onClick={() => setShowMarketplace(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings size={12} />
                    Gestionar herramientas
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-foreground">Plan {data.plan.name}</p>
                  {data.subscription.status && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 capitalize">
                      {data.subscription.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatCurrency(totalMonthly || data.subscription.total_monthly)}/mes
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Próximo cobro: {formatDate(data.subscription.next_billing)}
                </p>
              </div>
            )}
          </div>

          {/* Equipo */}
          {isOwner && (
            <div className="rounded-2xl border border-border bg-background overflow-hidden mb-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Mi equipo ({data.users.length}{data.plan.max_users ? ` de ${data.plan.max_users}` : ""})
                  </h3>
                </div>
                <button onClick={() => { setShowUserModal(true); setUserError(""); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-red)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                  <UserPlus size={13} />
                  Agregar usuario
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Último acceso</th>
                      <th className="px-6 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-foreground">{u.full_name || "—"}</td>
                        <td className="px-6 py-3.5 text-sm font-mono text-muted-foreground">{u.username}</td>
                        <td className="px-6 py-3.5 text-sm text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                          }`}>
                            {u.active ? "Activo" : "Desactivado"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-muted-foreground">{formatDate(u.last_login)}</td>
                        <td className="px-6 py-3.5">
                          <button onClick={() => openEditUser(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cadencia de contacto con clientes */}
          {isOwner && (
            <div className="rounded-2xl border border-border bg-background p-6 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Seguimiento de clientes</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Cada cuántos días quieres volver a contactar a un cliente. Esto define los colores y la alerta en Clientes.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={cadenceDays}
                  onChange={(e) => setCadenceDays(parseInt(e.target.value) || 1)}
                  className="w-24 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
                />
                <span className="text-sm text-muted-foreground">días</span>
                <button onClick={saveCadence} disabled={cadenceSubmitting}
                  className="ml-auto px-4 py-2 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  {cadenceSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
              {cadenceSuccess && (
                <p className="text-xs text-emerald-600 mt-2 inline-flex items-center gap-1">
                  <Check size={12} /> Guardado
                </p>
              )}
            </div>
          )}

          {/* Cambiar mi contraseña */}
          <div className="rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound size={15} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Cambiar mi contraseña</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contraseña actual</label>
                <input type="password" value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nueva contraseña</label>
                <input type="password" value={pwForm.nueva}
                  onChange={(e) => setPwForm((f) => ({ ...f, nueva: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirmar nueva</label>
                <input type="password" value={pwForm.confirmar}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirmar: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>
            </div>

            {pwError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-4">{pwError}</div>}
            {pwSuccess && (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-4 inline-flex items-center gap-2">
                <Check size={14} /> Contraseña actualizada correctamente.
              </div>
            )}

            <button onClick={cambiarPassword} disabled={pwSubmitting}
              className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {pwSubmitting ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </div>
        </>
      )}

      {/* Modal agregar usuario */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Agregar usuario</h3>
              <button onClick={() => setShowUserModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre completo</label>
                <input type="text" placeholder="Pedro Ramírez" value={userForm.full_name}
                  onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Usuario *</label>
                  <input type="text" placeholder="pedro_tienda" value={userForm.username}
                    onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Contraseña *</label>
                  <input type="password" placeholder="Mínimo 6 caracteres" value={userForm.password}
                    onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Rol</label>
                <div className="relative">
                  <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                    <option value="employee">Empleado</option>
                    <option value="owner">Dueño</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Los empleados solo ven Dashboard, Ventas, Productos, Inventario y Pedidos.
                </p>
              </div>

              {userError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{userError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={crearUsuario} disabled={userSubmitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {userSubmitting ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Editar a {editUser.username}</h3>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre completo</label>
                <input type="text" value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nueva contraseña (opcional)</label>
                <input type="password" placeholder="Dejar vacío para no cambiar" value={editForm.new_password}
                  onChange={(e) => setEditForm((f) => ({ ...f, new_password: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={editForm.active}
                  onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-[var(--brand-red)]" />
                <span className="text-sm text-foreground">Usuario activo (puede iniciar sesión)</span>
              </label>

              {editError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{editError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={guardarUsuario} disabled={editSubmitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {editSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marketplace de herramientas */}
      {showMarketplace && (
        <AgregarHerramienta
          token={token}
          orgId={orgId}
          onClose={() => setShowMarketplace(false)}
          onActivated={() => { fetchPerfil(); fetchGestion(); }}
        />
      )}
    </div>
  );
}
