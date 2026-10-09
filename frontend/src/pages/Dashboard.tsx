import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight, Baby, Droplets, HeartPulse, Milk, Tag, TriangleAlert, Wallet, type LucideIcon,
} from "lucide-react";
import StatCard from "../components/StatCard";
import CowAvatar from "../components/CowAvatar";
import { api, type HealthAlert, type ProductionPoint, type Summary } from "../lib/api";

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const shortDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const longDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
};
const avg = (arr: ProductionPoint[]) => arr.reduce((s, p) => s + p.liters, 0) / (arr.length || 1);

const EVENT_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  Mammite: { icon: TriangleAlert, className: "bg-clay-500 text-white" },
  Boiterie: { icon: HeartPulse, className: "bg-wheat-500 text-forest-950" },
  Vêlage: { icon: Baby, className: "bg-forest-700 text-white" },
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton h-56 rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="skeleton h-96 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [production, setProduction] = useState<ProductionPoint[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.summary(), api.production(30), api.alerts()])
      .then(([s, p, a]) => {
        setSummary(s);
        setProduction(p);
        setAlerts(a);
      })
      .catch(() => setError("Impossible de contacter l'API. Le backend est-il lancé ?"));
  }, []);

  if (error) return <p className="card p-6 text-clay-500">{error}</p>;
  if (!summary) return <DashboardSkeleton />;

  const last7 = production.slice(-7);
  const prev7 = production.slice(-14, -7);
  const trend = prev7.length ? ((avg(last7) - avg(prev7)) / avg(prev7)) * 100 : 0;
  const perCow = summary.lactating_cows ? summary.milk_today_liters / summary.lactating_cows : 0;
  const topMax = summary.top_cows[0]?.liters ?? 1;
  const trendText = `${trend >= 0 ? "↑" : "↓"} ${fmt.format(Math.abs(trend))} %`;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-forest-900 px-6 py-10 text-cream-50 sm:px-10 sm:py-12">
        <svg
          className="absolute inset-y-0 right-0 h-full w-2/3"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMaxYMax slice"
          aria-hidden
        >
          <circle cx="320" cy="70" r="34" fill="#c9a24a" opacity="0.9" />
          <circle cx="320" cy="70" r="52" fill="#c9a24a" opacity="0.12" />
          <path d="M0 160 Q100 110 200 150 T400 130 V200 H0Z" fill="#1f4430" />
          <path d="M0 182 Q120 140 240 176 T400 166 V200 H0Z" fill="#2c5c41" />
        </svg>
        <div className="relative z-10 max-w-lg">
          <p className="text-xs uppercase tracking-[0.25em] text-wheat-300">{longDate(summary.date)}</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">{greeting()}</h1>
          <p className="mt-3 text-cream-100/75">
            Le troupeau a produit{" "}
            <strong className="font-semibold text-wheat-300">{fmt.format(summary.milk_today_liters)} L</strong>{" "}
            aujourd'hui. La moyenne de la semaine est{" "}
            {trend >= 0 ? "en hausse" : "en baisse"} de {fmt.format(Math.abs(trend))} %.
          </p>
          <Link
            to="/cows"
            className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-wheat-500 px-5 py-2.5 text-sm font-semibold text-forest-950 transition hover:bg-wheat-300"
          >
            Voir le troupeau
            <ArrowRight size={16} className="transition group-hover:translate-x-1" />
          </Link>
        </div>
      </header>

      {/* KPI */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Production du jour" icon={Milk} delay={0}
          value={fmt.format(summary.milk_today_liters)} unit="L"
          hint={`${trendText} vs semaine précédente`}
        />
        <StatCard
          label="Vaches en lactation" icon={Tag} accent="wheat" delay={60}
          value={String(summary.lactating_cows)} unit={`/ ${summary.total_cows}`}
          hint={`${summary.total_cows - summary.lactating_cows} vaches taries`}
        />
        <StatCard label="Moyenne par vache" icon={Droplets} delay={120} value={fmt.format(perCow)} unit="L/jour" />
        <StatCard
          label="Dépenses du mois" icon={Wallet} accent="clay" delay={180}
          value={fmt.format(summary.expenses_month)} unit="TND"
        />
      </section>

      {/* Graphique + top */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="card animate-fade-up p-6 lg:col-span-2" style={{ animationDelay: "240ms" }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-bark-600">Production totale</p>
              <h2 className="font-display text-xl text-forest-900">30 derniers jours</h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                trend >= 0 ? "bg-forest-700/10 text-forest-700" : "bg-clay-500/10 text-clay-500"
              }`}
            >
              {trendText} cette semaine
            </span>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={production} margin={{ top: 8, right: 8, left: -8 }}>
                <defs>
                  <linearGradient id="milkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2c5c41" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2c5c41" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ede4d0" vertical={false} />
                <XAxis
                  dataKey="date" tickFormatter={shortDate} minTickGap={24}
                  tick={{ fill: "#6b5a45", fontSize: 12 }} axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]} width={48}
                  tick={{ fill: "#6b5a45", fontSize: 12 }} axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "#fcfaf5", border: "1px solid #ede4d0", borderRadius: 12 }}
                  labelFormatter={(d) => shortDate(String(d))}
                  formatter={(v) => [`${fmt.format(Number(v))} L`, "Production"]}
                />
                <Area type="monotone" dataKey="liters" stroke="#2c5c41" strokeWidth={2.5} fill="url(#milkFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card animate-fade-up p-6" style={{ animationDelay: "300ms" }}>
          <p className="text-sm text-bark-600">Meilleures productrices</p>
          <h2 className="font-display text-xl text-forest-900">Top 5 du jour</h2>
          <ul className="mt-5 space-y-1">
            {summary.top_cows.map((cow, i) => (
              <li key={cow.id}>
                <Link
                  to={`/cows/${cow.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl p-2 transition hover:bg-cream-100"
                >
                  <div className="relative shrink-0">
                    <CowAvatar cow={cow} className="h-11 w-11 rounded-full" textClass="text-sm" />
                    <span
                      className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ring-2 ring-cream-50 ${
                        i === 0 ? "bg-wheat-500 text-forest-950" : "bg-cream-200 text-bark-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {cow.name ?? "Sans nom"} <span className="font-normal text-bark-600">#{cow.ear_tag}</span>
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-cream-200">
                      <div className="h-full rounded-full bg-forest-700" style={{ width: `${(cow.liters / topMax) * 100}%` }} />
                    </div>
                  </div>
                  <p className="font-display text-lg text-forest-900">{fmt.format(cow.liters)} L</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Alertes santé */}
      <section className="card animate-fade-up p-6" style={{ animationDelay: "360ms" }}>
        <p className="text-sm text-bark-600">Suivi sanitaire</p>
        <h2 className="font-display text-xl text-forest-900">Événements récents</h2>
        {alerts.length === 0 ? (
          <p className="mt-4 text-sm text-bark-600">Aucun événement ces 30 derniers jours.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a, i) => {
              const style = EVENT_STYLE[a.event_type] ?? EVENT_STYLE["Vêlage"];
              const Icon = style.icon;
              return (
                <Link
                  key={i}
                  to={`/cows/${a.cow_id}`}
                  className="card-hover flex gap-4 rounded-xl border border-cream-200 bg-cream-100/60 p-4"
                >
                  <div className="relative shrink-0">
                    <CowAvatar cow={a} className="h-12 w-12 rounded-xl" textClass="text-base" />
                    <span
                      className={`absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full ring-2 ring-cream-50 ${style.className}`}
                    >
                      <Icon size={12} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {a.event_type} · {a.name ?? "Vache"} #{a.ear_tag}
                    </p>
                    <p className="truncate text-xs text-bark-600">{a.description}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-bark-600/70">{shortDate(a.date)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}