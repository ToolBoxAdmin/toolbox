import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "https://toolbox-backend-rkit.onrender.com/api/login-admin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Login fallido");
        setLoading(false);
        return;
      }

      const data = await response.json();
      // Guardar token en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("email", data.email);
      localStorage.setItem("role", data.role);

      // Ir a dashboard
      navigate("/dashboard");
    } catch (err) {
      setError("Error de conexión con el servidor");
      setLoading(false);
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manolo@toolbox.mx"
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