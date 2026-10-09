import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { api, type Cow, type CowInput } from "../lib/api";

const BREEDS = ["Holstein", "Montbéliarde", "Brune des Alpes", "Pie Rouge"];

const EMPTY: CowInput = {
  ear_tag: "",
  name: "",
  breed: "Holstein",
  birth_date: "",
  weight: null,
  status: "active",
  lactation_number: 1,
};

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-bark-600">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

type Props = {
  open: boolean;
  cow?: Cow | null; // si fourni : mode modification
  onClose: () => void;
  onSaved: (cow: Cow) => void;
};

export default function CowFormModal({ open, cow, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CowInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Remplit le formulaire à l'ouverture
  useEffect(() => {
    if (open) {
      setForm(cow ? { ...cow } : EMPTY);
      setError(null);
    }
  }, [open, cow]);

  // Fermeture avec Échap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof CowInput>(key: K, value: CowInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, name: form.name?.trim() || null };
      const saved = cow ? await api.updateCow(cow.id, payload) : await api.createCow(payload);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
        className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-forest-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
               className="card w-full max-w-lg animate-modal-in p-6 sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-wheat-600">
              {cow ? "Modifier" : "Nouvelle vache"}
            </p>
            <h2 className="mt-1 font-display text-2xl text-forest-900">
              {cow ? `${cow.name ?? "Vache"} #${cow.ear_tag}` : "Ajouter au troupeau"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-bark-600 hover:bg-cream-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="N° de boucle">
            <input
              required className="input" placeholder="0051"
              value={form.ear_tag} onChange={(e) => set("ear_tag", e.target.value)}
            />
          </Field>
          <Field label="Nom">
            <input
              className="input" placeholder="Bella"
              value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Race">
            <select className="input" value={form.breed} onChange={(e) => set("breed", e.target.value)}>
              {BREEDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Date de naissance">
            <input
              required type="date" className="input"
              value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)}
            />
          </Field>
          <Field label="Poids (kg)">
            <input
              type="number" min="0" className="input"
              value={form.weight ?? ""}
              onChange={(e) => set("weight", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="N° de lactation">
            <input
              type="number" min="0" className="input"
              value={form.lactation_number}
              onChange={(e) => set("lactation_number", Number(e.target.value))}
            />
          </Field>
          <Field label="Statut" className="sm:col-span-2">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">En lactation</option>
              <option value="dry">Tarie</option>
            </select>
          </Field>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-500">{error}</p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Enregistrement…" : cow ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}