import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, Package, AlertTriangle } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────
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

type ModalType = "nuevo" | "stock" | null;

// ─── Helpers ─────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

const CATEGORIES = ["Niña", "Niño", "Accesorio", "Unisex", "Otro"];

// ─── Componente principal ─────────────────────────────────────
export default function Productos({ token, orgId }: ProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("Todas");

  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Form nuevo producto
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", category: "Niña",
    unit_cost: "", unit_price: "", stock_current: "", stock_min: "",
  });

  // Form agregar stock
  const [stockQty, setStockQty] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // ── Fetch productos ──
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

  // ── Crear producto ──
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
      setModalType(null);
      setNewProduct({ name: "", sku: "", category: "Niña", unit_cost: "", unit_price: "", stock_current: "", stock_min: "" });
      fetchProductos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Agregar stock ──
  const agregarStock = async () => {
    if (!selectedProduct || !stockQty || parseInt(stockQty) <= 0) {
      setSubmitError("Ingresa una cantidad válida.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/productos/stock", {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: orgId,
          product_id: selectedProduct.id,
          quantity: parseInt(stockQty),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al agregar stock");
      }
      setModalType(null);
      setStockQty("");
      setSelectedProduct(null);
      fetchProductos();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtros ──
  const categories = ["Todas", ...Array.from(new Set(productos.map((p) => p.category)))];
  const filtered = productos.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "Todas" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const stockBajo = productos.filter((p) => p.stock_current <= p.stock_min && p.stock_current > 0).length;
  const agotados = productos.filter((p) => p.stock_current === 0).length;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Productos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{productos.length} productos en catálogo</p>
        </div>
        <button
          onClick={() => { setModalType("nuevo"); setSubmitError(""); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nuevo producto
        </button>
      </div>

      {/* ── Alertas de stock ── */}
      {(stockBajo > 0 || agotados > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {agotados > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm text-red-600 font-medium">{agotados} agotado{agotados > 1 ? "s" : ""}</span>
            </div>
          )}
          {stockBajo > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-sm text-amber-600 font-medium">{stockBajo} con stock bajo</span>
            </div>
          )}
        </div>
      )}

      {/* ── Búsqueda y filtros ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground"
        />
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-border rounded-xl px-4 py-2.5 pr-8 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
          >
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>
      )}

      {/* ── Grid de productos ── */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-5 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-3" />
              <div className="h-3 w-20 bg-muted rounded mb-4" />
              <div className="h-6 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={36} className="text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            {search ? "No hay productos que coincidan con tu búsqueda." : "Aún no hay productos. Agrega el primero."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const stockStatus =
              p.stock_current === 0
                ? { label: "Agotado", color: "bg-red-100 text-red-600" }
                : p.stock_current <= p.stock_min
                ? { label: "Stock bajo", color: "bg-amber-100 text-amber-700" }
                : { label: "En stock", color: "bg-emerald-100 text-emerald-700" };

            return (
              <div key={p.id} className="rounded-2xl border border-border bg-background p-5 hover:border-[var(--brand-red)]/30 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{p.name}</p>
                    {p.sku && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{p.sku}</p>}
                  </div>
                  <span className={`ml-2 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatus.color}`}>
                    {stockStatus.label}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Precio venta</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(p.unit_price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Stock</p>
                    <p className={`text-lg font-bold ${p.stock_current === 0 ? "text-red-500" : p.stock_current <= p.stock_min ? "text-amber-500" : "text-foreground"}`}>
                      {p.stock_current}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted">{p.category}</span>
                  <button
                    onClick={() => { setSelectedProduct(p); setModalType("stock"); setSubmitError(""); setStockQty(""); }}
                    className="ml-auto text-xs text-[var(--brand-red)] font-medium hover:underline"
                  >
                    + Agregar stock
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal nuevo producto ── */}
      {modalType === "nuevo" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nuevo producto</h3>
              <button onClick={() => setModalType(null)} className="text-muted-foreground hover:text-foreground transition-colors">
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
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground font-mono" />
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

              {submitError && (
                <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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

      {/* ── Modal agregar stock ── */}
      {modalType === "stock" && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Agregar stock</h3>
              <button onClick={() => setModalType(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-xl bg-muted/50 px-4 py-3 mb-5">
                <p className="text-sm font-medium text-foreground">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stock actual: {selectedProduct.stock_current} unidades</p>
              </div>

              <label className="text-sm font-medium text-foreground mb-1.5 block">Unidades a agregar</label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground mb-2"
              />
              {stockQty && parseInt(stockQty) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nuevo stock: <span className="font-medium text-foreground">{selectedProduct.stock_current + parseInt(stockQty)} unidades</span>
                </p>
              )}

              {submitError && (
                <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mt-4">{submitError}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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
