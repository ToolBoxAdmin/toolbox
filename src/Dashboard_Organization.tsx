import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Boxes, Loader, Rocket, BookOpen, User,
  ShoppingCart, Megaphone, BarChart3, DollarSign,
  Plug, Plus, ChevronLeft, ChevronRight, Bell, Trash2, Check, RefreshCw, Lock,
} from "lucide-react";

import DashboardHome from "./pages/DashboardHome";
import Ventas from "./pages/Ventas";
import Productos from "./pages/Productos";
import Inventario from "./pages/Inventario";
import WorkInProgress from "./pages/WorkInProgress";
import DashboardEmployee from "./pages/DashboardEmployee";
import AgregarHerramienta from "./pages/AgregarHerramienta";
import Clientes from "./pages/Clientes";
import Pedidos from "./pages/Pedidos";
import Marketing from "./pages/Marketing";
import Reportes from "./pages/Reportes";
import Finanzas from "./pages/Finanzas";
import MiPerfil from "./pages/MiPerfil";

type Section =
  | "dashboard" | "ventas" | "productos" | "inventario"
  | "clientes" | "pedidos" | "marketing" | "reportes"
  | "finanzas" | "integraciones" | "perfil";

interface Notif {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const TOOLS: { id: Section; name: string; icon: any }[] = [
  { id: "dashboard",      name: "Dashboard",      icon: Boxes },
  { id: "ventas",         name: "Ventas",          icon: Rocket },
  { id: "productos",      name: "Productos",       icon: BookOpen },
  { id: "inventario",     name: "Inventario",      icon: Boxes },
  { id: "clientes",       name: "Clientes",        icon: User },
  { id: "pedidos",        name: "Pedidos",         icon: ShoppingCart },
  { id: "marketing",      name: "Marketing",       icon: Megaphone },
  { id: "reportes",       name: "Reportes",        icon: BarChart3 },
  { id: "finanzas",       name: "Finanzas",        icon: DollarSign },
  { id: "integraciones",  name: "Integraciones",   icon: Plug },
];

// Secciones que aún no construimos
const WIP_SECTIONS: Section[] = ["integraciones"];

// Lo que puede ver un empleado
const EMPLOYEE_SECTIONS: Section[] = ["dashboard", "ventas", "productos", "inventario", "pedidos"];

const NOTIF_COLORS: Record<string, string> = {
  stock_bajo: "bg-amber-400",
  sin_ventas: "bg-red-400",
  pedido_atorado: "bg-amber-400",
  pedido_entregado: "bg-emerald-400",
  pedido_devuelto: "bg-red-400",
};

// Herramientas que se activan/desactivan desde el marketplace
const GATED_SECTIONS: Section[] = [
  "ventas", "productos", "inventario", "clientes", "pedidos", "marketing", "reportes", "finanzas",
];

function ToolLocked({ name, onOpenMarketplace }: { name: string; onOpenMarketplace: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--tile-red)] flex items-center justify-center mb-6">
        <Lock size={26} className="text-[var(--brand-red)]" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{name} no está activa</h2>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        Esta herramienta no forma parte de tu plan actual. Actívala desde el marketplace para volver a usarla.
      </p>
      <button
        onClick={onOpenMarketplace}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Ver herramientas disponibles
      </button>
    </div>
  );
}

