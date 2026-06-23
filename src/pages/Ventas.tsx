import { useEffect, useState, useCallback } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";

interface VentasProps {
  token: string;
  orgId: number;
}

type Period = "today" | "week" | "month" | "year" | "custom";

interface PeriodRange {
  start: string;
  end: string;
}

interface Venta {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: string;
  status: string;
}

interface VentaItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Producto {
  id: number;
  name: string;
  unit_price: number;
  stock_current: number;
}

interface SaleItemForm {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

function getRange(period: Period, custom: PeriodRange): PeriodRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (period === "today") { const s = fmt(today); return { start: s, end: s }; }
  if (period === "week") {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: fmt(monday), end: fmt(today) };
  }
  if (period === "month") {
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) };
  }
  if (period === "year") {
    return { start: fmt(new Date(today.getFullYear(), 0, 1)), end: fmt(today) };
  }
  return custom;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy", week: "Esta semana", month: "Este mes", year: "Este año", custom: "Personalizado",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completada: { label: "Completada", color: "bg-emerald-100 text-emerald-700" },
  cancelada:  { label: "Cancelada",  color: "bg-red-100 text-red-600" },
  pendiente:  { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export default function Ventas({ token, orgId }: VentasProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<PeriodRange>({ start: "", end: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Desglose expandible
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ventaItems, setVentaItems] = useState<Record<string, VentaItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // Modal nueva venta
  const [showModal, setShowModal] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems] = useState<SaleItemForm[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const range = getRange(period, custom);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchVentas = useCallback(async () => {
    if (period === "custom" && (!custom.start || !custom.end)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ org_id: orgId.toString(), start: range.start, end: range.end });
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/ventas?${params}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVentas(data.ventas);
      setExpandedId(null);
      setVentaItems({});
    } catch {
      setError("No se pudieron cargar las ventas.");
    } finally {
      setLoading(false);
    }
  }, [period, custom, orgId, token]);

  useEffect(() => { fetchVentas(); }, [fetchVentas]);

  // ── Toggle desglose ──
  const toggleDesglose = async (ventaId: string) => {
    if (expandedId === ventaId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ventaId);
    if (ventaItems[ventaId]) return; // ya cargado

    setLoadingItems(ventaId);
    try {
      const res = await fetch(
        `https://toolbox-backend-rkit.onrender.com/api/ventas/${ventaId}/items`,
        { headers }
      );
      const data = await res.json();
      setVentaItems((prev) => ({ ...prev, [ventaId]: data.items }));
    } catch {
      setVentaItems((prev) => ({ ...prev, [ventaId]: [] }));
    } finally {
      setLoadingItems(null);
    }
  };

  const openModal = async () => {
    setShowModal(true);
    setItems([]);
    setPaymentMethod("efectivo");
    setSubmitError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/productos?org_id=${orgId}`, { headers });
      const data = await res.json();
      setProductos(data.productos);
    } catch {
      setSubmitError("No se pudieron cargar los productos.");
    }
  };

  const addItem = (prod: Producto) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.product_id === prod.id);
      if (exists) return prev.map((i) => i.product_id === prod.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: prod.id, product_name: prod.name, quantity: 1, unit_price: prod.unit_price }];
    });
  };

  const removeItem = (productId: number) => setItems((prev) => prev.filter((i) => i.product_id !== productId));

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) { removeItem(productId); return; }
    setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i));
  };

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const submitVenta = async () => {
    if (items.length === 0) { setSubmitError("Agrega al menos un producto."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/ventas/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({ org_id: orgId, payment_method: paymentMethod, items }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al registrar la venta");
      }
      setShowModal(false);
      fetchVentas();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalesVisibles = {
    total: ventas.reduce((s, v) => s + v.total_amount, 0),
    count: ventas.length,
    promedio: ventas.length > 0 ? ventas.reduce((s, v) => s + v.total_amount, 0) / ventas.length : 0,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Ventas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {range.start === range.end ? range.start : `${range.start} — ${range.end}`}
          </p>
        </div>
        <button onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Nueva venta
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button key={p}
            onClick={() => { setPeriod(p); setShowCustom(p === "custom"); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
            }`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border border-border bg-background">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input type="date" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input type="date" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
          </div>
          <button onClick={fetchVentas}
            className="mt-5 px-4 py-2 bg-[var(--brand-red)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Aplicar
          </button>
        </div>
      )}

      {/* Métricas rápidas */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[
            { label: "Total", value: formatCurrency(totalesVisibles.total) },
            { label: "Pedidos", value: totalesVisibles.count.toString() },
            { label: "Ticket promedio", value: formatCurrency(totalesVisibles.promedio) },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-background px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className="text-xl font-bold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>
      )}

      {/* Tabla de ventas */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Método</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Sin ventas en este periodo.
                  </td>
                </tr>
              ) : (
                ventas.map((v) => {
                  const st = STATUS_LABELS[v.status] ?? { label: v.status, color: "bg-muted text-muted-foreground" };
                  const isExpanded = expandedId === v.id;
                  const isLoadingThis = loadingItems === v.id;
                  const itemsDeVenta = ventaItems[v.id] ?? [];

                  return (
                    <>
                      <tr
                        key={v.id}
                        onClick={() => toggleDesglose(v.id)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-muted-foreground">
                          {isExpanded
                            ? <ChevronUp size={14} />
                            : <ChevronDown size={14} />
                          }
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{v.id}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatDate(v.sale_date)}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatCurrency(v.total_amount)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{PAYMENT_LABELS[v.payment_method] ?? v.payment_method}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>

                      {/* Desglose expandible */}
                      {isExpanded && (
                        <tr key={`${v.id}-items`} className="bg-muted/20">
                          <td colSpan={6} className="px-8 py-3">
                            {isLoadingThis ? (
                              <p className="text-xs text-muted-foreground py-2">Cargando productos...</p>
                            ) : itemsDeVenta.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">Sin detalle disponible.</p>
                            ) : (
                              <div className="space-y-1.5 py-1">
                                {itemsDeVenta.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-foreground">
                                      <span className="text-muted-foreground mr-2">{item.quantity}×</span>
                                      {item.product_name}
                                    </span>
                                    <span className="font-medium text-foreground">{formatCurrency(item.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
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

      {/* Modal nueva venta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nueva venta</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <p className="text-sm font-medium text-foreground mb-3">Agregar productos</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {productos.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} disabled={p.stock_current === 0}
                    className="flex items-center justify-between text-left px-3 py-2.5 rounded-xl border border-border hover:border-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <div>
                      <p className="text-sm font-medium text-foreground leading-tight">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Stock: {p.stock_current}</p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--brand-red)] ml-2 shrink-0">{formatCurrency(p.unit_price)}</span>
                  </button>
                ))}
              </div>

              {items.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-foreground mb-3">Resumen</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50">
                        <span className="text-sm text-foreground flex-1">{item.product_name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors text-sm">−</button>
                          <span className="text-sm font-medium text-foreground w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors text-sm">+</button>
                        </div>
                        <span className="text-sm font-semibold text-foreground w-20 text-right">{formatCurrency(item.unit_price * item.quantity)}</span>
                        <button onClick={() => removeItem(item.product_id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                    <span className="text-base font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm font-medium text-foreground mb-2 block">Método de pago</label>
                <div className="relative">
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {submitError && (
                <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-4">{submitError}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={submitVenta} disabled={submitting || items.length === 0}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Registrando..." : `Registrar — ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
