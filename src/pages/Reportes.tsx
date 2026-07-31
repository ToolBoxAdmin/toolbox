import { useEffect, useState, useCallback } from "react";
import jsPDF from "jspdf";
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

const BRAND_RED: [number, number, number] = [255, 45, 45];
const NAVY: [number, number, number] = [26, 35, 50];
const GRAY_LIGHT: [number, number, number] = [249, 250, 251];
const GRAY_BORDER: [number, number, number] = [229, 231, 235];
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const GRAY_BODY: [number, number, number] = [55, 65, 81];
const GRAY_DARK: [number, number, number] = [31, 41, 55];
const GREEN: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [239, 68, 68];
const AMBER_TEXT: [number, number, number] = [146, 64, 14];

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

// Convierte la URL del logo a base64 para poder incrustarlo en el PDF
async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  const fechaGeneracion = new Date().toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });

  // ── PDF construido directamente con jsPDF — sin capturar la pantalla,
  // así que ningún color de CSS puede tronarlo. ──
  const descargarPDF = async () => {
    if (!metrics || !finanzas) return;
    setGenerating(true);
    setError("");
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const checkPageBreak = (needed: number) => {
        if (y + needed > pageHeight - 15) {
          pdf.addPage();
          y = 20;
        }
      };

      // ── Encabezado: marca ToolBox a la izquierda, logo del cliente a la derecha ──
      const headerTop = y;
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...NAVY);
      pdf.text("Tool", margin, headerTop);
      const toolWidth = pdf.getTextWidth("Tool");
      pdf.setTextColor(...BRAND_RED);
      pdf.text("Box", margin + toolWidth, headerTop);

      pdf.setTextColor(...GRAY_TEXT);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.text("REPORTE DE NEGOCIO", margin, headerTop + 5);

      if (logoUrl) {
        try {
          const dataUrl = await urlToDataURL(logoUrl);
          const props = pdf.getImageProperties(dataUrl);
          const logoHeight = 14;
          const logoWidth = (props.width / props.height) * logoHeight;
          pdf.addImage(dataUrl, "JPEG", pageWidth - margin - logoWidth, headerTop - 9, logoWidth, logoHeight);
        } catch { /* si el logo falla, el encabezado sigue viéndose bien sin él */ }
      }
      y = headerTop + 14;

      pdf.setTextColor(...NAVY);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text(orgName, margin, y);
      y += 6;

      pdf.setTextColor(...GRAY_TEXT);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Periodo: ${range.start} al ${range.end}  ·  Generado el ${fechaGeneracion}`, margin, y);
      y += 4;

      pdf.setDrawColor(...BRAND_RED);
      pdf.setLineWidth(1);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // ── Resumen ejecutivo (4 cuadros con acento de color arriba) ──
      const boxGap = 3;
      const boxWidth = (contentWidth - boxGap * 3) / 4;
      const boxHeight = 20;
      const boxes = [
        { label: "Ventas", value: formatCurrency(metrics.ventas_totales), color: NAVY, accent: BRAND_RED },
        { label: "Pedidos", value: String(metrics.pedidos), color: NAVY, accent: NAVY },
        { label: "Ticket promedio", value: formatCurrency(metrics.ticket_promedio), color: NAVY, accent: NAVY },
        { label: "Utilidad neta", value: formatCurrency(finanzas.utilidad), color: finanzas.utilidad >= 0 ? GREEN : RED, accent: finanzas.utilidad >= 0 ? GREEN : RED },
      ];
      boxes.forEach((box, i) => {
        const x = margin + i * (boxWidth + boxGap);
        pdf.setFillColor(...GRAY_LIGHT);
        pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, "F");
        pdf.setFillColor(...box.accent);
        pdf.rect(x, y, boxWidth, 1.2, "F");
        pdf.setTextColor(...GRAY_TEXT);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(box.label, x + 3, y + 7);
        pdf.setTextColor(...box.color);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        const valueLines = pdf.splitTextToSize(box.value, boxWidth - 6);
        pdf.text(valueLines[0], x + 3, y + 16);
      });
      y += boxHeight + 10;

      // ── Helper: número con círculo de color + título + párrafo ──
      const addSection = (num: number, title: string, text: string) => {
        checkPageBreak(22);
        pdf.setFillColor(...BRAND_RED);
        pdf.circle(margin + 2.5, y - 1.5, 3, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text(String(num), margin + 2.5, y - 0.2, { align: "center" });

        pdf.setTextColor(...NAVY);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin + 8, y);
        y += 3;
        pdf.setDrawColor(...GRAY_BORDER);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 6;
        pdf.setTextColor(...GRAY_BODY);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(text, contentWidth);
        checkPageBreak(lines.length * 4.5);
        pdf.text(lines, margin, y);
        y += lines.length * 4.5 + 8;
      };

      addSection(1, "Ventas", analisisVentas());
      addSection(2, "Productos", analisisProductos());

      // Tabla de productos top
      if (topProductos.length > 0) {
        checkPageBreak(10 + topProductos.length * 5.5);
        pdf.setTextColor(...GRAY_TEXT);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.text("#", margin, y);
        pdf.text("PRODUCTO", margin + 8, y);
        pdf.text("UNIDADES", pageWidth - margin - 32, y);
        pdf.text("TOTAL", pageWidth - margin, y, { align: "right" });
        y += 2;
        pdf.setDrawColor(...GRAY_BORDER);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;

        pdf.setFont("helvetica", "normal");
        topProductos.forEach((p, i) => {
          checkPageBreak(6);
          if (i % 2 === 0) {
            pdf.setFillColor(254, 242, 242); // rojo muy claro, alterna las filas
            pdf.rect(margin, y - 3.8, contentWidth, 5.5, "F");
          }
          pdf.setTextColor(...GRAY_TEXT);
          pdf.setFontSize(9);
          pdf.text(String(i + 1), margin, y);
          pdf.setTextColor(...GRAY_DARK);
          const nombre = p.nombre.length > 45 ? p.nombre.slice(0, 42) + "..." : p.nombre;
          pdf.text(nombre, margin + 8, y);
          pdf.setTextColor(...GRAY_BODY);
          pdf.text(String(p.unidades), pageWidth - margin - 32, y);
          pdf.setTextColor(...GRAY_DARK);
          pdf.text(formatCurrency(p.total_vendido), pageWidth - margin, y, { align: "right" });
          y += 5.5;
        });
        y += 6;
      }

      addSection(3, "Inventario", analisisInventario());
      addSection(4, "Finanzas", analisisFinanzas());

      // Recomendaciones — caja con acento de color
      if (finanzas.tips && finanzas.tips.length > 0) {
        checkPageBreak(20);
        // Primero medimos cuánto va a ocupar el texto para poder dibujar la caja detrás
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        let measuredHeight = 12;
        const allLines: string[][] = finanzas.tips.map((tip: string) => {
          const lines = pdf.splitTextToSize(`•  ${tip}`, contentWidth - 10);
          measuredHeight += lines.length * 4.3 + 2;
          return lines;
        });

        checkPageBreak(measuredHeight + 5);

        const boxTop = y - 5;
        pdf.setFillColor(255, 251, 235);
        pdf.roundedRect(margin, boxTop, contentWidth, measuredHeight, 2, 2, "F");
        pdf.setFillColor(...AMBER_TEXT);
        pdf.rect(margin, boxTop, 1.5, measuredHeight, "F");

        pdf.setTextColor(...AMBER_TEXT);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("RECOMENDACIONES", margin + 5, y);
        y += 6;
        pdf.setTextColor(...GRAY_BODY);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        allLines.forEach((lines) => {
          pdf.text(lines, margin + 5, y);
          y += lines.length * 4.3 + 2;
        });
        y += 4;
      }

      // Pie de página en todas las hojas
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(...GRAY_BORDER);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        pdf.setTextColor(...GRAY_TEXT);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.text("Generado con ToolBox · toolbox.mx", margin, pageHeight - 7);
        pdf.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
      }

      const safeOrgName = orgName.replace(/[^a-zA-Z0-9]+/g, "-");
      pdf.save(`Reporte-${safeOrgName}-${range.start}-al-${range.end}.pdf`);
    } catch (e) {
      console.error("Error generando PDF:", e);
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

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
        /* ══════════ VISTA PREVIA en pantalla — el PDF real se construye aparte ══════════ */
        <div className="rounded-2xl border border-border bg-background p-10 max-w-3xl">
          <div className="border-b-2 border-[#1A2332] pb-6 mb-8">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="h-14 mb-4 object-contain" />
            ) : (
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-red)] mb-2">
                Reporte de negocio · ToolBox
              </p>
            )}
            <h1 className="text-3xl font-bold text-[#1A2332]">{orgName}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Periodo: {range.start} al {range.end} · Generado el {fechaGeneracion}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">Ventas</p>
              <p className="text-lg font-bold text-[#1A2332]">{formatCurrency(metrics.ventas_totales)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">Pedidos</p>
              <p className="text-lg font-bold text-[#1A2332]">{metrics.pedidos}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">Ticket promedio</p>
              <p className="text-lg font-bold text-[#1A2332]">{formatCurrency(metrics.ticket_promedio)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">Utilidad neta</p>
              <p className={`text-lg font-bold ${finanzas.utilidad >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(finanzas.utilidad)}
              </p>
            </div>
          </div>

          <div className="space-y-7">
            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-border">1. Ventas</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{analisisVentas()}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-border">2. Productos</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{analisisProductos()}</p>
              {topProductos.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">#</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">Producto</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Unidades</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductos.map((p, i) => (
                      <tr key={p.product_id} className="border-b border-border/50">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 text-foreground font-medium">{p.nombre}</td>
                        <td className="py-2 text-right text-muted-foreground">{p.unidades}</td>
                        <td className="py-2 text-right text-foreground font-medium">{formatCurrency(p.total_vendido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-border">3. Inventario</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{analisisInventario()}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#1A2332] mb-2 pb-1 border-b border-border">4. Finanzas</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{analisisFinanzas()}</p>
              {finanzas.tips && finanzas.tips.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs font-semibold text-amber-800 uppercase mb-2">Recomendaciones</p>
                  <ul className="space-y-1.5">
                    {finanzas.tips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground leading-relaxed">• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 pt-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Generado con ToolBox · toolbox.mx</p>
            <p className="text-xs text-muted-foreground">{fechaGeneracion}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
