import { useEffect, useState } from "react";
import { Plus, X, Search, MessageCircle, Mail, AtSign, Pencil, Trash2, Users, Send, Clock } from "lucide-react";

interface ClientesProps {
  token: string;
  orgId: number;
}

interface Cliente {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  instagram: string;
  notes: string;
  gender: string | null;
  age_range: string | null;
  last_contacted_at: string | null;
  last_contacted_channel: string | null;
  sales_count: number;
  sales_total: number;
}

const TEMPLATES = [
  {
    id: "agradecimiento",
    label: "Agradecimiento",
    text: (n: string, org: string) => `¡Hola ${n}! 😊 Queremos agradecerte por tu compra en ${org}. Esperamos que la disfrutes mucho. ¡Cualquier cosa estamos a tus órdenes!`,
  },
  {
    id: "promocion",
    label: "Promoción",
    text: (n: string, org: string) => `¡Hola ${n}! 🎉 En ${org} tenemos promociones especiales esta semana que creemos te van a encantar. ¿Te comparto los detalles?`,
  },
  {
    id: "reactivacion",
    label: "Te extrañamos",
    text: (n: string, org: string) => `¡Hola ${n}! Hace tiempo que no te vemos por ${org} y queríamos saludarte. Tenemos novedades que te pueden gustar. ¡Te esperamos pronto! 💛`,
  },
];

const GENDERS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "Otro", label: "Otro" },
  { value: "NA", label: "Prefiero no decir" },
];

