import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, Baby, Droplets, HeartPulse, Milk, Pencil, Plus, Trash2, TrendingUp, TriangleAlert, Trophy,
  type LucideIcon,
} from "lucide-react";
import StatCard from "../components/StatCard";
import CowFormModal from "../components/CowFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../components/Toast";
import { api, type Cow, type CowHealthEvent, type MilkRecord } from "../lib/api";

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const shortDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const longDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const age = (birth: string) =>
  Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000));
const average = (arr: MilkRecord[]) =>
  arr.length ? arr.reduce((s, r) => s + r.quantity_liters, 0) / arr.length : 0;

const EVENT_STYLE: Record<string, { icon: LucideIcon; color: string; solid: string }> = {
  Mammite: { icon: TriangleAlert, color: "#b5543c", solid: "bg-clay-500 text-white" },
  Boiterie: { icon: HeartPulse, color: "#a9842f", solid: "bg-wheat-500 text-forest-950" },
  Vêlage: { icon: Baby, color: "#2c5c41", solid: "bg-forest-700 text-white" },
};
const styleFor = (type: string) => EVENT_STYLE[type] ?? EVENT_STYLE["Vêlage"];

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-64 rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );
}

export default function CowDetail() {
  const { id } = useParams();
  const cowId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [cow, setCow] = useState<Cow | null>(null);
  const [milk, setMilk] = useState<MilkRecord[]>([]);
  const [events, setEvents] = useState<CowHealthEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "cow" | "photo">(null);

  const [milkDate, setMilkDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [milkQty, setMilkQty] = useState("");

  const load = useCallback(() => {
    Promise.all([api.cow(cowId), api.cowMilk(cowId), api.cowHealth(cowId)])
      .then(([c, m, h]) => {
        setCow(c);
        setMilk([...m].reverse());
        setEvents(h);
      })
      .catch((e: Error) => setError(e.message));
  }, [cowId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!cow) return;
    await api.deleteCow(cow.id);
    toast({ type: "success", message: `${cow.name ?? "Vache"} #${cow.ear_tag} supprimée` });
    navigate("/cows");
  }

  async function handleRemovePhoto() {
    if (!cow) return;
    setCow(await api.deleteCowPhoto(cow.id));
    setConfirm(null);
    toast({ type: "success", message: "Photo retirée" });
  }

  async function handleAddMilk(e: FormEvent) {
    e.preventDefault();
    if (!cow) return;
    try {
      await api.addMilk({ cow_id: cow.id, date: milkDate, quantity_liters: Number(milkQty) });
      setMilkQty("");
      toast({ type: "success", message: `Traite de ${milkQty} L enregistrée` });
      load();
    } catch (err) {
      toast({ type: "error", message: (err as Error).message });
    }
  }

  const backLink = (
    <Link to="/cows" className="inline-flex items-center gap-2 text-sm text-bark-600 transition hover:text-forest-900">
      <ArrowLeft size={16} /> Retour au troupeau
    </Link>
  );

  if (error)
    return (
      <div className="space-y-4">
        {backLink}
        <p className="card p-6 text-clay-500">{error}</p>
      </div>
    );
  if (!cow) return <DetailSkeleton />;

  const last = milk.at(-1);
  const last7 = milk.slice(-7);
  const prev7 = milk.slice(-14, -7);
  const avg7 = average(last7);
  const trend = prev7.length ? ((avg7 - average(prev7)) / average(prev7)) * 100 : 0;
  const peak = milk.reduce<MilkRecord | null>(
    (best, r) => (!best || r.quantity_liters > best.quantity_liters ? r : best),
    null
  );
  const isActive = cow.status === "active";

  const chartData = milk.map((r, i) => ({
    date: r.date,
    liters: r.quantity_liters,
    ma7: Number(average(milk.slice(Math.max(0, i - 6), i + 1)).toFixed(1)),
  }));
  const milkDates = new Set(milk.map((r) => r.date));
  const chartEvents = events.filter((e) => milkDates.has(e.date));

  return (
    <div className="space-y-8">
      {backLink}

      {/* En-tête avec photo */}
      <header className="relative overflow-hidden rounded-3xl bg-linear-to-br from-forest-900 to-forest-950 p-6 text-cream-50 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-wheat-500/10" aria-hidden />
        <div className="absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-forest-700/40" aria-hidden />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="w-40 shrink-0 sm:w-52">
            <PhotoUploader cow={cow} onChange={setCow} onRequestRemove={() => setConfirm("photo")} />
          </div>

          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.25em] text-wheat-300">Fiche individuelle</p>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl">
              {cow.name ?? "Sans nom"} <span className="text-wheat-300">#{cow.ear_tag}</span>
            </h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1">{cow.breed}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{age(cow.birth_date)} ans</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Lactation n°{cow.lactation_number}</span>
              <span
                className={`rounded-full px-3 py-1 font-semibold ${
                  isActive ? "bg-forest-500 text-white" : "bg-wheat-500 text-forest-950"
                }`}
              >
                {isActive ? "En lactation" : "Tarie"}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20"
              >
                <Pencil size={16} /> Modifier
              </button>
              <button
                onClick={() => setConfirm("cow")}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-cream-100/80 transition hover:bg-clay-500 hover:text-white"
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Dernière traite" icon={Droplets} delay={0}
          value={last ? fmt.format(last.quantity_liters) : "—"} unit={last ? "L" : undefined}
          hint={last ? `le ${shortDate(last.date)}` : "Aucune donnée"}
        />
        <StatCard
          label="Moyenne 7 jours" icon={TrendingUp} accent="wheat" delay={60}
          value={fmt.format(avg7)} unit="L/jour"
          hint={prev7.length ? `${trend >= 0 ? "↑" : "↓"} ${fmt.format(Math.abs(trend))} % vs semaine précédente` : undefined}
        />
        <StatCard
          label="Moyenne 30 jours" icon={Milk} delay={120}
          value={fmt.format(average(milk.slice(-30)))} unit="L/jour"
        />
        <StatCard
          label="Pic de production" icon={Trophy} accent="wheat" delay={180}
          value={peak ? fmt.format(peak.quantity_liters) : "—"} unit={peak ? "L" : undefined}
          hint={peak ? `le ${shortDate(peak.date)}` : undefined}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {/* Courbe de lactation */}
        <div className="card animate-fade-up p-6 lg:col-span-2" style={{ animationDelay: "240ms" }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-bark-600">Production quotidienne</p>
              <h2 className="font-display text-xl text-forest-900">Courbe de lactation</h2>
            </div>
            <div className="flex gap-4 text-xs text-bark-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-forest-500" /> Production
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-forest-900" /> Moyenne 7 j
              </span>
            </div>
          </div>

          {milk.length === 0 ? (
            <div className="mt-10 flex flex-col items-center py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-cream-200 text-bark-600">
                <Milk size={24} />
              </span>
              <p className="mt-3 text-sm text-bark-600">Aucune production enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 24, right: 8, left: -8 }}>
                  <defs>
                    <linearGradient id="cowFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f8a63" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#4f8a63" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ede4d0" vertical={false} />
                  <XAxis
                    dataKey="date" tickFormatter={shortDate} minTickGap={32}
                    tick={{ fill: "#6b5a45", fontSize: 12 }} axisLine={false} tickLine={false}
                  />
                  <YAxis width={40} tick={{ fill: "#6b5a45", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fcfaf5", border: "1px solid #ede4d0", borderRadius: 12 }}
                    labelFormatter={(d) => longDate(String(d))}
                    formatter={(v, name) => [`${fmt.format(Number(v))} L`, name]}
                  />
                  <Area name="Production" type="monotone" dataKey="liters" stroke="#4f8a63" strokeWidth={1.5} fill="url(#cowFill)" />
                  <Line name="Moyenne 7 j" type="monotone" dataKey="ma7" stroke="#173424" strokeWidth={2.5} dot={false} />
                  {chartEvents.map((e) => (
                    <ReferenceLine
                      key={e.id} x={e.date} stroke={styleFor(e.event_type).color} strokeDasharray="4 4"
                      label={{ value: e.event_type, position: "top", fill: styleFor(e.event_type).color, fontSize: 11 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Saisie rapide */}
          <form onSubmit={handleAddMilk} className="card animate-fade-up p-6" style={{ animationDelay: "300ms" }}>
            <p className="text-sm text-bark-600">Saisie rapide</p>
            <h2 className="font-display text-xl text-forest-900">Enregistrer une traite</h2>
            <div className="mt-5 space-y-3">
              <input type="date" required className="input" value={milkDate} onChange={(e) => setMilkDate(e.target.value)} />
              <div className="relative">
                <input
                  type="number" step="0.1" min="0.1" max="99" required placeholder="Quantité"
                  className="input pr-10" value={milkQty} onChange={(e) => setMilkQty(e.target.value)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-bark-600">L</span>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">
                <Plus size={16} /> Enregistrer
              </button>
            </div>
          </form>

          {/* Informations */}
          <div className="card animate-fade-up p-6" style={{ animationDelay: "360ms" }}>
            <h2 className="font-display text-xl text-forest-900">Informations</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Race", cow.breed],
                ["Née le", longDate(cow.birth_date)],
                ["Âge", `${age(cow.birth_date)} ans`],
                ["Poids", cow.weight ? `${cow.weight} kg` : "—"],
                ["Lactation", `n° ${cow.lactation_number}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-cream-200 pb-3 last:border-0 last:pb-0">
                  <dt className="text-bark-600">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Historique sanitaire */}
      <section className="card animate-fade-up p-6" style={{ animationDelay: "420ms" }}>
        <p className="text-sm text-bark-600">Suivi sanitaire</p>
        <h2 className="font-display text-xl text-forest-900">Historique</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-bark-600">Aucun événement enregistré pour cette vache.</p>
        ) : (
          <ol className="relative ml-3 mt-6 space-y-6 border-l border-cream-200 pl-7">
            {events.map((e) => {
              const s = styleFor(e.event_type);
              const Icon = s.icon;
              return (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[42px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-cream-50 ${s.solid}`}>
                    <Icon size={14} />
                  </span>
                  <p className="text-sm font-semibold">{e.event_type}</p>
                  <p className="text-xs text-bark-600">{e.description}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-bark-600/70">{longDate(e.date)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <CowFormModal
        open={editing}
        cow={cow}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setCow(saved);
          setEditing(false);
          toast({ type: "success", message: "Fiche mise à jour" });
        }}
      />

      <ConfirmDialog
        open={confirm === "cow"}
        title="Supprimer cette vache ?"
        message={`${cow.name ?? "La vache"} #${cow.ear_tag} et tout son historique (production, santé, photo) seront définitivement supprimés.`}
        confirmLabel="Supprimer"
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirm === "photo"}
        title="Retirer la photo ?"
        message="Vous pourrez en ajouter une nouvelle à tout moment."
        confirmLabel="Retirer"
        onCancel={() => setConfirm(null)}
        onConfirm={handleRemovePhoto}
      />
    </div>
  );
}