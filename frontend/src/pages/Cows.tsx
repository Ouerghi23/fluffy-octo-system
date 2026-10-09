import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutGrid, List, Plus, Search } from "lucide-react";
import CowAvatar from "../components/CowAvatar";
import CowFormModal from "../components/CowFormModal";
import { useToast } from "../components/Toast";
import { api, type Cow } from "../lib/api";

type StatusFilter = "all" | "active" | "dry";
type View = "grid" | "table";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "active", label: "En lactation" },
  { value: "dry", label: "Taries" },
];

const age = (birth: string) =>
  Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000));

function StatusBadge({ status, glass = false }: { status: string; glass?: boolean }) {
  const active = status === "active";
  const style = glass
    ? active
      ? "bg-forest-900/70 text-cream-50 backdrop-blur"
      : "bg-wheat-500/90 text-forest-950 backdrop-blur"
    : active
      ? "bg-forest-700/10 text-forest-700"
      : "bg-wheat-500/15 text-wheat-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      {active ? "En lactation" : "Tarie"}
    </span>
  );
}

export default function Cows() {
  const navigate = useNavigate();
  const toast = useToast();
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [breed, setBreed] = useState("Toutes");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<View>("grid");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .cows()
      .then(setCows)
      .catch(() => toast({ type: "error", message: "Impossible de charger le troupeau" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const breeds = useMemo(() => ["Toutes", ...new Set(cows.map((c) => c.breed))], [cows]);
  const counts: Record<StatusFilter, number> = {
    all: cows.length,
    active: cows.filter((c) => c.status === "active").length,
    dry: cows.filter((c) => c.status !== "active").length,
  };

  const filtered = cows.filter((c) => {
    const text = `${c.ear_tag} ${c.name ?? ""} ${c.breed}`.toLowerCase();
    return (
      text.includes(search.toLowerCase()) &&
      (breed === "Toutes" || c.breed === breed) &&
      (status === "all" || (status === "active" ? c.status === "active" : c.status !== "active"))
    );
  });

  const resetFilters = () => {
    setSearch("");
    setBreed("Toutes");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-wheat-600">Gestion</p>
          <h1 className="mt-1 font-display text-4xl text-forest-900">Le troupeau</h1>
          <p className="mt-1 text-bark-600">{cows.length} vaches enregistrées</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={18} /> Ajouter une vache
        </button>
      </header>

      {/* Barre d'outils */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="card flex min-w-60 flex-1 items-center gap-2 px-4 py-2.5 focus-within:ring-4 focus-within:ring-forest-500/15">
            <Search size={18} className="text-bark-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par numéro, nom ou race…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-bark-600/60"
            />
          </label>
          <select value={breed} onChange={(e) => setBreed(e.target.value)} className="card px-4 py-2.5 text-sm outline-none">
            {breeds.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <div className="card flex p-1">
            {(
              [
                ["grid", LayoutGrid, "Vue en cartes"],
                ["table", List, "Vue en liste"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                aria-label={label}
                aria-pressed={view === value}
                className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition ${
                  view === value ? "bg-forest-800 text-cream-50" : "text-bark-600 hover:bg-cream-200"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                status === f.value
                  ? "bg-forest-800 text-cream-50"
                  : "bg-cream-50 text-bark-600 ring-1 ring-cream-200 hover:bg-cream-200"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-cream-200 text-bark-600">
            <Search size={24} />
          </span>
          <p className="mt-4 font-display text-xl text-forest-900">Aucune vache ne correspond</p>
          <p className="mt-1 text-sm text-bark-600">Essayez une autre recherche ou réinitialisez les filtres.</p>
          <button onClick={resetFilters} className="btn-secondary mt-5">
            Réinitialiser les filtres
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c, i) => (
            <Link
              key={c.id}
              to={`/cows/${c.id}`}
              className="card card-hover group animate-fade-up overflow-hidden"
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <CowAvatar cow={c} className="h-full w-full transition duration-700 group-hover:scale-105" textClass="text-5xl" />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-forest-950/80 to-transparent" />
                <div className="absolute left-3 top-3">
                  <StatusBadge status={c.status} glass />
                </div>
                <div className="absolute bottom-3 left-4 right-4 text-cream-50">
                  <p className="truncate font-display text-xl leading-tight">{c.name ?? "Sans nom"}</p>
                  <p className="text-xs text-cream-100/80">#{c.ear_tag}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-cream-200 text-center">
                {[
                  ["Race", c.breed],
                  ["Âge", `${age(c.birth_date)} ans`],
                  ["Lactation", `n° ${c.lactation_number}`],
                ].map(([label, value]) => (
                  <div key={label} className="px-2 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-bark-600">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card animate-fade-up overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cream-200 text-xs uppercase tracking-wider text-bark-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Vache</th>
                <th className="px-6 py-4 font-semibold">Race</th>
                <th className="px-6 py-4 font-semibold">Âge</th>
                <th className="px-6 py-4 font-semibold">Poids</th>
                <th className="px-6 py-4 font-semibold">Lactation</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cows/${c.id}`)}
                  className="group cursor-pointer border-b border-cream-200/70 transition last:border-0 hover:bg-cream-100"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <CowAvatar cow={c} className="h-10 w-10 rounded-xl" textClass="text-sm" />
                      <div>
                        <p className="font-semibold">{c.name ?? "Sans nom"}</p>
                        <p className="text-xs text-bark-600">#{c.ear_tag}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-bark-600">{c.breed}</td>
                  <td className="px-6 py-3 text-bark-600">{age(c.birth_date)} ans</td>
                  <td className="px-6 py-3 text-bark-600">{c.weight ? `${c.weight} kg` : "—"}</td>
                  <td className="px-6 py-3 text-bark-600">n° {c.lactation_number}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-3 text-bark-600/40 transition group-hover:translate-x-1 group-hover:text-forest-700">
                    <ChevronRight size={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CowFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(cow) => {
          setCreating(false);
          toast({ type: "success", message: `${cow.name ?? "Vache"} #${cow.ear_tag} ajoutée — ajoutez-lui une photo` });
          navigate(`/cows/${cow.id}`);
        }}
      />
    </div>
  );
}