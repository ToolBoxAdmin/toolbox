import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, Package, ChevronRight, TrendingUp } from "lucide-react";

interface ProductosProps {
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

interface TopVenta {
  mes: string;
  total: number;
  unidades: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

const CATEGORIES = ["Niña", "Niño", "Accesorio", "Unisex", "Otro"];

const CATEGORY_COLORS: Record<string, string> = {
  "Niña": "bg-pink-100 text-pink-700",
  "Niño": "bg-blue-100 text-blue-700",
  "Accesorio": "bg-purple-100 text-purple-700",
  "Unisex": "bg-teal-100 text-teal-700",
  "Otro": "bg-gray-100 text-gray-600",
};

export default function Productos({ token, orgId }: ProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("Todas");

  // Panel lateral detalle
  const [panelProduct, setPanelProduct] = useState<Producto | null>(null);
  const [topVentas, setTopVentas] = useState<TopVenta[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  // Modal nuevo producto
  const [showModal, setShowModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", category: "Niña",
    unit_cost: "", unit_price: "", stock_current: "", stock_min: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const openPanel = async (p: Producto) => {
    setPanelProduct(p);
    setLoadingPanel(true);
    try {
      const res = await fetch(
        `https://toolbox-backend-rkit.onrender.com/api/productos/${p.id}/ventas?org_id=${orgId}`,
        { headers }
      );
      const data = await res.json();
      setTopVentas(data.ventas_por_mes ?? []);
    } catch {
      setTopVentas([]);
    } finally {
      setLoadingPanel(false);
    }
  };

  const crearProducto = async () => {
    if (!newProduct.name || !newProduct.unit_price) {
      setSubmitError("Nombre y precio de venta son obligatorios.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/productos/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: orgId,
          name: newProduct.name,
          sku: newProduct.sku,
          category: newProduct.category,
          unit_cost: parseFloat(newProduct.unit_cost) || 0,
          unit_price: parseFloat(newProduct.unit_price),
          stock_current: parseInt(newProduct.stock_current) || 0,
          stock_min: parseInt(newProduct.stock_min) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el producto");
      }
      setShowModal(false);
      setNewProduct({ name: "", sku: "", category: "Niña", unit_cost: "", unit_price: "", stock_current: "", stock_min: "" });
      fetchProductos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["Todas", ...Array.from(new Set(productos.map((p) => p.category)))];

  const filtered = productos.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "Todas" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const margen = (p: Producto) => {
    if (!p.unit_cost || p.unit_cost === 0) return null;
    return ((p.unit_price - p.unit_cost) / p.unit_price) * 100;
  };

  return (
    <div className="flex gap-6">
      {/* Grid principal */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${panelProduct ? "max-w-[calc(100%-360px)]" : ""}`}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Productos</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{productos.length} productos en catálogo</p>
          </div>
          <button onClick={() => { setShowModal(true); setSubmitError(""); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Nuevo producto
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input type="text" placeholder="Buscar por nombre o SKU..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
          <div className="relative">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-border rounded-xl px-4 py-2.5 pr-8 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-5 animate-pulse">
                <div className="h-32 bg-muted rounded-xl mb-4" />
                <div className="h-4 w-32 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={36} className="text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {search ? "No hay productos que coincidan." : "Aún no hay productos. Agrega el primero."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const isActive = panelProduct?.id === p.id;
              const m = margen(p);
              return (
                <button key={p.id} onClick={() => openPanel(p)} className={`text-left rounded-2xl border bg-background p-5 hover:shadow-md transition-all group ${isActive ? "border-[var(--brand-red)] ring-1 ring-[var(--brand-red)]/20" : "border-border hover:border-[var(--brand-red)]/30"}`}>

                  {/* Imagen placeholder */}
                  <div className="w-full h-36 rounded-xl bg-muted/50 flex items-center justify-center mb-4 overflow-hidden">
                    <Package size={40} className="text-muted-foreground/40" />
                  </div>

                  {/* Info */}
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground leading-tight flex-1 mr-2">{p.name}</p>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-0.5 group-hover:text-[var(--brand-red)] transition-colors" />
                  </div>

                  {p.sku && <p className="text-xs font-mono text-muted-foreground mb-3">{p.sku}</p>}

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[p.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.category}
                    </span>
                    <span className="text-base font-bold text-foreground">{formatCurrency(p.unit_price)}</span>
                  </div>

                  {m !== null && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Margen</span>
                      <span className={`text-xs font-medium ${m >= 30 ? "text-emerald-600" : m >= 15 ? "text-amber-600" : "text-red-500"}`}>
                        {m.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel lateral detalle */}
      {panelProduct && (
        <div className="w-[340px] shrink-0 rounded-2xl border border-border bg-background overflow-hidden sticky top-24 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Detalle del producto</h3>
            <button onClick={() => setPanelProduct(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Imagen */}
          <div className="w-full h-44 bg-muted/40 flex items-center justify-center border-b border-border">
            <Package size={48} className="text-muted-foreground/30" />
          </div>

          <div className="p-5 space-y-4">
            {/* Nombre y categoría */}
            <div>
              <h2 className="text-lg font-bold text-foreground">{panelProduct.name}</h2>
              {panelProduct.sku && <p className="text-xs font-mono text-muted-foreground mt-0.5">{panelProduct.sku}</p>}
              <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[panelProduct.category] ?? "bg-gray-100 text-gray-600"}`}>
                {panelProduct.category}
              </span>
            </div>

            {/* Precios */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">Precio venta</p>
                <p className="text-base font-bold text-foreground">{formatCurrency(panelProduct.unit_price)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">Costo</p>
                <p className="text-base font-bold text-foreground">
                  {panelProduct.unit_cost ? formatCurrency(panelProduct.unit_cost) : "—"}
                </p>
              </div>
            </div>

            {/* Margen */}
            {margen(panelProduct) !== null && (
              <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Margen de ganancia</span>
                </div>
                <span className={`text-sm font-semibold ${(margen(panelProduct) ?? 0) >= 30 ? "text-emerald-600" : (margen(panelProduct) ?? 0) >= 15 ? "text-amber-600" : "text-red-500"}`}>
                  {margen(panelProduct)?.toFixed(1)}%
                </span>
              </div>
            )}

            {/* Stock */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Stock actual</span>
                <span className={`text-sm font-bold ${panelProduct.stock_current === 0 ? "text-red-500" : panelProduct.stock_current <= panelProduct.stock_min ? "text-amber-500" : "text-emerald-600"}`}>
                  {panelProduct.stock_current} uds
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${panelProduct.stock_current === 0 ? "bg-red-400" : panelProduct.stock_current <= panelProduct.stock_min ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(100, panelProduct.stock_min > 0 ? (panelProduct.stock_current / (panelProduct.stock_min * 3)) * 100 : 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Mínimo: {panelProduct.stock_min} uds</p>
            </div>

            {/* Historial de ventas por mes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Ventas por mes</p>
              {loadingPanel ? (
                <p className="text-xs text-muted-foreground">Cargando...</p>
              ) : topVentas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin ventas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {topVentas.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{v.mes}</span>
                      <div className="text-right">
                        <span className="font-medium text-foreground">{formatCurrency(v.total)}</span>
                        <span className="text-xs text-muted-foreground ml-2">{v.unidades} uds</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo producto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nuevo producto</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre *</label>
                <input type="text" placeholder="Traje de baño niña flores" value={newProduct.name}
                  onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">SKU</label>
                  <input type="text" placeholder="TB-NF-001" value={newProduct.sku}
                    onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Categoría</label>
                  <div className="relative">
                    <select value={newProduct.category} onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Costo</label>
                  <input type="number" placeholder="0.00" value={newProduct.unit_cost}
                    onChange={(e) => setNewProduct((p) => ({ ...p, unit_cost: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Precio venta *</label>
                  <input type="number" placeholder="0.00" value={newProduct.unit_price}
                    onChange={(e) => setNewProduct((p) => ({ ...p, unit_price: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Stock inicial</label>
                  <input type="number" placeholder="0" value={newProduct.stock_current}
                    onChange={(e) => setNewProduct((p) => ({ ...p, stock_current: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Stock mínimo</label>
                  <input type="number" placeholder="5" value={newProduct.stock_min}
                    onChange={(e) => setNewProduct((p) => ({ ...p, stock_min: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={crearProducto} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : "Guardar producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
