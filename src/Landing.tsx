import { useMemo, useState } from "react";
import {
  Boxes,
  BookOpen,
  Rocket,
  X,
  Check,
  Menu,
  ArrowRight,
  CalendarDays,
  Clock,
  Mail,
  Phone,
} from "lucide-react";

type ToolKey = "inventory" | "accounting" | "sales";

const tools: {
  key: ToolKey;
  name: string;
  Icon: typeof Boxes;
  tile: "red" | "blue";
  features: string[];
}[] = [
  {
    key: "inventory",
    name: "Control de Inventario",
    Icon: Boxes,
    tile: "red",
    features: [
      "Control total de inventario en tiempo real",
      "Detectar los productos más rentables",
      "Alertas inteligentes antes de quedarte sin producto",
      "Reportes claros para tomar mejores decisiones",
    ],
  },
  {
    key: "accounting",
    name: "Contabilidad",
    Icon: BookOpen,
    tile: "blue",
    features: [
      "Ver cuánto gana tu negocio realmente",
      "Conciliación bancaria inteligente",
      "Menos Excel, más claridad financiera",
      "Dashboards actualizados al instante",
    ],
  },
  {
    key: "sales",
    name: "Asistente de Ventas",
    Icon: Rocket,
    tile: "red",
    features: [
      "Nunca perder una oportunidad de venta",
      "Darle seguimiento a clientes sin esfuerzo",
      "Ver tus ingresos proyectados en tiempo real",
      "Visualizar el crecimiento de tu negocio",
    ],
  },
];

function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#herramientas", label: "Herramientas" },
    { href: "#planes", label: "Planes" },
    { href: "#nosotros", label: "Nosotros" },
    { href: "#contacto", label: "Contacto" },
  ];
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-full items-center justify-between gap-16 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2 mr-auto">
          <Logo />
        </a>
        <nav className="hidden items-center gap-8 md:flex flex-1 justify-center">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex gap-3 ml-auto">
           <a href="/login" className="btn-ghost">
           Entrar
           </a>
           <a href="#contacto" className="btn-primary">
           Agendar demo
           </a>
        </div>

        <button
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border md:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-full flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                {l.label}
              </a>
            ))}
            <a href="/login" onClick={() => setOpen(false)} className="btn-ghost mt-2 justify-center">
              Entrar
            </a>
            <a href="#contacto" onClick={() => setOpen(false)} className="btn-primary mt-2 justify-center">
              Agendar demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <img 
      src="/Logo Transparente.png" 
      alt="ToolBox Logo" 
      style={{ 
        height: "auto", 
        width: "190px",
        objectFit: "contain"
      }}
    />
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-1/2 h-[520px] w-[520px] translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.577_0.214_27.5/0.08),transparent_60%)]" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Todas las herramientas que tu{" "}
          <span className="text-[var(--brand-red)]">negocio</span> necesita en un solo lugar
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Unifica inventario, contabilidad, ventas y mucho mas en una sola plataforma.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#contacto" className="btn-primary btn-lg">
            Aprénde como
            <ArrowRight size={18} />
          </a>
          <a href="#herramientas" className="btn-ghost btn-lg">
            Ver herramientas
          </a>
        </div>
      </div>
    </section>
  );
}

function ToolsSection() {
  const [active, setActive] = useState<ToolKey | null>(null);
  return (
    <section id="herramientas" className="border-t border-border bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Todas las herramientas esenciales
          </h2>
          <p className="mt-3 text-muted-foreground">
            Diseñadas para trabajar juntas. Simples, poderosas y listas desde el primer día.
          </p>
        </div>
        <div className="mt-15 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <ToolCard
              key={t.key}
              tool={t}
              expanded={active === t.key}
              onToggle={() => setActive((cur) => (cur === t.key ? null : t.key))}
            />
          ))}
        </div>
        <div className="mt-15 text-center">
  <p className="text-sm text-muted-foreground">
    ¡Más herramientas próximamente!
  </p>
</div>
      </div>
    </section>
  );
}