const AGE_RANGES = [
  { value: "<18", label: "Menor a 18" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55-64", label: "55-64" },
  { value: "65+", label: "65+" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function cleanPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

function diasDesde(dateStr: string) {
  const then = new Date(dateStr + "T12:00:00");
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

// Verde si se contactó recientemente, ámbar si se acerca la fecha,
// rojo si ya se pasó de la cadencia definida en Mi Perfil.
function contactoStatus(c: Cliente, cadenceDays: number): "ok" | "soon" | "overdue" | "never" {
  if (!c.last_contacted_at) return "never";
  const dias = diasDesde(c.last_contacted_at);
  if (dias < cadenceDays * 0.7) return "ok";
  if (dias < cadenceDays) return "soon";
  return "overdue";
}

const CONTACT_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  soon: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-600",
  never: "bg-gray-100 text-gray-600",
};

export default function Clientes({ token, orgId }: ClientesProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [orgName, setOrgName] = useState("nuestra tienda");

  // Filtros estilo PowerBI: multi-select por género/edad + toggle de seguimiento
  const [filterGender, setFilterGender] = useState<Set<string>>(new Set());
  const [filterAge, setFilterAge] = useState<Set<string>>(new Set());
  const [onlyNeedsContact, setOnlyNeedsContact] = useState(false);

  // Modal crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", instagram: "", notes: "", gender: "", age_range: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Modal contacto
  const [contactClient, setContactClient] = useState<Cliente | null>(null);
  const [template, setTemplate] = useState(TEMPLATES[0].id);

  // Confirmación de borrado
  const [deleting, setDeleting] = useState<Cliente | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchClientes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/clientes?org_id=${orgId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClientes(data.clientes);
    } catch {
      setError("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    (async () => {
      try {
        const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/perfil?org_id=${orgId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCadenceDays(data.org?.contact_cadence_days ?? 30);
          setOrgName(data.org?.name ?? "nuestra tienda");
        }
      } catch { /* silencioso */ }
    })();
  }, [orgId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: "", email: "", phone: "", instagram: "", notes: "", gender: "", age_range: "" });
    setSubmitError("");
    setShowModal(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setForm({
      full_name: c.full_name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      instagram: c.instagram ?? "",
      notes: c.notes ?? "",
      gender: c.gender ?? "",
      age_range: c.age_range ?? "",
    });
    setSubmitError("");
    setShowModal(true);
  };

  const saveCliente = async () => {
    if (!form.full_name) { setSubmitError("El nombre es obligatorio."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const url = editing
        ? `https://toolbox-backend-rkit.onrender.com/api/clientes/${editing.id}`
        : "https://toolbox-backend-rkit.onrender.com/api/clientes/crear";
      const payload = { ...form, gender: form.gender || null, age_range: form.age_range || null };
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? payload : { ...payload, org_id: orgId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setShowModal(false);
      fetchClientes();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/clientes/${deleting.id}`, {
        method: "DELETE", headers,
      });
      setDeleting(null);
      fetchClientes();
    } catch {
      setDeleting(null);
    }
  };

  // Registra el approach al usar cualquiera de los botones de contacto
  const marcarContactado = async (clienteId: number, channel: string) => {
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/clientes/${clienteId}/contacto`, {
        method: "POST", headers, body: JSON.stringify({ channel }),
      });
      const today = new Date().toISOString().split("T")[0];
      setClientes((prev) => prev.map((c) =>
        c.id === clienteId ? { ...c, last_contacted_at: today, last_contacted_channel: channel } : c
      ));
    } catch { /* silencioso */ }
  };

  const toggleFilter = (set: Set<string>, setFn: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setFn(next);
  };

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.instagram ?? "").toLowerCase().includes(q);
    const matchGender = filterGender.size === 0 || (c.gender && filterGender.has(c.gender));
    const matchAge = filterAge.size === 0 || (c.age_range && filterAge.has(c.age_range));
    const status = contactoStatus(c, cadenceDays);
    const matchContact = !onlyNeedsContact || status === "overdue" || status === "never";
    return matchSearch && matchGender && matchAge && matchContact;
  });

  const selectedTemplate = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];
  const message = contactClient
    ? selectedTemplate.text(contactClient.full_name.split(" ")[0], orgName)
    : "";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{clientes.length} clientes registrados</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-4 top-3.5 text-muted-foreground" />
        <input type="text" placeholder="Buscar por nombre, correo, teléfono o Instagram..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
      </div>

      {/* Filtros estilo PowerBI */}
      <div className="rounded-xl border border-border bg-background p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">Género</span>
          {GENDERS.map((g) => (
            <button key={g.value} onClick={() => toggleFilter(filterGender, setFilterGender, g.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterGender.has(g.value) ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
              }`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">Edad</span>
          {AGE_RANGES.map((a) => (
            <button key={a.value} onClick={() => toggleFilter(filterAge, setFilterAge, a.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterAge.has(a.value) ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
              }`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <button onClick={() => setOnlyNeedsContact((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors mt-3 ${
              onlyNeedsContact ? "bg-amber-500 text-white" : "border border-border text-muted-foreground hover:bg-muted"
            }`}>
            <Clock size={12} />
            Sin contacto reciente
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {/* Tabla */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Género / Edad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Último approach</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Ventas acreditadas</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Users size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {search || filterGender.size || filterAge.size || onlyNeedsContact ? "Sin clientes que coincidan con los filtros." : "Aún no tienes clientes registrados. Agrega el primero."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const status = contactoStatus(c, cadenceDays);
                  const genderLabel = GENDERS.find((g) => g.value === c.gender)?.label;
                  const ageLabel = AGE_RANGES.find((a) => a.value === c.age_range)?.label;

                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                        {(c.email || c.phone) && <p className="text-xs text-muted-foreground">{c.email || c.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {genderLabel || ageLabel ? `${genderLabel ?? "—"} · ${ageLabel ?? "—"}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTACT_COLORS[status]}`}>
                          {c.last_contacted_at ? `Hace ${diasDesde(c.last_contacted_at)} días` : "Sin contacto"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {c.sales_count > 0 ? (
                          <span>{formatCurrency(c.sales_total)} <span className="text-muted-foreground">({c.sales_count})</span></span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setContactClient(c)}
                            title="Enviar mensaje"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors">
                            <Send size={14} />
                          </button>
                          <button onClick={() => openEdit(c)}
                            title="Editar"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleting(c)}
                            title="Eliminar"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre completo *</label>
                <input type="text" placeholder="María González" value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Correo</label>
                  <input type="email" placeholder="maria@correo.com" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Teléfono</label>
                  <input type="tel" placeholder="55 1234 5678" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Instagram</label>
                <input type="text" placeholder="@maria.gonzalez" value={form.instagram}
                  onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Género</label>
                  <div className="relative">
                    <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      <option value="">Sin especificar</option>
                      {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Rango de edad</label>
                  <div className="relative">
                    <select value={form.age_range} onChange={(e) => setForm((f) => ({ ...f, age_range: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      <option value="">Sin especificar</option>
                      {AGE_RANGES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Notas</label>
                <textarea placeholder="Cliente frecuente, prefiere tallas 4-6..." value={form.notes} rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground resize-none" />
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={saveCliente} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contacto */}
      {contactClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Contactar a {contactClient.full_name.split(" ")[0]}</h3>
              <button onClick={() => setContactClient(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <label className="text-sm font-medium text-foreground mb-2 block">Plantilla de mensaje</label>
              <div className="flex gap-2 mb-4">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      template === t.id ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-muted/40 p-4 text-sm text-foreground leading-relaxed mb-5">
                {message}
              </div>

              <p className="text-xs text-muted-foreground mb-3">Enviar por:</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={contactClient.phone ? `https://wa.me/${cleanPhone(contactClient.phone)}?text=${encodeURIComponent(message)}` : undefined}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => contactClient.phone && marcarContactado(contactClient.id, "whatsapp")}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.phone ? "text-foreground hover:border-emerald-400 hover:bg-emerald-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <MessageCircle size={18} className="text-emerald-500" />
                  WhatsApp
                </a>
                <a
                  href={contactClient.email ? `mailto:${contactClient.email}?subject=${encodeURIComponent("Un saludo de " + orgName)}&body=${encodeURIComponent(message)}` : undefined}
                  onClick={() => contactClient.email && marcarContactado(contactClient.id, "correo")}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.email ? "text-foreground hover:border-blue-400 hover:bg-blue-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <Mail size={18} className="text-blue-500" />
                  Correo
                </a>
                <a
                  href={contactClient.instagram ? `https://instagram.com/${contactClient.instagram.replace("@", "")}` : undefined}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => contactClient.instagram && marcarContactado(contactClient.id, "instagram")}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.instagram ? "text-foreground hover:border-pink-400 hover:bg-pink-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <AtSign size={18} className="text-pink-500" />
                  Instagram
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground mt-4 text-center">
                El mensaje va pre-escrito — solo revisa y envía. En Instagram se abre el perfil para enviarlo por DM.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-semibold text-foreground mb-2">¿Eliminar a {deleting.full_name}?</h3>
            <p className="text-sm text-muted-foreground mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
