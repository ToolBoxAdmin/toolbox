import { useEffect, useState, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileDown, Loader } from "lucide-react";

interface ReportesProps {
  token: string;
  orgId: number;
  orgName: string;
}

type Period = "month" | "year" | "all" | "custom";

interface PeriodRange { start: string; end: string; }

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
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

export default function Reportes({ token, orgId, orgName }: ReportesProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<PeriodRange>({ start: "", end: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [metrics, setMetrics] = useState<any>(null);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
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
        org_id: orgId.toString(), start: range.start, end: range.end,
        prev_start: prevRange.start, prev_end: prevRange.end,
      });
      const fParams = new URLSearchParams({ org_id: orgId.toString(), start: range.start, end: range.end });

      const [mRes, tRes, iRes, fRes] = await Promise.all([
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/metrics?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/top-productos?${params}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/dashboard/inventario?org_id=${orgId}`, { headers }),
        fetch(`https://toolbox-backend-rkit.onrender.com/api/finanzas/resumen?${fParams}`, { headers }),
      ]);
      if (!mRes.ok || !tRes.ok || !iRes.ok || !fRes.ok) throw new Error();
      setMetrics(await mRes.json());
      setTopProductos(await tRes.json());
      setInventario(await iRes.json());
      setFinanzas(await fRes.json());
    } catch {
      setError("No se pudieron cargar los datos del reporte.");
    } finally {
      setLoading(false);
    }
  }, [period, custom, orgId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // El logo es independiente del resto (no se recarga con los filtros de periodo)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/perfil?org_id=${orgId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setLogoUrl(data.org?.logo_url ?? null);
        }
      } catch { /* silencioso — el reporte funciona igual sin logo */ }
    })();
  }, [orgId]);

  // ── Genera los párrafos de análisis según los números ──
  const analisisVentas = () => {
    if (!metrics) return "";
    const delta = metrics.ventas_totales_anterior > 0
      ? ((metrics.ventas_totales - metrics.ventas_totales_anterior) / metrics.ventas_totales_anterior) * 100
      : null;
    let base = `Durante este periodo se registraron ${metrics.pedidos} ventas por un total de ${formatCurrency(metrics.ventas_totales)}, con un ticket promedio de ${formatCurrency(metrics.ticket_promedio)}.`;
    if (delta !== null) {
      if (delta > 5) base += ` Esto representa un crecimiento del ${delta.toFixed(1)}% respecto al periodo anterior — una tendencia positiva que vale la pena mantener.`;
      else if (delta < -5) base += ` Esto representa una caída del ${Math.abs(delta).toFixed(1)}% respecto al periodo anterior. Se recomienda revisar qué cambió: temporada, inventario disponible o actividad de marketing.`;
      else base += ` El nivel de ventas se mantuvo estable respecto al periodo anterior (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%).`;
    }
    return base;
  };

  const analisisProductos = () => {
    if (!topProductos || topProductos.length === 0) return "No hubo ventas de productos en este periodo.";
    const top = topProductos[0];
    let txt = `El producto estrella fue "${top.nombre}" con ${formatCurrency(top.total_vendido)} en ventas (${top.unidades} unidades).`;
    if (topProductos.length >= 3) {
      const top3 = topProductos.slice(0, 3).reduce((s, p) => s + p.total_vendido, 0);
      const total = metrics?.ventas_totales || 1;
      const pct = (top3 / total) * 100;
      txt += ` Los 3 productos principales concentran el ${pct.toFixed(0)}% de los ingresos${pct > 60 ? " — una concentración alta; considera diversificar el catálogo o impulsar otros productos" : ""}.`;
    }
    return txt;
  };

  const analisisInventario = () => {
    if (!inventario || inventario.length === 0) return "";
    const bajo = inventario.find((i: any) => i.name === "Stock bajo")?.value ?? 0;
    const agotados = inventario.find((i: any) => i.name === "Agotados")?.value ?? 0;
    const ok = inventario.find((i: any) => i.name === "En stock")?.value ?? 0;
    if (agotados === 0 && bajo === 0) return `El inventario está saludable: los ${ok} productos activos tienen stock suficiente.`;
    let txt = "";
    if (agotados > 0) txt += `Hay ${agotados} producto${agotados > 1 ? "s" : ""} agotado${agotados > 1 ? "s" : ""} — cada día sin stock son ventas perdidas. `;
    if (bajo > 0) txt += `${bajo} producto${bajo > 1 ? "s" : ""} está${bajo > 1 ? "n" : ""} por debajo del stock mínimo y conviene reabastecer pronto.`;
    return txt;
  };

  const analisisFinanzas = () => {
    if (!finanzas) return "";
    let txt = `Los ingresos del periodo fueron ${formatCurrency(finanzas.ingresos)}, con un costo de mercancía de ${formatCurrency(finanzas.costo_mercancia)} y gastos operativos de ${formatCurrency(finanzas.gastos_operativos)}, dejando una utilidad neta de ${formatCurrency(finanzas.utilidad)} (margen del ${finanzas.margen}%).`;
    if (finanzas.margen >= 25) txt += " Es un margen sano para retail.";
    else if (finanzas.margen > 0) txt += " Hay espacio para mejorar el margen revisando costos o precios.";
    else txt += " El periodo cerró en números rojos; revisa la sección de Finanzas para identificar dónde ajustar.";
    return txt;
  };

  // ── PDF real, descargado directo — sin diálogo de impresión del navegador ──
  const descargarPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    setError("");
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Reportes largos se reparten en varias páginas automáticamente
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeOrgName = orgName.replace(/[^a-zA-Z0-9]+/g, "-");
      pdf.save(`Reporte-${safeOrgName}-${range.start}-al-${range.end}.pdf`);
    } catch {
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  const fechaGeneracion = new Date().toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div>
      {/* Controles */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reportes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Genera un reporte de tu negocio en PDF</p>
        </div>
        <button onClick={descargarPDF} disabled={loading || !metrics || generating}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {generating ? <Loader size={16} className="animate-spin" /> : <FileDown size={16} />}
          {generating ? "Generando..." : "Descargar PDF"}
        </button>
      </div>

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
        <div className="flex items-center justify-center h-[40vh]">
          <Loader className="animate-spin text-[var(--brand-red)]" size={28} />
        </div>
      ) : metrics && finanzas ? (
        /* ══════════ EL REPORTE (esto es lo que se convierte a PDF) ══════════ */
        <div ref={reportRef} className="rounded-2xl border border-border bg-white p-10 max-w-3xl">

          {/* Encabezado */}
          <div className="border-b-2 border-[#1A2332] pb-6 mb-8">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} crossOrigin="anonymous" className="h-14 mb-4 object-contain" />
            ) : (
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-red)] mb-2">
                Reporte de negocio · ToolBox
              </p>
            )}
            <h1 className="text-3xl font-bold text-[#1A2332]">{orgName}</h1>
            <p className="text-sm text-gray-500 mt-2">
              Periodo: {range.start} al {range.end} · Generado el {fechaGeneracion}
            </p>
          </div>

          {/* Resumen ejecutivo */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Ventas</p>
              <p className="text-lg font-bold text-[#1A2332]">{formatCurrency(metrics.ventas_totales)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Pedidos</p>
              <p className="text-lg font-bold text-[#1A2332]">{metrics.pedidos}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Ticket promedio</p>
              <p className="text-lg font-bold text-[#1A2332]">{formatCurrency(metrics.ticket_promedio)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Utilidad neta</p>
              <p className={`text-lg font-bold ${finanzas.utilidad >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(finanzas.utilidad)}
              </p>
            </div>
          </div>

          {/* Secciones de análisis */}
          <div className="space-y-7">
            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-gray-200">1. Ventas</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{analisisVentas()}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-gray-200">2. Productos</h2>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{analisisProductos()}</p>
              {topProductos.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Unidades</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductos.map((p, i) => (
                      <tr key={p.product_id} className="border-b border-gray-100">
                        <td className="py-2 text-gray-500">{i + 1}</td>
                        <td className="py-2 text-gray-800 font-medium">{p.nombre}</td>
                        <td className="py-2 text-right text-gray-600">{p.unidades}</td>
                        <td className="py-2 text-right text-gray-800 font-medium">{formatCurrency(p.total_vendido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-gray-200">3. Inventario</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{analisisInventario()}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-gray-200">4. Finanzas</h2>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{analisisFinanzas()}</p>
              {finanzas.tips && finanzas.tips.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs font-semibold text-amber-800 uppercase mb-2">Recomendaciones</p>
                  <ul className="space-y-1.5">
                    {finanzas.tips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 leading-relaxed">• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* Pie */}
          <div className="mt-10 pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">Generado con ToolBox · toolbox.mx</p>
            <p className="text-xs text-gray-400">{fechaGeneracion}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
