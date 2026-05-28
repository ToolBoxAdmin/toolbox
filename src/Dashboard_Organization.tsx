import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
    LogOut,
    Boxes,
    Loader,
    Rocket,
    BookOpen,
    User,
    ShoppingCart,
    Megaphone,
    BarChart3,
    DollarSign,
    Plug,
    Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

export default function Dashboard_Organization() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");

    // Si no hay token o no es owner, redirige a login
    if (!token || role !== "owner") {
      navigate("/login");
      return;
    }

    setUser({ email, role });

    // Fetch dashboard data
    const fetchDashboard = async () => {
      try {
        const response = await fetch(
          "https://toolbox-backend-rkit.onrender.com/api/dashboard-org",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          setError("No autorizado");
          localStorage.clear();
          navigate("/login");
          return;
        }

        const dashData = await response.json();
        setData(dashData);
      } catch (err) {
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="animate-spin text-[var(--brand-red)]" size={32} />
      </div>
    );
  }

  // Mock data para gráficos (mientras no tengamos datos reales)
  const ventasData = [
    { mes: "Ene", ventas: 4000, anterior: 2400 },
    { mes: "Feb", ventas: 3000, anterior: 1398 },
    { mes: "Mar", ventas: 2000, anterior: 9800 },
    { mes: "Abr", ventas: 2780, anterior: 3908 },
    { mes: "May", ventas: 1890, anterior: 4800 },
    { mes: "Jun", ventas: 2390, anterior: 3800 },
  ];

  const canalData = [
    { name: "Tienda online", value: 45 },
    { name: "Marketplace", value: 25 },
    { name: "Tienda física", value: 15 },
    { name: "Redes sociales", value: 10 },
    { name: "Otros", value: 5 },
  ];

  const inventarioData = [
    { name: "En stock", value: 128 },
    { name: "Stock bajo", value: 23 },
    { name: "Agotados", value: 7 },
  ];

  const productos = [
    { id: 1, nombre: "Producto A", ventas: 8250 },
    { id: 2, nombre: "Producto B", ventas: 6120 },
    { id: 3, nombre: "Producto C", ventas: 4890 },
    { id: 4, nombre: "Producto D", ventas: 3450 },
    { id: 5, nombre: "Producto E", ventas: 2980 },
  ];

  const COLORS = [
    "var(--brand-red)",
    "#0066CC",
    "#00CC88",
    "#FFAA00",
    "#CC00CC",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <img
            src="/Logo Transparente.png"
            alt="ToolBox Logo"
            style={{ height: "auto", width: "150px" }}
          />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
        <div className="fixed left-0 top-16 w-64 h-[calc(100vh-64px)] border-r border-border bg-background overflow-y-auto">
        <div className="p-6 flex flex-col h-full">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-4">Herramientas</h3>
            <nav className="space-y-2">
            {[
                { name: "Dashboard", icon: Boxes },
                { name: "Ventas", icon: Rocket },
                { name: "Productos", icon: BookOpen },
                { name: "Inventario", icon: Boxes },
                { name: "Clientes", icon: User },
                { name: "Pedidos", icon: ShoppingCart },
                { name: "Marketing", icon: Megaphone },
                { name: "Reportes", icon: BarChart3 },
                { name: "Finanzas", icon: DollarSign },
                { name: "Integraciones", icon: Plug },

            ].map((tool) => {
            const IconComponent = tool.icon;
            return (
                <button
                key={tool.name}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-3"
                >
                <IconComponent size={18} />
                {tool.name}
                </button>
            );
            })}
            </nav>
            <div className="mt-auto space-y-2 border-t border-border pt-4">
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--brand-red)] hover:bg-[var(--tile-red)] transition-colors flex items-center gap-3">
                <Plus size={18} />
                Agregar herramienta
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-3">
                <User size={18} />
                Mi perfil
            </button>
            </div>
        </div>
        </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground">
            Bienvenida, Alexandra
          </h1>
          <p className="mt-2 text-muted-foreground">
            Panel de administración de {data?.org_name}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">
            {error}
          </div>
        )}

        {/* Métricas principales */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-12">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Ventas totales</p>
            <p className="text-3xl font-bold text-foreground">$48,250.00</p>
            <p className="text-xs text-green-600 mt-2">↑ 12.5% vs semana anterior</p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Pedidos</p>
            <p className="text-3xl font-bold text-foreground">342</p>
            <p className="text-xs text-green-600 mt-2">↑ 8.1% vs semana anterior</p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Clientes nuevos</p>
            <p className="text-3xl font-bold text-foreground">28</p>
            <p className="text-xs text-green-600 mt-2">↑ 16.3% vs semana anterior</p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Ticket promedio</p>
            <p className="text-3xl font-bold text-foreground">$141.37</p>
            <p className="text-xs text-green-600 mt-2">↑ 5.4% vs semana anterior</p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Utilidad neta</p>
            <p className="text-3xl font-bold text-foreground">$12,780.50</p>
            <p className="text-xs text-green-600 mt-2">↑ 10.2% vs semana anterior</p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 mb-12 lg:grid-cols-3">
          {/* Ventas */}
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-semibold text-foreground mb-6">Ventas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ventasData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)" }} />
                <Legend />
                <Line type="monotone" dataKey="ventas" stroke="var(--brand-red)" strokeWidth={2} />
                <Line type="monotone" dataKey="anterior" stroke="#0066CC" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Inventario */}
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Inventario</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={inventarioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {inventarioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 text-sm">
              {inventarioData.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ventas por canal y Productos */}
        <div className="grid gap-6 lg:grid-cols-2 mb-12">
          {/* Ventas por canal */}
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Ventas por canal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={canalData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label
                >
                  {canalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top productos */}
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Top productos</h3>
            <div className="space-y-3">
              {productos.map((prod, i) => (
                <div key={prod.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{prod.nombre}</span>
                      <span className="text-sm text-muted-foreground">${prod.ventas}</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2">
                      <div
                        className="bg-[var(--brand-red)] h-2 rounded-full"
                        style={{ width: `${(prod.ventas / 8250) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        {data?.users && (
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Equipo ({data.total_users} miembros)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.users.map((usr: any) => (
                    <tr key={usr.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {usr.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {usr.role === "owner" ? "Dueño" : "Empleado"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                          Activo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}