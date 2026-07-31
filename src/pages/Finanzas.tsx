import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, X, ChevronDown, Trash2, Lightbulb, TrendingUp, TrendingDown, Repeat, Pause, Play } from "lucide-react";

interface FinanzasProps {
  token: string;
  orgId: number;
}

type Period = "month" | "year" | "all" | "custom";

interface PeriodRange { start: string; end: string; }

interface Resumen {
  ingresos: number;
  costo_mercancia: number;
  gastos_operativos: number;
  utilidad: number;
  margen: number;
  por_categoria: { categoria: string; monto: number }[];
  chart: { mes: string; ingresos: number; gastos: number }[];
  proyeccion_30: number;
  tips: string[];
}

interface Gasto {
  id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
}

interface Recurrente {
  id: number;
  category: string;
  description: string;
  amount: number;
  day_of_month: number;
  active: boolean;
}

const CATEGORIAS = ["Mercancía", "Renta", "Servicios", "Nómina", "Marketing", "Envíos", "Otro"];

const RECURRING_TEMPLATES = [
  { label: "Renta", category: "Renta", day: 1 },
  { label: "Luz / Servicios", category: "Servicios", day: 5 },
  { label: "Nómina", category: "Nómina", day: 15 },
  { label: "Internet", category: "Servicios", day: 10 },
  { label: "Seguridad / Vigilancia", category: "Otro", day: 1 },
];

const PERIOD_LABELS: Record<Period, string> = {
  month: "Este mes", year: "Este año", all: "Todo", custom: "Personalizado",
};

