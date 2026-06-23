import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSlowConnection(false);

    // Si tarda más de 4 segundos, mostramos aviso de servidor dormido
    const slowTimer = setTimeout(() => setSlowConnection(true), 4000);

    try {
      const response = await fetch(
        "https://toolbox-backend-rkit.onrender.com/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      clearTimeout(slowTimer);

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Usuario o contraseña incorrecta");
        setLoading(false);
        setSlowConnection(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", data.role);

      if (data.role === "admin") {
        navigate("/dashboard");
      } else if (data.role === "owner" || data.role === "employee") {
        navigate("/dashboard-org");
      } else {
        navigate("/");
      }
    } catch (err) {
      clearTimeout(slowTimer);
      setError("Error de conexión con el servidor");
      setLoading(false);
      setSlowConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/Logo Transparente.png"
            alt="ToolBox Logo"
            style={{ height: "auto", width: "150px", margin: "0 auto" }}
          />
          <h1 className="mt-6 text-3xl font-bold text-foreground">
            Bienvenido a ToolBox
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">
              {error}
            </div>
          )}

          {/* Aviso de servidor dormido */}
          {slowConnection && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-start gap-3">
              <Loader size={16} className="animate-spin text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Conectando con el servidor...</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Esto puede tomar hasta 30 segundos la primera vez. Por favor espera.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="manolo"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-lg w-full justify-center disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Problemas? Contacta a{" "}
          <a href="mailto:support@toolbox.mx" className="text-[var(--brand-red)] hover:underline">
            support@toolbox.mx
          </a>
        </p>
      </div>
    </div>
  );
}
