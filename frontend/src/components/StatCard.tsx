import type { LucideIcon } from "lucide-react";

const ACCENTS = {
  forest: "bg-forest-700/10 text-forest-700",
  wheat: "bg-wheat-500/15 text-wheat-600",
  clay: "bg-clay-500/10 text-clay-500",
};

type Props = {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
  delay?: number;
};

export default function StatCard({ label, value, unit, hint, icon: Icon, accent = "forest", delay = 0 }: Props) {
  return (
    <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-bark-600">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${ACCENTS[accent]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl text-forest-900">
        {value}
        {unit && <span className="ml-1.5 font-sans text-base text-bark-600">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-bark-600">{hint}</p>}
    </div>
  );
}