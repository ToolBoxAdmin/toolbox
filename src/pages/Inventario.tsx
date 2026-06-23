import { useEffect, useState } from "react";
import { AlertTriangle, X, ChevronDown, History } from "lucide-react";

interface InventarioProps {
  token: string;
  orgId: number;
}

interface Producto {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit_cost: number;
  unit_price: number;
  stock_current: number;
  stock_min: number;
  active: boolean;
}

interface Movimiento {
  id: number;
  type: string;
  quantity: number;
  reason: string;
  created_at: string;
  sale_id: string | null;
}

type FilterStock = "todos" | "ok" | "bajo" | "agotado";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function getStockStatus(p: Producto) {
  if (p.stock_current === 0) return { label: "Agotado", color: "bg-red-100 text-red-600", key: "agotado" };
  if (p.stock_current <= p.stock_min) return { label: "Stock bajo", color: "bg-amber-100 text-amber-700", key: "bajo" };
  return { label: "En stock", color: "bg-emerald-100 text-emerald-700", key: "ok" };
}

export default function Inventario({ token, orgId }: InventarioProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterStock>("todos");
  const [search, setSearch] = useState("");

  // Modal editar producto
  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState<Producto | null>(null);
  const [editForm, setEditForm] = useState({ name: "", sku: "", unit_cost: "", unit_price: "", stock_min: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Modal agregar stock
  const [stockModal, setStockModal] = useState(false);
  const [stockQty, setStockQty] = useState("");

  // Panel historial
  const [historialId, setHistorialId] = useState<number | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchProductos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/productos?org_id=${orgId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProductos(data.productos);
    } catch {
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProductos(); }, [orgId]);

  const openEdit = (p: Producto) => {
    setSelected(p);
    setEditForm({
      name: p.name,
      sku: p.sku ?? "",
      unit_cost: p.unit_cost?.toString() ?? "",
      unit_price: p.unit_price?.toString() ?? "",
      stock_min: p.stock_min?.toString() ?? "",
    });
    setSubmitError("");
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!editForm.name || !editForm.unit_price) {
      setSubmitError("Nombre y precio de venta son obligatorios.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/productos/${selected.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: editForm.name,
          sku: editForm.sku,
          unit_cost: parseFloat(editForm.unit_cost) || 0,
          unit_price: parseFloat(editForm.unit_price),
          stock_min: parseInt(editForm.stock_min) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setEditModal(false);
      fetchProductos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openStock = (p: Producto) => {
    setSelected(p);
    setStockQty("");
    setSubmitError("");
    setStockModal(true);
  };

  const agregarStock = async () => {
    if (!selected || !stockQty || parseInt(stockQty) <= 0) {
      setSubmitError("Ingresa una cantidad válida.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/productos/stock", {
        method: "POST",
        headers,
        body: JSON.stringify({ org_id: orgId, product_id: selected.id, quantity: parseInt(stockQty) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al agregar stock");
      }
      setStockModal(false);
      fetchProductos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHistorial = async (productId: number) => {
    if (historialId === productId) { setHistorialId(null); return; }
    setHistorialId(productId);
    setLoadingHistorial(true);
    try {
      const res = await fetch(
        `https://toolbox-backend-rkit.onrender.com/api/inventario/movimientos?product_id=${productId}&org_id=${orgId}`,
        { headers }
      );
      const data = await res.json();
      setMovimientos(data.movimientos ?? []);
    } catch {
      setMovimientos([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const filtered = productos.filter((p) => {
    const status = getStockStatus(p);
    const matchFilter = filter === "todos" || status.key === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    agotado: productos.filter((p) => p.stock_current === 0).length,
    bajo: productos.filter((p) => p.stock_current > 0 && p.stock_current <= p.stock_min).length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Inventario</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{productos.length} productos en catálogo</p>
        </div>
      </div>

      {/* Alertas */}
      {(counts.agotado > 0 || counts.bajo > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {counts.agotado > 0 && (
            <button onClick={() => setFilter("agotado")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${filter === "agotado" ? "bg-red-50 border-red-200" : "border-border hover:bg-red-50"}`}>
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm text-red-600 font-medium">{counts.agotado} agotado{counts.agotado > 1 ? "s" : ""}</span>
            </button>
          )}
          {counts.bajo > 0 && (
            <button onClick={() => setFilter("bajo")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${filter === "bajo" ? "bg-amber-50 border-amber-200" : "border-border hover:bg-amber-50"}`}>
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-sm text-amber-600 font-medium">{counts.bajo} con stock bajo</span>
            </button>
          )}
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Buscar por nombre o SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
        {(["todos", "ok", "bajo", "agotado"] as FilterStock[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}>
            {f === "todos" ? "Todos" : f === "ok" ? "En stock" : f === "bajo" ? "Stock bajo" : "Agotados"}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Costo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Sin productos que coincidan.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const status = getStockStatus(p);
                  const pct = Math.min(100, p.stock_min > 0 ? (p.stock_current / (p.stock_min * 3)) * 100 : 100);
                  const barColor = p.stock_current === 0 ? "bg-red-400" : p.stock_current <= p.stock_min ? "bg-amber-400" : "bg-emerald-400";
                  const isHistorial = historialId === p.id;

                  return (
                    <>
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{p.name}</td>
                        <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{p.sku || "—"}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{p.category}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{p.unit_cost ? formatCurrency(p.unit_cost) : "—"}</td>
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{formatCurrency(p.unit_price)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${p.stock_current === 0 ? "text-red-500" : p.stock_current <= p.stock_min ? "text-amber-500" : "text-foreground"}`}>
                              {p.stock_current}
                            </span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">mín {p.stock_min}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(p)}
                              className="text-xs text-[var(--brand-red)] font-medium hover:underline">
                              Editar
                            </button>
                            <span className="text-muted-foreground">·</span>
                            <button onClick={() => openStock(p)}
                              className="text-xs text-muted-foreground hover:text-foreground font-medium hover:underline">
                              + Stock
                            </button>
                            <span className="text-muted-foreground">·</span>
                            <button onClick={() => toggleHistorial(p.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium">
                              <History size={12} />
                              {isHistorial ? "Cerrar" : "Historial"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Historial de movimientos */}
                      {isHistorial && (
                        <tr key={`${p.id}-historial`} className="bg-muted/10">
                          <td colSpan={8} className="px-8 py-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Historial de movimientos</p>
                            {loadingHistorial ? (
                              <p className="text-xs text-muted-foreground">Cargando...</p>
                            ) : movimientos.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {movimientos.slice(0, 8).map((m, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        m.type === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                                      }`}>
                                        {m.type === "entrada" ? "+" : "-"}{m.quantity}
                                      </span>
                                      <span className="text-muted-foreground capitalize">{m.reason}</span>
                                      {m.sale_id && <span className="text-xs font-mono text-muted-foreground">{m.sale_id}</span>}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
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

      {/* Modal editar producto */}
      {editModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Editar producto</h3>
              <button onClick={() => setEditModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">SKU</label>
                <input type="text" value={editForm.sku} onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Costo</label>
                  <input type="number" value={editForm.unit_cost} onChange={(e) => setEditForm((f) => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Precio venta *</label>
                  <input type="number" value={editForm.unit_price} onChange={(e) => setEditForm((f) => ({ ...f, unit_price: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Stock mínimo</label>
                <input type="number" value={editForm.stock_min} onChange={(e) => setEditForm((f) => ({ ...f, stock_min: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar stock */}
      {stockModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Agregar stock</h3>
              <button onClick={() => setStockModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-xl bg-muted/50 px-4 py-3 mb-5">
                <p className="text-sm font-medium text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stock actual: {selected.stock_current} unidades</p>
              </div>

              <label className="text-sm font-medium text-foreground mb-1.5 block">Unidades a agregar</label>
              <input type="number" min="1" placeholder="0" value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] mb-2" />
              {stockQty && parseInt(stockQty) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nuevo stock: <span className="font-medium text-foreground">{selected.stock_current + parseInt(stockQty)} unidades</span>
                </p>
              )}

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mt-4">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setStockModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={agregarStock} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : "Agregar stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
