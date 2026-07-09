import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Truck, ExternalLink, Search } from "lucide-react";

interface PedidosProps {
  token: string;
  orgId: number;
}

interface Pedido {
  id: number;
  sale_id: string | null;
  customer_name: string;
  carrier: string;
  tracking_number: string;
  status: string;
  shipping_cost: number;
  address: string;
  notes: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

const CARRIERS = ["Estafeta", "DHL", "FedEx", "UPS", "Paquetexpress", "99minutos", "Correos de México", "Otro"];

const TRACKING_URLS: Record<string, (n: string) => string> = {
  "DHL": (n) => `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${n}`,
  "FedEx": (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  "UPS": (n) => `https://www.ups.com/track?tracknum=${n}`,
  "Estafeta": () => "https://www.estafeta.com/Herramientas/Rastreo",
  "Paquetexpress": () => "https://www.paquetexpress.com.mx/rastreo",
  "99minutos": () => "https://tracking.99minutos.com",
  "Correos de México": () => "https://www.correosdemexico.gob.mx/SSLServicios/SeguimientoEnvio/Seguimiento.aspx",
};

const STATUSES: { key: string; label: string; color: string }[] = [
  { key: "preparando",  label: "Preparando",  color: "bg-gray-100 text-gray-600" },
  { key: "enviado",     label: "Enviado",     color: "bg-blue-100 text-blue-700" },
  { key: "en_transito", label: "En tránsito", color: "bg-amber-100 text-amber-700" },
  { key: "entregado",   label: "Entregado",   color: "bg-emerald-100 text-emerald-700" },
  { key: "devuelto",    label: "Devuelto",    color: "bg-red-100 text-red-600" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str.length <= 10 ? str + "T12:00:00" : str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Pedidos({ token, orgId }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal nuevo pedido
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", carrier: "Estafeta", tracking_number: "",
    shipping_cost: "", address: "", notes: "", sale_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchPedidos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/pedidos?org_id=${orgId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPedidos(data.pedidos);
    } catch {
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPedidos(); }, [orgId]);

  const crearPedido = async () => {
    if (!form.customer_name) { setSubmitError("El nombre del cliente es obligatorio."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/pedidos/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: orgId,
          customer_name: form.customer_name,
          carrier: form.carrier,
          tracking_number: form.tracking_number,
          shipping_cost: parseFloat(form.shipping_cost) || 0,
          address: form.address,
          notes: form.notes,
          sale_id: form.sale_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el pedido");
      }
      setShowModal(false);
      setForm({ customer_name: "", carrier: "Estafeta", tracking_number: "", shipping_cost: "", address: "", notes: "", sale_id: "" });
      fetchPedidos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cambiarStatus = async (pedido: Pedido, newStatus: string) => {
    setPedidos((prev) => prev.map((p) => p.id === pedido.id ? { ...p, status: newStatus } : p));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/pedidos/${pedido.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPedidos();
    } catch { /* silencioso */ }
  };

  const filtered = pedidos.filter((p) => {
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = p.customer_name.toLowerCase().includes(q) ||
      (p.tracking_number ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts: Record<string, number> = {};
  for (const p of pedidos) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const getStatusInfo = (key: string) =>
    STATUSES.find((s) => s.key === key) ?? { key, label: key, color: "bg-muted text-muted-foreground" };

  const getTrackingUrl = (p: Pedido) => {
    if (!p.carrier) return null;
    const fn = TRACKING_URLS[p.carrier];
    if (!fn) return null;
    return fn(p.tracking_number ?? "");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pedidos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pedidos.length} envíos registrados · {counts["en_transito"] ?? 0} en tránsito
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setSubmitError(""); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Nuevo pedido
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-4 top-3.5 text-muted-foreground" />
          <input type="text" placeholder="Buscar por cliente o número de guía..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
        </div>
        <button onClick={() => setFilterStatus("todos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === "todos" ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
          }`}>
          Todos
        </button>
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s.key ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
            }`}>
            {s.label} {counts[s.key] ? `(${counts[s.key]})` : ""}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {/* Tabla */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Paquetería</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Guía</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Costo envío</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Truck size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {search || filterStatus !== "todos" ? "Sin pedidos que coincidan." : "Aún no registras envíos. Crea el primero."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const st = getStatusInfo(p.status);
                  const isExpanded = expandedId === p.id;
                  const trackUrl = getTrackingUrl(p);

                  return (
                    <>
                      <tr key={p.id}
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="hover:bg-muted/20 transition-colors cursor-pointer">
                        <td className="px-4 py-4 text-muted-foreground">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{p.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{p.carrier || "—"}</td>
                        <td className="px-6 py-4">
                          {p.tracking_number ? (
                            trackUrl ? (
                              <a href={trackUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-sm font-mono text-[var(--brand-red)] hover:underline">
                                {p.tracking_number}
                                <ExternalLink size={11} />
                              </a>
                            ) : (
                              <span className="text-sm font-mono text-muted-foreground">{p.tracking_number}</span>
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {p.shipping_cost ? formatCurrency(p.shipping_cost) : "—"}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={p.status}
                            onChange={(e) => cambiarStatus(p, e.target.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 appearance-none cursor-pointer focus:outline-none ${st.color}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${p.id}-detail`} className="bg-muted/10">
                          <td colSpan={6} className="px-8 py-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Dirección</p>
                                <p className="text-sm text-foreground">{p.address || "Sin dirección registrada"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notas</p>
                                <p className="text-sm text-foreground">{p.notes || "Sin notas"}</p>
                              </div>
                              <div className="flex gap-8">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Creado</p>
                                  <p className="text-sm text-foreground">{formatDate(p.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Enviado</p>
                                  <p className="text-sm text-foreground">{formatDate(p.shipped_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Entregado</p>
                                  <p className="text-sm text-foreground">{formatDate(p.delivered_at)}</p>
                                </div>
                              </div>
                              {p.sale_id && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Venta vinculada</p>
                                  <p className="text-sm font-mono text-foreground">{p.sale_id}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nuevo pedido */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nuevo pedido</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Cliente *</label>
                <input type="text" placeholder="Nombre de quien recibe" value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Paquetería</label>
                  <div className="relative">
                    <select value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      {CARRIERS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Número de guía</label>
                  <input type="text" placeholder="1234567890" value={form.tracking_number}
                    onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Costo del envío</label>
                  <input type="number" placeholder="0.00" value={form.shipping_cost}
                    onChange={(e) => setForm((f) => ({ ...f, shipping_cost: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Venta vinculada (opcional)</label>
                  <input type="text" placeholder="VTA-XXXXXX" value={form.sale_id}
                    onChange={(e) => setForm((f) => ({ ...f, sale_id: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Dirección de entrega</label>
                <textarea placeholder="Calle, número, colonia, CP, ciudad..." value={form.address} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground resize-none" />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Notas</label>
                <textarea placeholder="Comentarios del cliente, instrucciones especiales..." value={form.notes} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground resize-none" />
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={crearPedido} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : "Crear pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
