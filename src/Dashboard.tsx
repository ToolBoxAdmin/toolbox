import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");

    // Si no hay token, redirige a login
    if (!token) {
      navigate("/login");
      return;
    }

    setUser({ email, role });

    // Fetch dashboard data
    const fetchDashboard = async () => {
      try {
        const response = await fetch(
          "https://toolbox-backend-rkit.onrender.com/api/dashboard-admin",
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

      {/* Main Content */}
      <main className="mx-auto max-w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">
            Bienvenido, {user?.email?.split("@")[0]}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Panel de administración de ToolBox
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)] mb-6">
            {error}
          </div>
        )}

        {/* Stats */}
        {data && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">
                Total de Organizaciones
              </p>
              <p className="text-4xl font-bold text-foreground">
                {data.total_organizations}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">
                Total de Usuarios
              </p>
              <p className="text-4xl font-bold text-foreground">
                {data.total_users}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">
                Tu Rol
              </p>
              <p className="text-2xl font-bold text-[var(--brand-red)]">
                {user?.role?.toUpperCase()}
              </p>
            </div>
          </div>
        )}

        {/* Organizations Table */}
        {data?.organizations && (
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Organizaciones
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Usuarios
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Creada
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.organizations.map((org: any) => (
                    <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {org.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {org.plan}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {org.users_count}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString()}
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