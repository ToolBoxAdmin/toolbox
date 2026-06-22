import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Boxes, Loader, Rocket, BookOpen, User,
  ShoppingCart, Megaphone, BarChart3, DollarSign,
  Plug, Plus, ChevronLeft, ChevronRight,
} from "lucide-react";

import DashboardHome from "./pages/DashboardHome";
import Ventas from "./pages/Ventas";
import Productos from "./pages/Productos";
import WorkInProgress from "./pages/WorkInProgress";

type Section =
  | "dashboard" | "ventas" | "productos" | "inventario"
  | "clientes" | "pedidos" | "marketing" | "reportes"
  | "finanzas" | "integraciones";

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

const WIP_SECTIONS: Section[] = [
  "inventario", "clientes", "pedidos", "marketing",
  "reportes", "finanzas", "integraciones",
];

export default function Dashboard_Organization() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");

    if (!token || role !== "owner") {
      navigate("/login");
      return;
    }

    setUser({ username, role, token });

    const fetchOrg = async () => {
      try {
        const res = await fetch(
          "https://toolbox-backend-rkit.onrender.com/api/dashboard-org",
          { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
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

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="animate-spin text-[var(--brand-red)]" size={32} />
      </div>
    );
  }

  const sidebarWidth = sidebarOpen ? "w-64" : "w-16";
  const mainMargin   = sidebarOpen ? "ml-64" : "ml-16";

  const sectionTitles: Record<Section, string> = {
    dashboard:     `Bienvenido, ${orgData?.org_name ?? user?.username}`,
    ventas:        "Ventas",
    productos:     "Productos",
    inventario:    "Inventario",
    clientes:      "Clientes",
    pedidos:       "Pedidos",
    marketing:     "Marketing",
    reportes:      "Reportes",
    finanzas:      "Finanzas",
    integraciones: "Integraciones",
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src="/Logo Transparente.png" alt="ToolBox" style={{ height: "auto", width: "140px" }} />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.username}</span>
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
            {TOOLS.map((tool) => {
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
            <button title={!sidebarOpen ? "Agregar herramienta" : undefined}
              className={`w-full text-left rounded-lg text-sm font-medium text-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors flex items-center gap-3 ${
                sidebarOpen ? "px-4 py-2.5" : "px-0 py-2.5 justify-center"
              }`}>
              <Plus size={18} className="shrink-0" />
              {sidebarOpen && "Agregar herramienta"}
            </button>
            <button title={!sidebarOpen ? "Mi perfil" : undefined}
              className={`w-full text-left rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-3 ${
                sidebarOpen ? "px-4 py-2.5" : "px-0 py-2.5 justify-center"
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
              <p className="mt-1.5 text-muted-foreground text-sm">Panel de administración · {orgData?.org_name}</p>
            </div>
          )}

          {section === "dashboard" && user?.token && orgData && (
            <DashboardHome token={user.token} orgId={orgData.org_id} />
          )}
          {section === "ventas" && user?.token && orgData && (
            <Ventas token={user.token} orgId={orgData.org_id} />
          )}
          {section === "productos" && user?.token && orgData && (
            <Productos token={user.token} orgId={orgData.org_id} />
          )}
          {WIP_SECTIONS.includes(section) && (
            <WorkInProgress section={sectionTitles[section]} />
          )}
        </div>
      </main>
    </div>
  );
}