function getRange(period: Period, custom: PeriodRange): PeriodRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (period === "month") return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) };
  if (period === "year") return { start: fmt(new Date(today.getFullYear(), 0, 1)), end: fmt(today) };
  if (period === "all") return { start: "2020-01-01", end: fmt(today) };
  return custom;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Finanzas({ token, orgId }: FinanzasProps) {
  const [period, setPeriod] = useState<Period>("year");
  const [custom, setCustom] = useState<PeriodRange>({ start: "", end: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal gasto
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    category: "Mercancía", description: "", amount: "",
    expense_date: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Gastos recurrentes
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [showRecModal, setShowRecModal] = useState(false);
  const [recForm, setRecForm] = useState({ category: "Renta", description: "", amount: "", day_of_month: "1" });
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError, setRecError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const range = getRange(period, custom);

  const fetchData = useCallback(async () => {
    if (period === "custom" && (!custom.start || !custom.end)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ org_id: orgId.toString(), start: range.start, end: range.end });
      const [resRes, gasRes] = await Promise.all([
        fetch(`https://toolbox-backend-rkit.onrender.com/api/finanzas/resumen?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/gastos?${params}`, { headers }),
      ]);
      if (!resRes.ok || !gasRes.ok) throw new Error();
      const resData = await resRes.json();
      const gasData = await gasRes.json();
      setResumen(resData);
      setGastos(gasData.gastos);
    } catch {
      setError("No se pudieron cargar las finanzas.");
    } finally {
      setLoading(false);
    }
  }, [period, custom, orgId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchRecurrentes = async () => {
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/gastos-recurrentes?org_id=${orgId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecurrentes(data.recurrentes ?? []);
      }
    } catch { /* silencioso */ }
  };

  useEffect(() => { fetchRecurrentes(); }, [orgId]);

  const crearGasto = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setSubmitError("Ingresa un monto válido.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/gastos/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: orgId,
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
          expense_date: form.expense_date,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al registrar el gasto");
      }
      setShowModal(false);
      setForm({ category: "Mercancía", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
      fetchData();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const aplicarPlantilla = (t: typeof RECURRING_TEMPLATES[number]) => {
    setRecForm({ category: t.category, description: t.label, amount: "", day_of_month: t.day.toString() });
  };

  const crearRecurrente = async () => {
    if (!recForm.amount || parseFloat(recForm.amount) <= 0) { setRecError("Ingresa un monto válido."); return; }
    const day = parseInt(recForm.day_of_month);
    if (!day || day < 1 || day > 28) { setRecError("El día debe estar entre 1 y 28."); return; }
    setRecSubmitting(true);
    setRecError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/gastos-recurrentes/crear", {
        method: "POST", headers,
        body: JSON.stringify({
          org_id: orgId, category: recForm.category, description: recForm.description,
          amount: parseFloat(recForm.amount), day_of_month: day,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el gasto recurrente");
      }
      setShowRecModal(false);
      setRecForm({ category: "Renta", description: "", amount: "", day_of_month: "1" });
      fetchRecurrentes();
    } catch (e: any) {
      setRecError(e.message);
    } finally {
      setRecSubmitting(false);
    }
  };

  const toggleRecurrente = async (r: Recurrente) => {
    setRecurrentes((prev) => prev.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/gastos-recurrentes/${r.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ active: !r.active }),
      });
    } catch { fetchRecurrentes(); }
  };

  const eliminarRecurrente = async (id: number) => {
    setRecurrentes((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/gastos-recurrentes/${id}`, { method: "DELETE", headers });
    } catch { /* silencioso */ }
  };

  const eliminarGasto = async (id: number) => {
    setGastos((prev) => prev.filter((g) => g.id !== id));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/gastos/${id}`, { method: "DELETE", headers });
      fetchData();
    } catch { /* silencioso */ }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finanzas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {range.start} — {range.end}
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setSubmitError(""); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Registrar gasto
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
          <button onClick={fetchData}
            className="mt-5 px-4 py-2 bg-[var(--brand-red)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Aplicar
          </button>
        </div>
      )}

      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-6 animate-pulse">
              <div className="h-3 w-24 bg-muted rounded mb-4" />
              <div className="h-8 w-28 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : resumen ? (
        <>
          {/* Métricas */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="text-sm text-muted-foreground mb-1">Ingresos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(resumen.ingresos)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="text-sm text-muted-foreground mb-1">Costo de mercancía</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(resumen.costo_mercancia)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="text-sm text-muted-foreground mb-1">Gastos operativos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(resumen.gastos_operativos)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="text-sm text-muted-foreground mb-1">Utilidad neta</p>
              <p className={`text-2xl font-bold ${resumen.utilidad >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(resumen.utilidad)}
              </p>
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                resumen.margen >= 20 ? "bg-emerald-100 text-emerald-700" : resumen.margen >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
              }`}>
                Margen {resumen.margen}%
              </span>
            </div>
          </div>

          {/* Gráfica + proyección */}
          <div className="grid gap-6 mb-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
              <h3 className="text-base font-semibold text-foreground mb-6">Ingresos vs Gastos por mes</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={resumen.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                    formatter={(v: any) => formatCurrency(Number(v))}
                  />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#00CC88" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill="var(--brand-red)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {/* Proyección */}
              <div className={`rounded-2xl border p-6 ${resumen.proyeccion_30 >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {resumen.proyeccion_30 >= 0
                    ? <TrendingUp size={15} className="text-emerald-600" />
                    : <TrendingDown size={15} className="text-red-500" />}
                  <p className="text-sm font-medium text-foreground">Flujo proyectado 30 días</p>
                </div>
                <p className={`text-2xl font-bold ${resumen.proyeccion_30 >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatCurrency(resumen.proyeccion_30)}
                </p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Basado en el promedio diario neto de tus últimos 60 días.
                </p>
              </div>

              {/* Gastos por categoría */}
              <div className="rounded-2xl border border-border bg-background p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Gastos por categoría</h3>
                {resumen.por_categoria.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin gastos registrados en este periodo.</p>
                ) : (
                  <div className="space-y-3">
                    {resumen.por_categoria.map((c) => (
                      <div key={c.categoria}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{c.categoria}</span>
                          <span className="text-xs font-medium text-foreground">{formatCurrency(c.monto)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--brand-red)] rounded-full"
                            style={{ width: `${(c.monto / resumen.por_categoria[0].monto) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-border bg-background p-6 mb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Consejos para tu negocio</h3>
            <div className="space-y-3">
              {resumen.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb size={14} className="text-amber-500" />
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gastos recurrentes */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Repeat size={15} className="text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">Gastos recurrentes</h3>
              </div>
              <button onClick={() => { setShowRecModal(true); setRecError(""); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-red)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                <Plus size={13} />
                Agregar
              </button>
            </div>
            {recurrentes.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Configura tus gastos fijos (renta, nómina, servicios) para que se registren solos cada mes, justo cuando llegue su día.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recurrentes.map((r) => (
                  <div key={r.id} className={`flex items-center justify-between px-6 py-3.5 ${!r.active ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.description || r.category}</p>
                        <p className="text-xs text-muted-foreground">{r.category} · Día {r.day_of_month} de cada mes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(r.amount)}</span>
                      <button onClick={() => toggleRecurrente(r)} title={r.active ? "Pausar" : "Reanudar"}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        {r.active ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                      <button onClick={() => eliminarRecurrente(r.id)} title="Eliminar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de gastos */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Gastos registrados ({gastos.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto</th>
                    <th className="px-6 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gastos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                        Sin gastos en este periodo. Registra el primero para conocer tu utilidad real.
                      </td>
                    </tr>
                  ) : (
                    gastos.map((g) => (
                      <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-muted-foreground">{formatDate(g.expense_date)}</td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                            {g.category}
                          </span>
                          {g.category === "ToolBox" && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">Auto</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-foreground">{g.description || "—"}</td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-foreground text-right">{formatCurrency(g.amount)}</td>
                        <td className="px-6 py-3.5 text-right">
                          <button onClick={() => eliminarGasto(g.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Modal registrar gasto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Registrar gasto</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Categoría</label>
                  <div className="relative">
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Monto *</label>
                  <input type="number" placeholder="0.00" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Descripción</label>
                <input type="text" placeholder="Renta del local de junio" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Fecha</label>
                <input type="date" value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={crearGasto} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : "Registrar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo gasto recurrente */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nuevo gasto recurrente</h3>
              <button onClick={() => setShowRecModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Plantillas rápidas (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {RECURRING_TEMPLATES.map((t) => (
                    <button key={t.label} type="button" onClick={() => aplicarPlantilla(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  O llena los campos de abajo con cualquier otro gasto que se repita mes con mes.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Categoría</label>
                  <div className="relative">
                    <select value={recForm.category} onChange={(e) => setRecForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Monto *</label>
                  <input type="number" placeholder="0.00" value={recForm.amount}
                    onChange={(e) => setRecForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Descripción</label>
                <input type="text" placeholder="Renta del local" value={recForm.description}
                  onChange={(e) => setRecForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Día del mes en que se cobra</label>
                <input type="number" min={1} max={28} value={recForm.day_of_month}
                  onChange={(e) => setRecForm((f) => ({ ...f, day_of_month: e.target.value }))}
                  className="w-28 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                <p className="text-[11px] text-muted-foreground mt-1.5">Entre el 1 y el 28, para que funcione igual todos los meses.</p>
              </div>

              {recError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{recError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowRecModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={crearRecurrente} disabled={recSubmitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {recSubmitting ? "Guardando..." : "Guardar recurrente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
