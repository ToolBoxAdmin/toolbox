import { useEffect, useState } from "react";
import {
  X, Rocket, BookOpen, Boxes, User, ShoppingCart,
  Megaphone, BarChart3, DollarSign, Plug, Check, Loader, Clock, Undo2,
} from "lucide-react";

interface AgregarHerramientaProps {
  token: string;
  orgId: number;
  onClose: () => void;
  onActivated: () => void;
}

type ToolStatus = "incluida" | "activa" | "pendiente_baja" | "disponible";

interface ToolDetail {
  key: string;
  name: string;
  description: string;
  monthly_price: number;
  status: ToolStatus;
  activated_at: string | null;
  cancel_at: string | null;
}

const TOOL_ICONS: Record<string, any> = {
  ventas: Rocket,
  productos: BookOpen,
  inventario: Boxes,
  clientes: User,
  pedidos: ShoppingCart,
  marketing: Megaphone,
  reportes: BarChart3,
  finanzas: DollarSign,
  integraciones: Plug,
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
}

function formatDate(str: string | null) {
  if (!str) return "";
  return new Date(str + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AgregarHerramienta({ token, orgId, onClose, onActivated }: AgregarHerramientaProps) {
  const [tools, setTools] = useState<ToolDetail[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const fetchGestion = async () => {
    try {
      const res = await fetch(`https://toolbox-backend-rkit.onrender.com/api/org-tools/gestion?org_id=${orgId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTools(data.tools ?? []);
      setTotalMonthly(data.total_monthly ?? 0);
    } catch {
      setError("No se pudieron cargar las herramientas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGestion(); }, [orgId]);

  const activar = async (key: string) => {
    setWorking(key);
    setError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/org-tools/activar", {
        method: "POST", headers,
        body: JSON.stringify({ org_id: orgId, tool_key: key }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al activar");
      }
      await fetchGestion();
      onActivated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  };

  const desactivar = async (key: string) => {
    setWorking(key);
    setError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/org-tools/desactivar", {
        method: "POST", headers,
        body: JSON.stringify({ org_id: orgId, tool_key: key }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al desactivar");
      }
      await fetchGestion();
      onActivated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background rounded-2xl border border-border shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Marketplace de herramientas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Activa o desactiva las herramientas que tu negocio necesita
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Grid de herramientas — scrolleable */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-4">{error}</div>
          )}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 animate-pulse">
                  <div className="h-9 w-9 bg-muted rounded-lg mb-3" />
                  <div className="h-4 w-24 bg-muted rounded mb-2" />
                  <div className="h-3 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tools.map((tool) => {
                const Icon = TOOL_ICONS[tool.key] ?? Boxes;
                const isWorking = working === tool.key;

                return (
                  <div key={tool.key} className="rounded-xl border border-border p-4 flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--tile-red)] flex items-center justify-center">
                        <Icon size={17} className="text-[var(--brand-red)]" />
                      </div>
                      {tool.status === "incluida" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Check size={11} /> Incluida
                        </span>
                      )}
                      {tool.status === "activa" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <Check size={11} /> Activa
                        </span>
                      )}
                      {tool.status === "pendiente_baja" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Clock size={11} /> Se da de baja
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-foreground mb-1">{tool.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{tool.description}</p>

                    {tool.status === "disponible" && (
                      <button
                        onClick={() => activar(tool.key)}
                        disabled={isWorking}
                        className="mt-3 w-full px-3 py-2 bg-[var(--brand-red)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {isWorking ? <Loader size={12} className="animate-spin" /> : <>Activar — {formatCurrency(tool.monthly_price)}/mes</>}
                      </button>
                    )}

                    {tool.status === "incluida" && (
                      <p className="mt-3 text-xs text-muted-foreground text-center py-2">
                        Parte de tu plan base
                      </p>
                    )}

                    {tool.status === "activa" && (
                      <button
                        onClick={() => desactivar(tool.key)}
                        disabled={isWorking}
                        className="mt-3 w-full px-3 py-2 border border-border text-muted-foreground rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {isWorking ? <Loader size={12} className="animate-spin" /> : `Desactivar · ${formatCurrency(tool.monthly_price)}/mes`}
                      </button>
                    )}

                    {tool.status === "pendiente_baja" && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] text-amber-700 text-center leading-snug">
                          Pierdes acceso el {formatDate(tool.cancel_at)}
                        </p>
                        <button
                          onClick={() => activar(tool.key)}
                          disabled={isWorking}
                          className="w-full px-3 py-2 border border-border text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          {isWorking ? <Loader size={12} className="animate-spin" /> : <><Undo2 size={12} /> Cancelar baja</>}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer con total en vivo */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Al quitar una herramienta conservas acceso hasta el fin de tu ciclo de 30 días.
          </p>
          <div className="text-right shrink-0 ml-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total mensual</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(totalMonthly)}/mes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
