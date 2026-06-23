import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────
interface DashboardHomeProps {
  token: string;
  orgId: number;
}

type Period = "today" | "week" | "month" | "year" | "custom";

interface PeriodRange {
  start: string;
  end: string;
}

interface Metrics {
  ventas_totales: number;
  pedidos: number;
  ticket_promedio: number;
  ventas_totales_anterior: number;
  pedidos_anterior: number;
  ticket_promedio_anterior: number;
}

interface VentasMes {
  mes: string;
  ventas: number;
  anterior: number;
}

interface TopProducto {
  product_id: number;
  nombre: string;
  total_vendido: number;
  unidades: number;
}

interface InventarioItem {
  name: string;
  value: number;
}

// ─── Helpers de fecha ────────────────────────────────────────
function getRange(period: Period, custom: PeriodRange): PeriodRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (period === "today") {
    const s = fmt(today);
    return { start: s, end: s };
  }
  if (period === "week") {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: fmt(monday), end: fmt(today) };
  }
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(start), end: fmt(today) };
  }
  if (period === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: fmt(start), end: fmt(today) };
  }
  return custom;
}

function getPreviousRange(range: PeriodRange): PeriodRange {
  if (!range.start || !range.end) return { start: "", end: "" };
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { start: "", end: "" };
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatPct(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

const COLORS = ["#1A2332", "var(--brand-red)", "#94a3b8"];
const PRODUCT_COLORS = ["var(--brand-red)", "#1A2332", "#0066CC", "#00CC88", "#FFAA00"];

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
  custom: "Personalizado",
};

// ─── Componente delta ─────────────────────────────────────────
function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = formatPct(current, previous);
  if (pct === null) return null;
  const up = pct > 0;
  const zero = pct === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${
        zero
          ? "text-muted-foreground"
          : up
          ? "text-emerald-600"
          : "text-red-500"
      }`}
    >
      {zero ? (
        <Minus size={12} />
      ) : up ? (
        <TrendingUp size={12} />
      ) : (
        <TrendingDown size={12} />
      )}
      {Math.abs(pct).toFixed(1)}% vs periodo anterior
    </span>
  );
}

// ─── Componente principal ────────────────────────────────────
export default function DashboardHome({ token, orgId }: DashboardHomeProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<PeriodRange>({ start: "", end: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [ventasChart, setVentasChart] = useState<VentasMes[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = getRange(period, custom);
  const prevRange = getPreviousRange(range);

  const fetchData = useCallback(async () => {
    if (period === "custom" && (!custom.start || !custom.end)) {
      setLoading(false);
      return;
    }
  
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        org_id: orgId.toString(),
        start: range.start,
        end: range.end,
        prev_start: prevRange.start,
        prev_end: prevRange.end,
      });

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [metricsRes, chartRes, topRes, invRes] = await Promise.all([
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/metrics?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/ventas-chart?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/top-productos?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/inventario?org_id=${orgId}`, { headers }),
      ]);

      if (!metricsRes.ok || !chartRes.ok || !topRes.ok || !invRes.ok) {
        throw new Error("Error al cargar datos");
      }

      const [m, c, t, i] = await Promise.all([
        metricsRes.json(),
        chartRes.json(),
        topRes.json(),
        invRes.json(),
      ]);

      setMetrics(m);
      setVentasChart(c);
      setTopProductos(t);
      setInventario(i);
    } catch (e) {
      setError("No se pudieron cargar los datos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [period, custom, orgId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rangeLabel =
    range.start === range.end
      ? range.start
      : `${range.start} — ${range.end}`;

  return (
    <div>
      {/* ── Filtros de periodo ── */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPeriod(p);
              setShowCustom(p === "custom");
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? "bg-[var(--brand-red)] text-white"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2">{rangeLabel}</span>
      </div>

      {/* ── Date picker custom ── */}
      {showCustom && (
        <div className="flex items-center gap-3 mb-8 p-4 rounded-xl border border-border bg-background">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              value={custom.start}
              onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={custom.end}
              onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
            />
          </div>
          <button
            onClick={fetchData}
            className="mt-5 px-4 py-2 bg-[var(--brand-red)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">
          {error}
        </div>
      )}

      {/* ── Skeleton / Loading ── */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-3 mb-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-6 animate-pulse">
              <div className="h-3 w-24 bg-muted rounded mb-4" />
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* ── Métricas ── */}
          <div className="grid gap-6 md:grid-cols-3 mb-10">
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-1">Ventas totales</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(metrics.ventas_totales)}
              </p>
              <Delta current={metrics.ventas_totales} previous={metrics.ventas_totales_anterior} />
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-1">Pedidos</p>
              <p className="text-3xl font-bold text-foreground">{metrics.pedidos}</p>
              <Delta current={metrics.pedidos} previous={metrics.pedidos_anterior} />
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-1">Ticket promedio</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(metrics.ticket_promedio)}
              </p>
              <Delta current={metrics.ticket_promedio} previous={metrics.ticket_promedio_anterior} />
            </div>
          </div>

          {/* ── Gráficas fila 1 ── */}
          <div className="grid gap-6 mb-10 lg:grid-cols-3">
            {/* Ventas por mes */}
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm lg:col-span-2">
              <h3 className="text-base font-semibold text-foreground mb-6">
                Ventas por mes
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={ventasChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="ventas" name="Este periodo" stroke="var(--brand-red)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="anterior" name="Periodo anterior" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Inventario */}
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground mb-6">Inventario</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={inventario} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {inventario.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} productos`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {inventario.map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Top productos ── */}
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <h3 className="text-base font-semibold text-foreground mb-6">
              Top productos — {rangeLabel}
            </h3>
            {topProductos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en este periodo.</p>
            ) : (
              <div className="space-y-4">
                {topProductos.map((p, i) => (
                  <div key={p.product_id} className="flex items-center gap-4">
                    <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">{p.nombre}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(p.total_vendido)} · {p.unidades} uds
                        </span>
                      </div>
                      <div className="w-full bg-muted/50 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${(p.total_vendido / topProductos[0].total_vendido) * 100}%`,
                            backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
