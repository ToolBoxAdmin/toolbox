import { useEffect, useState } from "react";
import {
  X, Rocket, BookOpen, Boxes, User, ShoppingCart,
  Megaphone, BarChart3, DollarSign, Plug, Check, Loader,
} from "lucide-react";

interface AgregarHerramientaProps {
  token: string;
  orgId: number;
  onClose: () => void;
  onActivated: () => void;
}

interface Tool {
  id: number;
  key: string;
  name: string;
  description: string;
  monthly_price: number;
}

interface OrgToolDetail {
  key: string;
  included_in_plan: boolean;
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

export default function AgregarHerramienta({ token, orgId, onClose, onActivated }: AgregarHerramientaProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [orgTools, setOrgTools] = useState<OrgToolDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toolsRes, orgToolsRes] = await Promise.all([
          fetch("https://toolbox-backend-rkit.onrender.com/api/tools", { headers }),
          fetch(`https://toolbox-backend-rkit.onrender.com/api/org-tools?org_id=${orgId}`, { headers }),
        ]);
        const toolsData = await toolsRes.json();
        const orgToolsData = await orgToolsRes.json();
        setTools(toolsData.tools ?? []);
        setOrgTools(orgToolsData.detail ?? []);
      } catch {
        setError("No se pudieron cargar las herramientas.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orgId]);

  const getStatus = (key: string): "incluida" | "activa" | "disponible" => {
    const found = orgTools.find((t) => t.key === key);
    if (!found) return "disponible";
    return found.included_in_plan ? "incluida" : "activa";
  };

  const activar = async (tool: Tool) => {
    setActivating(tool.key);
    setError("");
    try {
      const res = await fetch("https://toolbox-backend-rkit.onrender.com/api/org-tools/activar", {
        method: "POST",
        headers,
        body: JSON.stringify({ org_id: orgId, tool_key: tool.key }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al activar");
      }
      setOrgTools((prev) => [...prev, { key: tool.key, included_in_plan: false }]);
      onActivated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivating(null);
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
              Activa las herramientas que tu negocio necesita
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
                const status = getStatus(tool.key);
                const isActivating = activating === tool.key;

                return (
                  <div key={tool.key} className="rounded-xl border border-border p-4 flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--tile-red)] flex items-center justify-center">
                        <Icon size={17} className="text-[var(--brand-red)]" />
                      </div>
                      {status === "incluida" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Check size={11} /> Incluida
                        </span>
                      )}
                      {status === "activa" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <Check size={11} /> Activa
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-foreground mb-1">{tool.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{tool.description}</p>

                    {status === "disponible" && (
                      <button
                        onClick={() => activar(tool)}
                        disabled={isActivating}
                        className="mt-3 w-full px-3 py-2 bg-[var(--brand-red)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {isActivating ? (
                          <Loader size={12} className="animate-spin" />
                        ) : (
                          <>Activar — {formatCurrency(tool.monthly_price)}/mes</>
                        )}
                      </button>
                    )}
                    {status !== "disponible" && (
                      <p className="mt-3 text-xs text-muted-foreground text-center py-2">
                        {status === "incluida" ? "Parte de tu plan base" : `${formatCurrency(tool.monthly_price)}/mes`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Las herramientas adicionales se agregan a tu mensualidad. Tu plan incluye 2 herramientas base.
          </p>
        </div>
      </div>
    </div>
  );
}
