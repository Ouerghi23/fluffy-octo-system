import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { HeartPulse, LayoutDashboard, Menu, Milk, Sparkles, Tag, Wallet, Wheat, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/cows", label: "Troupeau", icon: Tag },
  { to: "/milk", label: "Production", icon: Milk, soon: true },
  { to: "/health", label: "Santé", icon: HeartPulse, soon: true },
  { to: "/finances", label: "Finances", icon: Wallet, soon: true },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-wheat-300 to-wheat-500 text-forest-950 shadow-lg shadow-black/20">
        <Wheat size={22} />
      </div>
      <div>
        <p className="font-display text-lg leading-tight">Smart Dairy</p>
        <p className="text-[11px] uppercase tracking-[0.25em] text-wheat-300">Ferme · AI</p>
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-100/40">Menu</p>
      {NAV.map(({ to, label, icon: Icon, soon }) =>
        soon ? (
          <div key={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream-100/35">
            <Icon size={18} />
            {label}
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider">
              Bientôt
            </span>
          </div>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-wheat-500"
                  : "text-cream-100/70 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        )
      )}
    </nav>
  );
}

function AiCard() {
  return (
    <div className="relative m-4 overflow-hidden rounded-2xl bg-linear-to-br from-wheat-300 via-wheat-500 to-wheat-600 p-4 text-forest-950">
      <Wheat aria-hidden className="absolute -bottom-4 -right-4 h-20 w-20 opacity-15" />
      <Sparkles size={20} />
      <p className="mt-2 font-display text-base">Assistant IA</p>
      <p className="text-xs text-forest-950/75">Posez vos questions sur la ferme en langage naturel.</p>
      <span className="mt-3 inline-block rounded-full bg-forest-950/10 px-2.5 py-1 text-[11px] font-semibold">
        Bientôt disponible
      </span>
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const close = () => setMenuOpen(false);

  return (
    <div className="min-h-screen">
      {/* Barre latérale — ordinateur */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-linear-to-b from-forest-900 to-forest-950 text-cream-100 lg:flex">
        <div className="px-6 py-7">
          <Brand />
        </div>
        <Navigation />
        <AiCard />
      </aside>

      {/* En-tête — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-forest-900/95 px-4 py-3 text-cream-100 backdrop-blur lg:hidden">
        <Brand />
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="cursor-pointer rounded-lg p-2 hover:bg-white/10"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Tiroir — mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-forest-950/60 backdrop-blur-sm" onClick={close} />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-in flex-col bg-linear-to-b from-forest-900 to-forest-950 text-cream-100 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-6">
              <Brand />
              <button onClick={close} aria-label="Fermer le menu" className="cursor-pointer rounded-lg p-1.5 hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <Navigation onNavigate={close} />
            <AiCard />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        {/* La clé force l'animation à chaque changement de page */}
        <div key={location.pathname} className="mx-auto max-w-7xl animate-fade-up p-4 sm:p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}