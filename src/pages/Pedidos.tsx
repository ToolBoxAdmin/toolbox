import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Truck, ExternalLink, Search, AlertTriangle, Link2 } from "lucide-react";

interface PedidosProps {
  token: string;
  orgId: number;
}

interface Pedido {
  id: number;
  sale_id: string | null;
  customer_id: number | null;
  customer_name: string;
  carrier: string;
  tracking_number: string;
  status: string;
  shipping_cost: number;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  return_reason: string | null;
  origin_reason: string | null;
  notes: string;
  shipped_at: string | null;
  delivered_at: string | null;
  status_changed_at: string | null;
  created_at: string;
}

interface Cliente {
  id: number;
  full_name: string;
}

interface VentaLite {
  id: string;
  sale_date: string;
  total_amount: number;
  order?: { order_id: number; status: string } | null;
}

const CARRIERS = ["Estafeta", "DHL", "FedEx", "UPS", "Paquetexpress", "99minutos", "Correos de México", "Otro"];

const ORIGIN_REASONS = ["Reposición", "Muestra", "Regalo", "Compra directa (no facturada)", "Otro"];

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

// Mismos umbrales que la generación de notificaciones en el backend —
// para que el badge visual y la alerta digan siempre lo mismo.
const UMBRAL_ATORO: Record<string, number> = { preparando: 3, enviado: 2, en_transito: 5 };

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str.length <= 10 ? str + "T12:00:00" : str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function diasEnStatus(p: Pedido): number | null {
  if (!p.status_changed_at) return null;
  const changed = new Date(p.status_changed_at.slice(0, 10) + "T12:00:00");
  return Math.floor((Date.now() - changed.getTime()) / 86400000);
}