function ToolCard({
  tool,
  expanded,
  onToggle,
}: {
  tool: (typeof tools)[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { Icon } = tool;
  const bg =
    tool.tile === "red" ? "bg-[var(--tile-red)]" : "bg-[var(--tile-blue)]";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={[
        "group relative flex w-full flex-col rounded-2xl border border-border p-7 text-left",
        "transition-all duration-200 ease-out",
        "hover:scale-[1.02] hover:shadow-[var(--shadow-soft)]",
        bg,
        expanded ? "shadow-[var(--shadow-soft)] ring-1 ring-[var(--brand-red)]/30" : "",
      ].join(" ")}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm">
        <Icon size={28} className="text-[var(--brand-red)]" strokeWidth={2.25} />
      </span>
      <h3 className="mt-6 text-xl font-semibold text-foreground">{tool.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {expanded ? "Diseñado para:" : "Toca para ver detalles"}
      </p>

      <div
        className={[
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
          expanded ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="min-h-0">
          <ul className="space-y-2.5 border-t border-border/70 pt-5">
            {tool.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <Check size={16} className="mt-0.5 shrink-0 text-[var(--brand-red)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
              }
            }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
          >
            <X size={14} /> Cerrar
          </span>
        </div>
      </div>
    </button>
  );
}

function Pricing() {
  const [addons, setAddons] = useState<[boolean, boolean]>([false, false]);
  const total = useMemo(() => 1000 + addons.filter(Boolean).length * 199, [addons]);

  return (
    <section id="planes" className="border-t border-border bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Plan sencillo y adaptable a tu negocio
          </h2>
          <p className="mt-3 text-muted-foreground">
            Empieza con lo esencial. Agrega más cuando lo necesites.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          {/* Base plan - 60% */}
          <div className="rounded-2xl border border-border bg-background p-8 shadow-sm lg:col-span-3">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-foreground">$1,000</span>
              <span className="text-sm font-medium text-muted-foreground">/ mes</span>
            </div>
            <p className="mt-2 text-foreground/80">Incluye 2 herramientas a tu elección</p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Acceso completo a 2 herramientas",
                "Usuarios ilimitados",
                "Soporte por email y Whatsapp",
                "Actualizaciones incluidas",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/85">
                  <Check size={16} className="text-[var(--brand-red)]" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#contacto" className="btn-primary mt-8 w-full justify-center">
              Comenzar
            </a>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Prueba gratis en persona o en linea · Sin tarjeta
            </p>
          </div>

          {/* Configurator - 40% */}
          <div className="relative rounded-2xl border-2 border-[var(--brand-red)] bg-background p-8 shadow-[var(--shadow-soft)] lg:col-span-2">
            <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand-red)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Personalizable
            </span>
            <h3 className="text-xl font-semibold text-foreground">Agregar herramientas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Agrega herramientas y expande las capacidades de tu plan.
            </p>
            <div className="mt-5 space-y-3">
              {([
                "Asistente de Ventas",
                "Generador de Facturas",
                "Asistente para Redes Sociales",
              ] as const).map((label, i) => (
                <label
                  key={label}
                  className={[
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors",
                    addons[i]
                      ? "border-[var(--brand-red)] bg-[var(--tile-red)]"
                      : "border-border hover:border-foreground/30",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded border",
                        addons[i]
                          ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                          : "border-foreground/30 bg-background",
                      ].join(" ")}
                    >
                      {addons[i] && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </span>
                  <span className="text-sm font-semibold text-foreground">+$199/mes</span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={addons[i]}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setAddons((prev) => {
                        const next = [...prev] as [boolean, boolean];
                        next[i] = v;
                        return next;
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
              <span className="text-sm font-medium text-foreground/80">Total</span>
              <span className="text-2xl font-extrabold text-foreground">
                ${total.toLocaleString("en-US")}
                <span className="text-sm font-medium text-muted-foreground">/mes</span>
              </span>
            </div>
            <a href="#contacto" className="btn-outline-red mt-5 w-full justify-center">
              Personalizar plan
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="nosotros" className="relative overflow-hidden bg-background py-24 sm:py-32 lg:py-40">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-1/2 h-[520px] w-[520px] translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.577_0.214_27.5/0.04),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Nosotros
        </p>

        <h2 className="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
          Los negocios pequeños merecen
          <br />
          <span className="text-[var(--brand-red)]">herramientas grandes</span>.
        </h2>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          Creamos ToolBox para ayudar a emprendedores y negocios en crecimiento a trabajar con más orden, claridad y control.
        </p>

        <p className="mt-6 text-sm font-medium text-muted-foreground">
          Sin sistemas complicados. Sin procesos eternos.
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
          {["Fácil de usar", "Todo conectado", "Diseñado para crecer"].map((benefit) => (
            <div key={benefit} className="rounded-lg border border-border/60 bg-muted/30 px-6 py-3 transition-all duration-300 hover:border-[var(--brand-red)]/40 hover:bg-muted/50 cursor-default">
              <span className="text-sm font-medium text-foreground">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const FORMSPREE_ENDPOINT = "https://formspree.io/f/mykvpqyd";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      
      if (res.ok) {
        setDone(true);
        form.reset();
      } else {
        setError("Hubo un error. Intenta de nuevo.");
      }
    } catch {
      setError("Problema de conexión. Intenta después.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contacto" className="relative overflow-hidden bg-background py-24 sm:py-32 lg:py-40">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.577_0.214_27.5/0.04),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        {/* Headline */}
        <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          ¿Listo para empezar?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Completa el formulario y nos ponemos en contacto en menos de 24 horas.
        </p>

        {/* Form or Success Message */}
        {done ? (
          <div className="mt-12 rounded-2xl border border-border bg-muted/30 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tile-red)]">
              <Check size={24} className="text-[var(--brand-red)]" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground">
              ¡Mensaje enviado!
            </h3>
            <p className="mt-2 text-muted-foreground">
              Nos pondremos en contacto por el medio que elegiste.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            action={FORMSPREE_ENDPOINT}
            method="POST"
            className="mt-10 space-y-5 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8"
          >
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nombre completo <span className="text-[var(--brand-red)]">*</span>
              </label>
              <input
                type="text"
                name="nombre"
                required
                placeholder="Tu nombre"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email <span className="text-[var(--brand-red)]">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Teléfono <span className="text-[var(--brand-red)]">*</span>
              </label>
              <input
                type="tel"
                name="telefono"
                required
                placeholder="+52 555 1234567"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
              />
            </div>

            {/* Empresa */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Empresa <span className="text-[var(--brand-red)]">*</span>
              </label>
              <input
                type="text"
                name="empresa"
                required
                placeholder="Nombre de tu empresa"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
              />
            </div>

            {/* Método de contacto */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                ¿Cómo prefieres que nos contactemos? <span className="text-[var(--brand-red)]">*</span>
              </label>
              <div className="flex gap-3">
                {[
                  { value: "Email", label: "Email" },
                  { value: "Teléfono", label: "Teléfono" }
                ].map((option) => (
                  <label key={option.value} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 transition-all hover:border-[var(--brand-red)]/30 has-[:checked]:border-[var(--brand-red)] has-[:checked]:bg-[var(--tile-red)]">
                    <input
                      type="radio"
                      name="metodo"
                      value={option.value}
                      defaultChecked={option.value === "Email"}
                      required
                      className="h-4 w-4 accent-[var(--brand-red)]"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-[var(--tile-red)] px-4 py-3 text-sm text-[var(--brand-red)]">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary btn-lg w-full justify-center disabled:opacity-60 mt-8"
            >
              {submitting ? "Enviando..." : "Enviar"}
              {!submitting && <ArrowRight size={18} />}
            </button>

            {/* Privacy note */}
            <p className="text-xs text-muted-foreground">
              Al enviar aceptas nuestra política de privacidad.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type,
  required,
  icon,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-[var(--brand-red)]">*</span>}
      </span>
      <span className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          required={required}
          className={[
            "h-11 w-full rounded-md border border-border bg-background text-sm text-foreground",
            "transition-colors placeholder:text-muted-foreground",
            "focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20",
            icon ? "pl-9 pr-3" : "px-3",
          ].join(" ")}
        />
      </span>
    </label>
  );
}

function Select({
  label,
  name,
  required,
  options,
  icon,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: string[];
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-[var(--brand-red)]">*</span>}
      </span>
      <span className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <select
          name={name}
          required={required}
          defaultValue=""
          className={[
            "h-11 w-full appearance-none rounded-md border border-border bg-background text-sm text-foreground",
            "transition-colors focus:border-[var(--brand-red)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20",
            icon ? "pl-9 pr-9" : "px-3 pr-9",
          ].join(" ")}
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          ▾
        </span>
      </span>
    </label>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-full flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <p className="text-sm text-muted-foreground">
          © 2026 ToolBox. Todos los derechos reservados.
        </p>
        <div className="flex gap-5 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-foreground">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <ToolsSection />
        <Pricing />
        <About />
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}