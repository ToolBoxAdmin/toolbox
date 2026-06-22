import { Construction } from "lucide-react";

interface WorkInProgressProps {
  section: string;
}

export default function WorkInProgress({ section }: WorkInProgressProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--tile-red)] flex items-center justify-center mb-6">
        <Construction size={28} className="text-[var(--brand-red)]" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{section}</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Esta sección está en desarrollo. Estará disponible muy pronto.
      </p>
    </div>
  );
}
