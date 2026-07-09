import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, Trash2, Pencil, Megaphone, GraduationCap, AtSign, Music2, Radio, Globe, Calculator } from "lucide-react";

interface MarketingProps {
  token: string;
  orgId: number;
}

interface Campana {
  id: number;
  name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  start_date: string | null;
  end_date: string | null;
  notes: string;
}

const PLATFORMS: { key: string; label: string; icon: any; color: string }[] = [
  { key: "instagram", label: "Instagram", icon: AtSign, color: "bg-pink-100 text-pink-700" },
  { key: "tiktok",    label: "TikTok",    icon: Music2,    color: "bg-gray-900 text-white" },
  { key: "facebook",  label: "Facebook",  icon: Radio,  color: "bg-blue-100 text-blue-700" },
  { key: "otro",      label: "Otro",      icon: Globe,     color: "bg-gray-100 text-gray-600" },
];

const IDEAS = [
  {
    nombre: "Flash Sale de 48 horas",
    budget: "$500 – $1,500",
    duracion: "2-3 días",
    plataforma: "Instagram Stories",
    desc: "Descuento agresivo por tiempo limitado. Genera urgencia y mueve inventario estancado. Ideal para productos con stock alto.",
    efectividad: "Alta conversión a corto plazo",
  },
  {
    nombre: "Contenido UGC (clientes reales)",
    budget: "$0 – $500",
    duracion: "Continuo",
    plataforma: "Instagram + TikTok",
    desc: "Pide a tus clientes fotos usando tus productos a cambio de un descuento en su siguiente compra. El contenido real vende más que el producido.",
    efectividad: "Confianza y alcance orgánico",
  },
  {
    nombre: "Colaboración con micro-influencer local",
    budget: "$1,000 – $3,000",
    duracion: "1-2 semanas",
    plataforma: "Instagram",
    desc: "Busca cuentas locales de 5k-30k seguidores con audiencia de mamás jóvenes. Cobran poco y su audiencia confía mucho en ellas.",
    efectividad: "Alcance dirigido de calidad",
  },
  {
    nombre: "Giveaway con condición de compartir",
    budget: "$300 – $800 (el premio)",
    duracion: "1 semana",
    plataforma: "Instagram",
    desc: "Sortea un producto pidiendo seguir + etiquetar 2 amigos + compartir en stories. Multiplica tus seguidores rápido.",
    efectividad: "Crecimiento de audiencia",
  },
  {
    nombre: "Campaña de temporada anticipada",
    budget: "$1,000 – $2,500",
    duracion: "3-4 semanas antes del pico",
    plataforma: "Instagram + Facebook Ads",
    desc: "Arranca tu publicidad de Semana Santa o verano 3-4 semanas antes que tu competencia. El costo por click es más barato y capturas la demanda temprana.",
    efectividad: "Ventaja de temporada",
  },
  {
    nombre: "Retargeting a visitantes",
    budget: "$500 – $1,000",
    duracion: "Continuo",
    plataforma: "Facebook / Instagram Ads",
    desc: "Muestra anuncios solo a quienes ya visitaron tu perfil o interactuaron con tu contenido. Es el público más barato de convertir.",
    efectividad: "Mejor costo por venta",
  },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function Marketing({ token, orgId }: MarketingProps) {
  const [tab, setTab] = useState<"campanas" | "escuela">("campanas");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Campana | null>(null);
  const [form, setForm] = useState({
    name: "", platform: "instagram", status: "activa",
    budget: "", spent: "", reach: "", impressions: "", clicks: "", conversions: "",
    start_date: "", end_date: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [calcBudget, setCalcBudget] = useState("1000");
  const [calcDias, setCalcDias] = useState("7");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchCampanas = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/campanas?org_id=${orgId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCampanas(data.campanas);
    } catch {
      setError("No se pudieron cargar las campañas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampanas(); }, [orgId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", platform: "instagram", status: "activa", budget: "", spent: "", reach: "", impressions: "", clicks: "", conversions: "", start_date: "", end_date: "", notes: "" });
    setSubmitError("");
    setShowModal(true);
  };

  const openEdit = (c: Campana) => {
    setEditing(c);
    setForm({
      name: c.name, platform: c.platform, status: c.status,
      budget: c.budget?.toString() ?? "", spent: c.spent?.toString() ?? "",
      reach: c.reach?.toString() ?? "", impressions: c.impressions?.toString() ?? "",
      clicks: c.clicks?.toString() ?? "", conversions: c.conversions?.toString() ?? "",
      start_date: c.start_date ?? "", end_date: c.end_date ?? "", notes: c.notes ?? "",
    });
    setSubmitError("");
    setShowModal(true);
  };

  const saveCampana = async () => {
    if (!form.name) { setSubmitError("El nombre es obligatorio."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const body: any = {
        name: form.name, platform: form.platform, status: form.status,
        budget: parseFloat(form.budget) || 0, spent: parseFloat(form.spent) || 0,
        reach: parseInt(form.reach) || 0, impressions: parseInt(form.impressions) || 0,
        clicks: parseInt(form.clicks) || 0, conversions: parseInt(form.conversions) || 0,
        start_date: form.start_date || null, end_date: form.end_date || null,
        notes: form.notes,
      };
      const url = editing
        ? `https://toolbox-backend-rkit.onrender.com/api/campanas/${editing.id}`
        : "https://toolbox-backend-rkit.onrender.com/api/campanas/crear";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? body : { ...body, org_id: orgId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setShowModal(false);
      fetchCampanas();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const eliminarCampana = async (id: number) => {
    setCampanas((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/campanas/${id}`, { method: "DELETE", headers });
    } catch { /* silencioso */ }
  };

  const getInsights = (c: Campana) => {
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null;
    const cpc = c.clicks > 0 ? c.spent / c.clicks : null;
    const costConv = c.conversions > 0 ? c.spent / c.conversions : null;
    const convRate = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : null;

    let insight = "";
    if (ctr !== null) {
      if (ctr >= 2) insight = `CTR de ${ctr.toFixed(1)}% — excelente, tu creativo está conectando con la audiencia.`;
      else if (ctr >= 1) insight = `CTR de ${ctr.toFixed(1)}% — dentro del promedio. Prueba variar el texto o la primera imagen.`;
      else insight = `CTR de ${ctr.toFixed(1)}% — bajo. El anuncio no está llamando la atención; cambia el creativo o el público.`;
    } else if (c.spent > 0) {
      insight = "Registra impresiones y clicks para que pueda interpretar el rendimiento.";
    }

    return { ctr, cpc, costConv, convRate, insight };
  };

  const budget = parseFloat(calcBudget) || 0;
  const dias = parseInt(calcDias) || 1;
  const impresionesEst = Math.round((budget / 60) * 1000);
  const alcanceEst = Math.round(impresionesEst * 0.6);
  const clicksEst = Math.round(impresionesEst * 0.012);
  const ventasEst = Math.max(1, Math.round(clicksEst * 0.02));

  const getPlatform = (key: string) => PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[3];

  return (
    <div>
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Campañas, resultados e ideas para crecer</p>
        </div>
        {tab === "campanas" && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Nueva campaña
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-8">
        <button onClick={() => setTab("campanas")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "campanas" ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
          }`}>
          <Megaphone size={14} />
          Mis campañas
        </button>
        <button onClick={() => setTab("escuela")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "escuela" ? "bg-[var(--brand-red)] text-white" : "border border-border text-muted-foreground hover:bg-muted"
          }`}>
          <GraduationCap size={14} />
          Escuela de campañas
        </button>
      </div>

      {error && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">{error}</div>}

      {/* TAB: Campañas */}
      {tab === "campanas" && (
        loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-6 animate-pulse">
                <div className="h-4 w-40 bg-muted rounded mb-4" />
                <div className="h-3 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : campanas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Megaphone size={32} className="text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Aún no registras campañas. Cuando corras publicidad en Instagram o TikTok, captura aquí los resultados que te da la plataforma para interpretarlos.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campanas.map((c) => {
              const plat = getPlatform(c.platform);
              const PlatIcon = plat.icon;
              const { ctr, cpc, costConv, convRate, insight } = getInsights(c);
              const budgetPct = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0;

              return (
                <div key={c.id} className="rounded-2xl border border-border bg-background p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${plat.color}`}>
                        <PlatIcon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.name}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                          c.status === "activa" ? "bg-emerald-100 text-emerald-700" :
                          c.status === "pausada" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => eliminarCampana(c.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Gastado</span>
                      <span className="text-xs font-medium text-foreground">
                        {formatCurrency(c.spent)} de {formatCurrency(c.budget)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${budgetPct >= 95 ? "bg-red-400" : "bg-[var(--brand-red)]"}`}
                        style={{ width: `${budgetPct}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{fmtNum(c.reach)}</p>
                      <p className="text-[10px] text-muted-foreground">Alcance</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{fmtNum(c.impressions)}</p>
                      <p className="text-[10px] text-muted-foreground">Impresiones</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{fmtNum(c.clicks)}</p>
                      <p className="text-[10px] text-muted-foreground">Clicks</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{c.conversions}</p>
                      <p className="text-[10px] text-muted-foreground">Ventas</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
                    {ctr !== null && <span>CTR: <b className="text-foreground">{ctr.toFixed(1)}%</b></span>}
                    {cpc !== null && <span>Costo/click: <b className="text-foreground">{formatCurrency(cpc)}</b></span>}
                    {convRate !== null && <span>Conversión: <b className="text-foreground">{convRate.toFixed(1)}%</b></span>}
                    {costConv !== null && <span>Costo/venta: <b className="text-foreground">{formatCurrency(costConv)}</b></span>}
                  </div>

                  {insight && (
                    <p className="text-xs text-foreground bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      💡 {insight}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB: Escuela */}
      {tab === "escuela" && (
        <>
          <div className="rounded-2xl border border-border bg-background p-6 mb-8">
            <div className="flex items-center gap-2 mb-5">
              <Calculator size={15} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Estima el resultado de tu inversión</h3>
            </div>
            <div className="flex flex-wrap gap-4 items-end mb-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Presupuesto (MXN)</label>
                <input type="number" value={calcBudget} onChange={(e) => setCalcBudget(e.target.value)}
                  className="w-36 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Duración (días)</label>
                <input type="number" value={calcDias} onChange={(e) => setCalcDias(e.target.value)}
                  className="w-28 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <p className="text-lg font-bold text-foreground">~{fmtNum(alcanceEst)}</p>
                <p className="text-xs text-muted-foreground">personas alcanzadas</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <p className="text-lg font-bold text-foreground">~{fmtNum(impresionesEst)}</p>
                <p className="text-xs text-muted-foreground">impresiones</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <p className="text-lg font-bold text-foreground">~{fmtNum(clicksEst)}</p>
                <p className="text-xs text-muted-foreground">clicks estimados</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center">
                <p className="text-lg font-bold text-foreground">~{ventasEst}</p>
                <p className="text-xs text-muted-foreground">ventas potenciales</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4">
              Estimación basada en promedios de anuncios en México (CPM ~$60 MXN, CTR 1.2%, conversión 2%).
              Con {formatCurrency(budget)} en {dias} días gastarías ~{formatCurrency(budget / dias)} diarios.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {IDEAS.map((idea, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-6">
                <p className="text-sm font-semibold text-foreground mb-2">{idea.nombre}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{idea.desc}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">{idea.budget}</span>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{idea.duracion}</span>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">{idea.plataforma}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">✓ {idea.efectividad}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal crear/editar campaña */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{editing ? "Editar campaña" : "Nueva campaña"}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre *</label>
                <input type="text" placeholder="Promo verano trajes de baño" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Plataforma</label>
                  <div className="relative">
                    <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Estado</label>
                  <div className="relative">
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]">
                      <option value="activa">Activa</option>
                      <option value="pausada">Pausada</option>
                      <option value="terminada">Terminada</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Presupuesto</label>
                  <input type="number" placeholder="0" value={form.budget}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Gastado</label>
                  <input type="number" placeholder="0" value={form.spent}
                    onChange={(e) => setForm((f) => ({ ...f, spent: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                Datos de la plataforma (Instagram / TikTok te los da)
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Alcance</label>
                  <input type="number" placeholder="0" value={form.reach}
                    onChange={(e) => setForm((f) => ({ ...f, reach: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Impresiones</label>
                  <input type="number" placeholder="0" value={form.impressions}
                    onChange={(e) => setForm((f) => ({ ...f, impressions: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Clicks</label>
                  <input type="number" placeholder="0" value={form.clicks}
                    onChange={(e) => setForm((f) => ({ ...f, clicks: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Ventas generadas</label>
                  <input type="number" placeholder="0" value={form.conversions}
                    onChange={(e) => setForm((f) => ({ ...f, conversions: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Inicio</label>
                  <input type="date" value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Fin</label>
                  <input type="date" value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]" />
                </div>
              </div>

              {submitError && <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">{submitError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={saveCampana} disabled={submitting}
                className="px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear campaña"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
