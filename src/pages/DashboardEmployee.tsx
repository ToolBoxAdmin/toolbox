import { useEffect, useState } from "react";
import { ShoppingBag, AlertTriangle, Package, Plus, Loader } from "lucide-react";

interface DashboardEmployeeProps {
  token: string;
  orgId: number;
  fullName: string;
  onGoVentas: () => void;
}

interface Resumen {
  ventas_hoy: number;
  total_hoy: number;
  alertas_stock: { name: string; stock: number; agotado: boolean }[];
  total_productos: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

export default function DashboardEmployee({ token, orgId, fullName, onGoVentas }: DashboardEmployeeProps) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchResumen = async () => {
      try {
        const res = await fetch(
          `https://toolbox-backend-rkit.onrender.com/api/employee/resumen?org_id=${orgId}`,
          { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResumen(data);
      } catch {
        setError("No se pudo cargar el resumen del día.");
      } finally {
        setLoading(false);
      }
    };
    fetchResumen();
  }, [orgId, token]);

  const hoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader className="animate-spin text-[var(--brand-red)]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Fecha */}
      <p className="text-sm text-muted-foreground capitalize mb-8">{hoy}</p>

      {error && (
        <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>
      )}

      {/* Métricas del día */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={15} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ventas de hoy</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{resumen?.ventas_hoy ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={15} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total vendido hoy</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(resumen?.total_hoy ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package size={15} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Productos activos</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{resumen?.total_productos ?? 0}</p>
        </div>
      </div>

      {/* CTA registrar venta */}
      <button
        onClick={onGoVentas}
        className="w-full mb-8 inline-flex items-center justify-center gap-2 px-6 py-4 bg-[var(--brand-red)] text-white rounded-2xl text-base font-semibold hover:opacity-90 transition-opacity"
      >
        <Plus size={18} />
        Registrar una venta
      </button>

      {/* Alertas de stock */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Productos por reabastecer</h3>
        </div>
        {!resumen || resumen.alertas_stock.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            Todo el inventario está en orden. 👌
          </p>
        ) : (
          <div className="divide-y divide-border">
            {resumen.alertas_stock.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-foreground">{a.name}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  a.agotado ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                }`}>
                  {a.agotado ? "Agotado" : `${a.stock} restantes`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