function direccionCompleta(p: Pedido) {
  const parts = [p.street1, p.street2, p.city, p.state, p.postal_code, p.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function Pedidos({ token, orgId }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCarrier, setFilterCarrier] = useState("todas");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal nuevo pedido
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customer_id: "" as string | number, customer_name: "", carrier: "Estafeta", tracking_number: "",
    shipping_cost: "", street1: "", street2: "", city: "", state: "", postal_code: "", country: "México",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Vincular a una venta existente (opcional)
  const [linkToSale, setLinkToSale] = useState(false);
  const [ventasDisponibles, setVentasDisponibles] = useState<VentaLite[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [saleSearch, setSaleSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [originReason, setOriginReason] = useState("");
  const [originReasonOther, setOriginReasonOther] = useState("");

  // Modal razón de devolución
  const [returnModal, setReturnModal] = useState<Pedido | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

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

  useEffect(() => {
    fetchPedidos();
    // Clientes es opcional — si el rol no tiene permiso, simplemente no
    // se ofrece el selector, el pedido se sigue creando con nombre libre.
    (async () => {
      try {
        const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/clientes?org_id=${orgId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setClientes(data.clientes ?? []);
        }
      } catch { /* silencioso */ }
    })();
  }, [orgId]);

  const onSelectCliente = (id: string) => {
    const cliente = clientes.find((c) => c.id.toString() === id);
    setForm((f) => ({ ...f, customer_id: id, customer_name: cliente ? cliente.full_name : f.customer_name }));
  };

  const toggleLinkToSale = async (value: boolean) => {
    setLinkToSale(value);
    setSelectedSaleId(null);
    setOriginReason("");
    setOriginReasonOther("");
    if (value && ventasDisponibles.length === 0) {
      setLoadingVentas(true);
      try {
        const params = new URLSearchParams({ org_id: orgId.toString(), start: "2020-01-01", end: new Date().toISOString().split("T")[0] });
        const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/ventas?${params}`, { headers });
        if (res.ok) {
          const data = await res.json();
          // Solo mostramos ventas que aún no tienen un pedido vinculado
          setVentasDisponibles((data.ventas ?? []).filter((v: VentaLite) => !v.order));
        }
      } catch { /* silencioso */ } finally {
        setLoadingVentas(false);
      }
    }
  };

  const crearPedido = async () => {
    if (!form.customer_name) { setSubmitError("El nombre del cliente es obligatorio."); return; }
    if (linkToSale && !selectedSaleId) { setSubmitError("Selecciona la venta a vincular."); return; }
    if (!linkToSale && !originReason) { setSubmitError("Indica el motivo del pedido."); return; }
    if (!linkToSale && originReason === "Otro" && !originReasonOther.trim()) {
      setSubmitError("Describe el motivo del pedido.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/pedidos/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: orgId,
          sale_id: linkToSale ? selectedSaleId : null,
          origin_reason: linkToSale ? null : (originReason === "Otro" ? originReasonOther.trim() : originReason),
          customer_id: form.customer_id ? parseInt(form.customer_id as string) : null,
          customer_name: form.customer_name,
          carrier: form.carrier,
          tracking_number: form.tracking_number,
          shipping_cost: parseFloat(form.shipping_cost) || 0,
          street1: form.street1,
          street2: form.street2,
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
          country: form.country,
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el pedido");
      }
      setShowModal(false);
      setForm({ customer_id: "", customer_name: "", carrier: "Estafeta", tracking_number: "", shipping_cost: "", street1: "", street2: "", city: "", state: "", postal_code: "", country: "México", notes: "" });
      setLinkToSale(false);
      setSelectedSaleId(null);
      setOriginReason("");
      setOriginReasonOther("");
      setVentasDisponibles([]);
      fetchPedidos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cambiarStatus = async (pedido: Pedido, newStatus: string) => {
    // "Devuelto" necesita una razón — abrimos el modal en vez de guardar directo
    if (newStatus === "devuelto") {
      setReturnModal(pedido);
      setReturnReason("");
      return;
    }
    setPedidos((prev) => prev.map((p) => p.id === pedido.id ? { ...p, status: newStatus } : p));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/pedidos/${pedido.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPedidos();
    } catch { /* silencioso */ }
  };

  const confirmarDevolucion = async () => {
    if (!returnModal || !returnReason.trim()) return;
    setReturnSubmitting(true);
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/pedidos/${returnModal.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: "devuelto", return_reason: returnReason.trim() }),
      });
      setReturnModal(null);
      fetchPedidos();
    } catch { /* silencioso */ } finally {
      setReturnSubmitting(false);
    }
  };

  const filtered = pedidos.filter((p) => {
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const matchCarrier = filterCarrier === "todas" || p.carrier === filterCarrier;
    const q = search.toLowerCase();
    const matchSearch = p.customer_name.toLowerCase().includes(q) ||
      (p.tracking_number ?? "").toLowerCase().includes(q);
    return matchStatus && matchCarrier && matchSearch;
  });

  const counts: Record<string, number> = {};
  for (const p of pedidos) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const carriersEnUso = Array.from(new Set(pedidos.map((p) => p.carrier).filter(Boolean)));

  const filteredVentas = ventasDisponibles.filter((v) => v.id.toLowerCase().includes(saleSearch.toLowerCase()));

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
        <button onClick={() => { setShowModal(true); setSubmitError(""); setLinkToSale(false); setSelectedSaleId(null); setOriginReason(""); setOriginReasonOther(""); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Nuevo pedido
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-4 top-3.5 text-muted-foreground" />
          <input type="text" placeholder="Buscar por cliente o número de guía..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
        </div>
        {carriersEnUso.length > 1 && (
          <div className="relative">
            <select value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)}
              className="border border-border rounded-xl px-4 py-2.5 pr-8 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
              <option value="todas">Todas las paqueterías</option>
              {carriersEnUso.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
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
                      {search || filterStatus !== "todos" || filterCarrier !== "todas" ? "Sin pedidos que coincidan." : "Aún no registras envíos. Crea el primero."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const st = getStatusInfo(p.status);
                  const isExpanded = expandedId === p.id;
                  const trackUrl = getTrackingUrl(p);
                  const dias = diasEnStatus(p);
                  const umbral = UMBRAL_ATORO[p.status];
                  const atorado = umbral !== undefined && dias !== null && dias >= umbral;
                  const direccion = direccionCompleta(p);

                  return (
                    <>
                      <tr key={p.id}
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="hover:bg-muted/20 transition-colors cursor-pointer">
                        <td className="px-4 py-4 text-muted-foreground">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-foreground">{p.customer_name}</p>
                          {atorado && (
                            <p className="inline-flex items-center gap-1 text-[11px] text-amber-600 mt-0.5">
                              <AlertTriangle size={10} />
                              {dias} día{dias !== 1 ? "s" : ""} en este estatus
                            </p>
                          )}
                        </td>
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
                                <p className="text-sm text-foreground">{direccion || "Sin dirección registrada"}</p>
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
                              {!p.sale_id && p.origin_reason && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Motivo del pedido</p>
                                  <p className="text-sm text-foreground">{p.origin_reason}</p>
                                </div>
                              )}
                              {p.status === "devuelto" && p.return_reason && (
                                <div className="sm:col-span-2 rounded-xl bg-red-50 border border-red-100 p-3">
                                  <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Razón de la devolución</p>
                                  <p className="text-sm text-red-800">{p.return_reason}</p>
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
              {/* Toggle: vincular a una venta existente */}
              <div className="rounded-xl border border-border p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">¿Viene de una venta existente?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleLinkToSale(!linkToSale)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${linkToSale ? "bg-[var(--brand-red)]" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${linkToSale ? "translate-x-4" : ""}`} />
                  </button>
                </label>

                {linkToSale ? (
                  <div className="mt-4 pt-4 border-t border-border">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buscar venta por ID</label>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-3 text-muted-foreground" />
                      <input type="text" placeholder="VTA-..." value={saleSearch}
                        onChange={(e) => setSaleSearch(e.target.value)}
                        className="w-full border border-border rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                    </div>
                    {loadingVentas ? (
                      <p className="text-xs text-muted-foreground py-2">Cargando ventas...</p>
                    ) : filteredVentas.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No hay ventas sin pedido que coincidan.</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {filteredVentas.slice(0, 20).map((v) => (
                          <button key={v.id} type="button" onClick={() => setSelectedSaleId(v.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                              selectedSaleId === v.id ? "bg-[var(--tile-red)] text-[var(--brand-red)]" : "hover:bg-muted text-foreground"
                            }`}>
                            <span className="font-mono">{v.id}</span>
                            <span>{formatDate(v.sale_date)} · {formatCurrency(v.total_amount)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo del pedido *</label>
                      <div className="relative">
                        <select value={originReason} onChange={(e) => setOriginReason(e.target.value)}
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                          <option value="">Selecciona un motivo</option>
                          {ORIGIN_REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    {originReason === "Otro" && (
                      <input type="text" placeholder="Describe el motivo" value={originReasonOther}
                        onChange={(e) => setOriginReasonOther(e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {clientes.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Cliente existente (opcional)</label>
                  <div className="relative">
                    <select value={form.customer_id} onChange={(e) => onSelectCliente(e.target.value)}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      <option value="">Sin cliente</option>
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre de quien recibe *</label>
                <input type="text" placeholder="Nombre completo" value={form.customer_name}
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

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Costo del envío</label>
                <input type="number" placeholder="0.00" value={form.shipping_cost}
                  onChange={(e) => setForm((f) => ({ ...f, shipping_cost: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Dirección de entrega</p>

              <input type="text" placeholder="Calle y número" value={form.street1}
                onChange={(e) => setForm((f) => ({ ...f, street1: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              <input type="text" placeholder="Depto, referencias (opcional)" value={form.street2}
                onChange={(e) => setForm((f) => ({ ...f, street2: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />

              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Delegación / Ciudad" value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                <input type="text" placeholder="Estado" value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Código postal" value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                <input type="text" placeholder="País" value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
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

      {/* Modal razón de devolución */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-xl p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">¿Por qué se devuelve?</h3>
            <p className="text-sm text-muted-foreground mb-4">Pedido de {returnModal.customer_name}</p>
            <textarea
              autoFocus
              placeholder="Ej. cliente rechazó el paquete, producto dañado, dirección incorrecta..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setReturnModal(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarDevolucion} disabled={returnSubmitting || !returnReason.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {returnSubmitting ? "Guardando..." : "Confirmar devolución"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
