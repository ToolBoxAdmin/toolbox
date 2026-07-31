import { useEffect, useState, useRef } from "react";
import {
  X, ChevronDown, KeyRound, UserPlus, Pencil, TrendingUp,
  Building2, CreditCard, Users, Loader, Check, Settings, Clock,
  Mail, Phone, MapPin, ImageIcon, Upload, Gift, Copy, Power,
  Activity, GraduationCap, FileText, ExternalLink,
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
  org: {
    id: number; name: string; industry: string | null; created_at: string | null;
    logo_url: string | null; contact_email: string | null; contact_phone: string | null;
    street1: string | null; street2: string | null; city: string | null; state: string | null;
    postal_code: string | null; country: string | null; contact_cadence_days: number;
    toolbox_charge_enabled: boolean; inactivity_timeout_minutes: number;
  };
  plan: { name: string; base_price: number; included_tools: number; max_users: number | null };
  subscription: { status: string | null; total_monthly: number; next_billing: string | null };
  users: OrgUser[];
  stats: {
    total_ventas: number;
    total_ingresos: number;
    ventas_este_mes: number;
    growth_pct: number | null;
    best_day_date: string | null;
    best_day_total: number;
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDayLong(str: string | null) {
  if (!str) return "";
  return new Date(str + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño", employee: "Empleado", admin: "Admin",
};

const TIMEOUT_OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
];

// Comprime el logo antes de subirlo, igual que hacemos con las fotos de producto
async function compressImage(file: File, maxMB = 2): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxDim = 500;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      let quality = 0.9;
      let base64 = canvas.toDataURL("image/jpeg", quality);
      while (base64.length > maxMB * 1024 * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1;
        base64 = canvas.toDataURL("image/jpeg", quality);
      }
      URL.revokeObjectURL(url);
      resolve({ base64: base64.split(",")[1], type: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function MiPerfil({ token, orgId, role }: MiPerfilProps) {
  const [data, setData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Plan dinámico: cuenta y precio total en vivo según herramientas activas
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [showMarketplace, setShowMarketplace] = useState(false);

  // Logo del negocio
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Editar contacto y dirección
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgForm, setOrgForm] = useState({
    contact_email: "", contact_phone: "", street1: "", street2: "",
    city: "", state: "", postal_code: "", country: "México",
  });
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [orgError, setOrgError] = useState("");

  // Cadencia de contacto con clientes (alimenta colores en Clientes)
  const [cadenceDays, setCadenceDays] = useState(30);
  const [cadenceSubmitting, setCadenceSubmitting] = useState(false);
  const [cadenceSuccess, setCadenceSuccess] = useState(false);

  // Timeout de inactividad
  const [timeoutMinutes, setTimeoutMinutes] = useState(0);
  const [timeoutSubmitting, setTimeoutSubmitting] = useState(false);
  const [timeoutSuccess, setTimeoutSuccess] = useState(false);

  // Cobro automático de ToolBox
  const [toolboxEnabled, setToolboxEnabled] = useState(true);
  const [toolboxSubmitting, setToolboxSubmitting] = useState(false);

  // Referir a un amigo
  const [copied, setCopied] = useState(false);

  // Semáforo de salud del negocio
  const [semaforo, setSemaforo] = useState<{ status: string; score: number; max_score: number; factors: { name: string; points: number; reason: string }[] } | null>(null);

  // Aprende más — documentos de la plataforma
  const [documentos, setDocumentos] = useState<{ id: number; title: string; file_url: string; category: string }[]>([]);

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
      applyPerfilData(d);
    } catch {
      // Reintento único: si Render acaba de despertar, la primera llamada
      // a veces se cae aunque el servidor ya esté sirviendo bien.
      try {
        await new Promise((r) => setTimeout(r, 1800));
        const retryRes = await fetch(url, { headers });
        if (!retryRes.ok) throw new Error();
        const d = await retryRes.json();
        applyPerfilData(d);
      } catch {
        setError("No se pudo cargar tu perfil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const applyPerfilData = (d: PerfilData) => {
    setData(d);
    setCadenceDays(d.org?.contact_cadence_days ?? 30);
    setLogoPreview(d.org?.logo_url ?? null);
    setTimeoutMinutes(d.org?.inactivity_timeout_minutes ?? 0);
    setToolboxEnabled(d.org?.toolbox_charge_enabled ?? true);
    setOrgForm({
      contact_email: d.org?.contact_email ?? "",
      contact_phone: d.org?.contact_phone ?? "",
      street1: d.org?.street1 ?? "",
      street2: d.org?.street2 ?? "",
      city: d.org?.city ?? "",
      state: d.org?.state ?? "",
      postal_code: d.org?.postal_code ?? "",
      country: d.org?.country ?? "México",
    });
  };

  const fetchGestion = async () => {
    if (role !== "owner") return;
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/org-tools/gestion?org_id=${orgId}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      // Usamos el total proyectado: lo que se pagará una vez que las bajas
      // pendientes se hagan efectivas, no lo que se cobra en el ciclo actual.
      setTotalMonthly(d.total_monthly_proyectado ?? d.total_monthly ?? 0);
    } catch { /* silencioso */ }
  };

  const fetchSemaforo = async () => {
    if (role !== "owner") return;
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/negocio/semaforo?org_id=${orgId}`, { headers });
      if (res.ok) setSemaforo(await res.json());
    } catch { /* silencioso */ }
  };

  const fetchDocumentos = async () => {
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/documentos", { headers });
      if (res.ok) {
        const d = await res.json();
        setDocumentos(d.documentos ?? []);
      }
    } catch { /* silencioso */ }
  };

  useEffect(() => { fetchPerfil(); fetchGestion(); fetchSemaforo(); fetchDocumentos(); }, [orgId]);

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

  const saveTimeout = async (minutes: number) => {
    setTimeoutMinutes(minutes);
    setTimeoutSubmitting(true);
    setTimeoutSuccess(false);
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/organizacion", {
        method: "PATCH", headers,
        body: JSON.stringify({ org_id: orgId, inactivity_timeout_minutes: minutes }),
      });
      if (res.ok) setTimeoutSuccess(true);
    } catch { /* silencioso */ } finally {
      setTimeoutSubmitting(false);
    }
  };

  const toggleToolboxCharge = async () => {
    const next = !toolboxEnabled;
    setToolboxEnabled(next);
    setToolboxSubmitting(true);
    try {
      await fetch("https://toolbox-backend-rkit.onrender.com/api/organizacion", {
        method: "PATCH", headers,
        body: JSON.stringify({ org_id: orgId, toolbox_charge_enabled: next }),
      });
    } catch {
      setToolboxEnabled(!next);
    } finally {
      setToolboxSubmitting(false);
    }
  };

  const guardarOrganizacion = async () => {
    setOrgSubmitting(true);
    setOrgError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/organizacion", {
        method: "PATCH", headers,
        body: JSON.stringify({ org_id: orgId, ...orgForm }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setShowOrgModal(false);
      fetchPerfil();
    } catch (e: any) {
      setOrgError(e.message);
    } finally {
      setOrgSubmitting(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) { alert("Solo se permiten imágenes."); return; }
    setUploadingLogo(true);
    try {
      const { base64, type } = await compressImage(file);
      setLogoPreview(`data:${type};base64,${base64}`);
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/organizacion/logo", {
        method: "POST", headers,
        body: JSON.stringify({ org_id: orgId, image_data: base64, content_type: type }),
      });
      if (!res.ok) throw new Error();
    } catch {
      alert("No se pudo subir el logo. Intenta de nuevo.");
      setLogoPreview(data?.org?.logo_url ?? null);
    } finally {
      setUploadingLogo(false);
    }
  };

  const copyReferralLink = () => {
    const link = `https://toolbox.mx/?ref=org${orgId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

  const direccionCompleta = data ? [data.org.street1, data.org.street2, data.org.city, data.org.state, data.org.postal_code, data.org.country].filter(Boolean).join(", ") : "";

  return (
    <div className="max-w-4xl mx-auto">
      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {data && (
        <>
          {/* Banner de stats */}
          {isOwner && data.stats.best_day_date && (
            <div className="rounded-2xl bg-[var(--brand-red)] p-6 mb-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm text-white/80 mb-1">Tu mejor día de ventas hasta ahora</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(data.stats.best_day_total)}
                  <span className="text-base font-normal text-white/80 ml-2">
                    el {formatDayLong(data.stats.best_day_date)}
                  </span>
                </p>
                {data.stats.growth_pct !== null && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    <TrendingUp size={13} className={data.stats.growth_pct >= 0 ? "text-emerald-200" : "text-red-100"} />
                    <span className="text-sm font-medium">
                      {data.stats.growth_pct >= 0 ? "+" : ""}{data.stats.growth_pct}% este mes vs el anterior
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
            </div>
          )}

          {/* Semáforo de salud del negocio */}
          {isOwner && semaforo && (
            <div className="rounded-2xl border border-border bg-background p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Estado de tu negocio</h3>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-4 h-4 rounded-full shrink-0 ${
                  semaforo.status === "sano" ? "bg-emerald-500" : semaforo.status === "atencion" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <p className="text-lg font-bold text-foreground">
                  {semaforo.status === "sano" ? "Sano" : semaforo.status === "atencion" ? "Requiere atención" : "Enfermo"}
                </p>
                <span className="text-xs text-muted-foreground ml-auto">{semaforo.score} de {semaforo.max_score} puntos</span>
              </div>
              <div className="space-y-2.5">
                {semaforo.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                      f.points === 2 ? "bg-emerald-500" : f.points === 1 ? "bg-amber-500" : "bg-red-500"
                    }`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Org + Plan */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={!isOwner || uploadingLogo}
                    title={isOwner ? "Cambiar logo" : undefined}
                    className="relative w-11 h-11 rounded-xl bg-muted/60 border border-border flex items-center justify-center overflow-hidden shrink-0 disabled:cursor-default group"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-muted-foreground" />
                    )}
                    {isOwner && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploadingLogo ? <Loader size={13} className="animate-spin text-white" /> : <Upload size={13} className="text-white" />}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Mi organización</h3>
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => { setShowOrgModal(true); setOrgError(""); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Pencil size={13} />
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>

              <p className="text-lg font-bold text-foreground">{data.org.name}</p>
              {data.org.industry && <p className="text-sm text-muted-foreground mt-0.5">{data.org.industry}</p>}

              <div className="mt-3 space-y-1">
                {data.org.contact_email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail size={11} /> {data.org.contact_email}</p>
                )}
                {data.org.contact_phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone size={11} /> {data.org.contact_phone}</p>
                )}
                {direccionCompleta && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0" /> {direccionCompleta}</p>
                )}
              </div>

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

          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {/* Facturación: cobro automático de ToolBox */}
            {isOwner && (
              <div className="rounded-2xl border border-border bg-background p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Power size={15} className="text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Facturación</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Agrega tu costo de ToolBox a tus gastos cada mes, para que tus Finanzas reflejen tu operación real.
                </p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">Incluir ToolBox como gasto automático</span>
                  <button
                    type="button"
                    onClick={toggleToolboxCharge}
                    disabled={toolboxSubmitting}
                    className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${toolboxEnabled ? "bg-[var(--brand-red)]" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${toolboxEnabled ? "translate-x-4" : ""}`} />
                  </button>
                </label>
              </div>
            )}

            {/* Preferencias de sesión */}
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Cierre de sesión automático</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Por seguridad, cierra tu sesión sola después de un rato sin actividad.
              </p>
              <div className="relative">
                <select value={timeoutMinutes} onChange={(e) => saveTimeout(parseInt(e.target.value))}
                  disabled={timeoutSubmitting}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                  {TIMEOUT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
              </div>
              {timeoutSuccess && (
                <p className="text-xs text-emerald-600 mt-2 inline-flex items-center gap-1">
                  <Check size={12} /> Guardado
                </p>
              )}
            </div>
          </div>

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

          {/* Referir a un amigo */}
          {isOwner && (
            <div className="rounded-2xl border border-border bg-background p-6 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Referir a un amigo</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Invita a otro negocio a ToolBox. Cuando se registre con tu link, ambos reciben un mes gratis de una herramienta adicional.
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={`toolbox.mx/?ref=org${orgId}`}
                  className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-muted-foreground bg-muted/40" />
                <button onClick={copyReferralLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shrink-0">
                  <Copy size={14} />
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          {/* Aprende más — documentos de la plataforma */}
          <div className="rounded-2xl border border-border bg-background p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap size={15} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Aprende más</h3>
            </div>
            {documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay documentos disponibles. Aquí verás tu contrato, políticas y otros recursos cuando estén listos.
              </p>
            ) : (
              <div className="space-y-1">
                {documentos.map((doc) => (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.category}</p>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

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

      {/* Modal editar contacto y dirección */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Contacto y ubicación</h3>
              <button onClick={() => setShowOrgModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Correo de contacto</label>
                  <input type="email" placeholder="contacto@negocio.com" value={orgForm.contact_email}
                    onChange={(e) => setOrgForm((f) => ({ ...f, contact_email: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Teléfono</label>
                  <input type="tel" placeholder="55 1234 5678" value={orgForm.contact_phone}
                    onChange={(e) => setOrgForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Dirección del negocio</p>

              <input type="text" placeholder="Calle y número" value={orgForm.street1}
                onChange={(e) => setOrgForm((f) => ({ ...f, street1: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              <input type="text" placeholder="Local, referencias (opcional)" value={orgForm.street2}
                onChange={(e) => setOrgForm((f) => ({ ...f, street2: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />

              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Delegación / Ciudad" value={orgForm.city}
                  onChange={(e) => setOrgForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                <input type="text" placeholder="Estado" value={orgForm.state}
                  onChange={(e) => setOrgForm((f) => ({ ...f, state: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Código postal" value={orgForm.postal_code}
                  onChange={(e) => setOrgForm((f) => ({ ...f, postal_code: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                <input type="text" placeholder="País" value={orgForm.country}
                  onChange={(e) => setOrgForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              {orgError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{orgError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={guardarOrganizacion} disabled={orgSubmitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {orgSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
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