export default function Dashboard_Organization() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");

  // Herramientas activas de la org (null = aún no cargado → mostrar todas)
  const [activeTools, setActiveTools] = useState<string[] | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);

  // Notificaciones
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const token = localStorage.getItem("token") ?? "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");

    if (!token || (role !== "owner" && role !== "employee")) {
      navigate("/login");
      return;
    }

    setUser({ username, role, token });

    const fetchOrg = async () => {
      try {
        const res = await fetch(
          "https://toolbox-backend-rkit.onrender.com/api/dashboard-org",
          { headers }
        );
        if (!res.ok) { localStorage.clear(); navigate("/login"); return; }
        const data = await res.json();
        setOrgData(data);
      } catch {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [navigate]);

  // Herramientas activas
  const fetchOrgTools = useCallback(async (orgId: number) => {
    try {
      const res = await fetch(
        `https://toolbox-backend-rkit.onrender.com/api/org-tools?org_id=${orgId}`,
        { headers }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.active_keys) && data.active_keys.length > 0) {
        setActiveTools(data.active_keys);
      }
    } catch {
      // Fail-open: si falla, mostramos todas
    }
  }, [token]);

  // Notificaciones
  const fetchNotifications = useCallback(async (orgId: number) => {
    try {
      const res = await fetch(
        `https://toolbox-backend-rkit.onrender.com/api/notifications?org_id=${orgId}`,
        { headers }
      );
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // silencioso
    }
  }, [token]);

  useEffect(() => {
    if (!orgData?.org_id) return;
    fetchOrgTools(orgData.org_id);
    fetchNotifications(orgData.org_id);
    const interval = setInterval(() => fetchNotifications(orgData.org_id), 60000);
    return () => clearInterval(interval);
  }, [orgData, fetchOrgTools, fetchNotifications]);

  const markRead = async (id: number) => {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/notifications/${id}/read`, {
        method: "POST", headers,
      });
    } catch { /* silencioso */ }
  };

  const markAllRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch("https://toolbox-backend-rkit.onrender.com/api/notifications/read-all", {
        method: "POST", headers, body: JSON.stringify({ org_id: orgData.org_id }),
      });
    } catch { /* silencioso */ }
  };

  const deleteNotif = async (id: number, wasUnread: boolean) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`https://toolbox-backend-rkit.onrender.com/api/notifications/${id}`, {
        method: "DELETE", headers,
      });
    } catch { /* silencioso */ }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  // Cierre de sesión por inactividad — configurado por el dueño en Mi Perfil
  useEffect(() => {
    if (!orgData?.org_id) return;
    (async () => {
      try {
        const res = await fetch(
          `https://toolbox-backend-rkit.onrender.com/api/perfil?org_id=${orgData.org_id}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setTimeoutMinutes(data.org?.inactivity_timeout_minutes ?? 0);
        }
      } catch { /* silencioso — sin timeout si falla */ }
    })();
  }, [orgData?.org_id]);

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const markActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, markActivity));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= timeoutMinutes * 60 * 1000) {
        clearInterval(interval);
        handleLogout();
      }
    }, 30000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
      clearInterval(interval);
    };
  }, [timeoutMinutes]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // En vez de recargar toda la página (lo que te regresaba al Dashboard
    // porque la sección no vive en la URL), incrementamos refreshToken.
    // Se lo pasamos como `key` a la sección activa, así React la desmonta
    // y la vuelve a montar — eso dispara su fetch interno de datos frescos
    // sin sacarte de donde estabas.
    setRefreshToken((k) => k + 1);
    if (orgData?.org_id) {
      fetchOrgTools(orgData.org_id);
      fetchNotifications(orgData.org_id);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="animate-spin text-[var(--brand-red)]" size={32} />
      </div>
    );
  }

  const role = user?.role ?? "owner";
  const sidebarWidth = sidebarOpen ? "w-64" : "w-16";
  const mainMargin   = sidebarOpen ? "ml-64" : "ml-16";

  // Nombre real del usuario logueado
  const currentFullName =
    orgData?.users?.find((u: any) => u.username === user?.username)?.full_name ?? user?.username;

  const sectionTitles: Record<Section, string> = {
    dashboard:     `Bienvenido, ${currentFullName}`,
    ventas:        "Ventas",
    productos:     "Productos",
    inventario:    "Inventario",
    clientes:      "Clientes",
    pedidos:       "Pedidos",
    marketing:     "Marketing",
    reportes:      "Reportes",
    finanzas:      "Finanzas",
    integraciones: "Integraciones",
    perfil:        "Mi perfil",
  };

  // Sidebar filtrado por herramientas activas y rol
  const visibleTools = TOOLS.filter((t) => {
    if (t.id === "dashboard") return true;
    if (role === "employee" && !EMPLOYEE_SECTIONS.includes(t.id)) return false;
    if (activeTools !== null && !activeTools.includes(t.id)) return false;
    return true;
  });

  const formatNotifDate = (str: string) =>
    new Date(str).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate("/")}
            title="Ir al sitio principal"
            className="cursor-pointer transition-opacity hover:opacity-80"
          >
            <img src="/Logo Transparente.png" alt="ToolBox" style={{ height: "auto", width: "140px" }} />
          </button>

          <div className="flex items-center gap-3">

            {/* Refrescar datos */}
            <button
              onClick={handleRefresh}
              title="Actualizar datos"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>

            {/* Campana de notificaciones */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs((s) => !s)}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-red)] px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <>
                  {/* Capa para cerrar al hacer click fuera */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />

                  <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">Notificaciones</p>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-[var(--brand-red)] font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <Check size={11} /> Marcar todas
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                          Sin notificaciones por ahora.
                        </p>
                      ) : (
                        notifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => !n.read && markRead(n.id)}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors ${
                              n.read ? "opacity-60" : "bg-muted/30 hover:bg-muted/50"
                            }`}
                          >
                            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${NOTIF_COLORS[n.type] ?? "bg-gray-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-tight ${n.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                                {n.title}
                              </p>
                              {n.message && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">{formatNotifDate(n.created_at)}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteNotif(n.id, !n.read); }}
                              className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <span className="text-sm text-muted-foreground hidden sm:block">{user?.username}</span>
            <button onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <div className={`fixed left-0 top-16 ${sidebarWidth} h-[calc(100vh-64px)] border-r border-border bg-background transition-all duration-300 ease-in-out z-30`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors">
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        <div className="h-full overflow-y-auto p-3 flex flex-col">
          {sidebarOpen && (
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-4 px-2 tracking-wider">
              Herramientas
            </h3>
          )}

          <nav className="space-y-0.5">
            {visibleTools.map((tool) => {
              const Icon = tool.icon;
              const active = section === tool.id;
              return (
                <button key={tool.id} title={!sidebarOpen ? tool.name : undefined}
                  onClick={() => setSection(tool.id)}
                  className={`w-full text-left rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                    sidebarOpen ? "px-4 py-2.5" : "px-0 py-2.5 justify-center"
                  } ${active
                    ? "bg-[var(--tile-red)] text-[var(--brand-red)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && tool.name}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border pt-3 space-y-0.5">
            {role === "owner" && (
              <button title={!sidebarOpen ? "Agregar herramienta" : undefined}
                onClick={() => setShowMarketplace(true)}
                className={`w-full text-left rounded-lg text-sm font-medium text-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors flex items-center gap-3 ${
                  sidebarOpen ? "px-4 py-2.5" : "px-0 py-2.5 justify-center"
                }`}>
                <Plus size={18} className="shrink-0" />
                {sidebarOpen && "Agregar herramienta"}
              </button>
            )}
            <button title={!sidebarOpen ? "Mi perfil" : undefined}
              onClick={() => setSection("perfil")}
              className={`w-full text-left rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                sidebarOpen ? "px-4 py-2.5" : "px-0 py-2.5 justify-center"
              } ${section === "perfil"
                ? "bg-[var(--tile-red)] text-[var(--brand-red)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <User size={18} className="shrink-0" />
              {sidebarOpen && "Mi perfil"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={`${mainMargin} transition-all duration-300 ease-in-out`}>
        <div className="px-6 py-8 max-w-7xl mx-auto">

          {section !== "dashboard" && (
            <div className="mb-8">
              <button onClick={() => setSection("dashboard")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </button>
              <span className="text-xs text-muted-foreground mx-1.5">/</span>
              <span className="text-xs text-foreground font-medium">{sectionTitles[section]}</span>
            </div>
          )}

          {section === "dashboard" && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">{sectionTitles["dashboard"]}</h1>
              <p className="mt-1.5 text-muted-foreground text-sm">
                {role === "employee" ? "Panel de operación" : "Panel de administración"} · {orgData?.org_name}
              </p>
            </div>
          )}

          {/* Router de secciones */}
          {section === "dashboard" && user?.token && orgData && (
            role === "employee" ? (
              <DashboardEmployee
                key={refreshToken}
                token={user.token}
                orgId={orgData.org_id}
                fullName={currentFullName}
                onGoVentas={() => setSection("ventas")}
              />
            ) : (
              <DashboardHome key={refreshToken} token={user.token} orgId={orgData.org_id} />
            )
          )}

          {GATED_SECTIONS.includes(section) && activeTools !== null && !activeTools.includes(section) ? (
            <ToolLocked name={sectionTitles[section]} onOpenMarketplace={() => setShowMarketplace(true)} />
          ) : (
            <>
              {section === "ventas" && user?.token && orgData && (
                <Ventas key={refreshToken} token={user.token} orgId={orgData.org_id} onGoPedidos={() => setSection("pedidos")} />
              )}
              {section === "productos" && user?.token && orgData && (
                <Productos key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
              {section === "inventario" && user?.token && orgData && (
                <Inventario key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
              {section === "clientes" && user?.token && orgData && (
                <Clientes key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
              {section === "pedidos" && user?.token && orgData && (
                <Pedidos key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
              {section === "marketing" && user?.token && orgData && (
                <Marketing key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
              {section === "reportes" && user?.token && orgData && (
                <Reportes key={refreshToken} token={user.token} orgId={orgData.org_id} orgName={orgData.org_name} />
              )}
              {section === "finanzas" && user?.token && orgData && (
                <Finanzas key={refreshToken} token={user.token} orgId={orgData.org_id} />
              )}
            </>
          )}

          {section === "perfil" && user?.token && orgData && (
            <MiPerfil key={refreshToken} token={user.token} orgId={orgData.org_id} role={role} />
          )}
          {WIP_SECTIONS.includes(section) && (
            <WorkInProgress section={sectionTitles[section]} />
          )}
        </div>
      </main>

      {/* Marketplace de herramientas */}
      {showMarketplace && user?.token && orgData && (
        <AgregarHerramienta
          token={user.token}
          orgId={orgData.org_id}
          onClose={() => setShowMarketplace(false)}
          onActivated={() => fetchOrgTools(orgData.org_id)}
        />
      )}
    </div>
  );
}
