import { useEffect, useState } from "react";
import { Plus, X, Search, MessageCircle, Mail, Instagram, Pencil, Trash2, Users, Send } from "lucide-react";

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
  total_spent: number;
  visit_count: number;
  last_visit: string | null;
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function cleanPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

export default function Clientes({ token, orgId }: ClientesProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Modal crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", instagram: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Modal contacto
  const [contactClient, setContactClient] = useState<Cliente | null>(null);
  const [template, setTemplate] = useState(TEMPLATES[0].id);

  // Confirmación de borrado
  const [deleting, setDeleting] = useState<Cliente | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const orgName = localStorage.getItem("org_name") ?? "nuestra tienda";

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

  useEffect(() => { fetchClientes(); }, [orgId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: "", email: "", phone: "", instagram: "", notes: "" });
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
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? form : { ...form, org_id: orgId }),
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

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.instagram ?? "").toLowerCase().includes(q);
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
      <div className="relative mb-6">
        <Search size={15} className="absolute left-4 top-3.5 text-muted-foreground" />
        <input type="text" placeholder="Buscar por nombre, correo, teléfono o Instagram..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
      </div>

      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {/* Tabla */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Instagram</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas</th>
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
                      {search ? "Sin clientes que coincidan." : "Aún no tienes clientes registrados. Agrega el primero."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{c.instagram ? `@${c.instagram.replace("@", "")}` : "—"}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-48 truncate">{c.notes || "—"}</td>
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
                ))
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

            <div className="p-6 space-y-4">
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
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.phone ? "text-foreground hover:border-emerald-400 hover:bg-emerald-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <MessageCircle size={18} className="text-emerald-500" />
                  WhatsApp
                </a>
                <a
                  href={contactClient.email ? `mailto:${contactClient.email}?subject=${encodeURIComponent("Un saludo de " + orgName)}&body=${encodeURIComponent(message)}` : undefined}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.email ? "text-foreground hover:border-blue-400 hover:bg-blue-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <Mail size={18} className="text-blue-500" />
                  Correo
                </a>
                <a
                  href={contactClient.instagram ? `https://instagram.com/${contactClient.instagram.replace("@", "")}` : undefined}
                  target="_blank" rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium transition-colors ${
                    contactClient.instagram ? "text-foreground hover:border-pink-400 hover:bg-pink-50" : "opacity-40 pointer-events-none"
                  }`}>
                  <Instagram size={18} className="text-pink-500" />
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
