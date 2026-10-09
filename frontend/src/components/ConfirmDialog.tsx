import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirmer", onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-forest-950/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm animate-modal-in p-6 text-center"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-clay-500/10 text-clay-500">
          <TriangleAlert size={22} />
        </span>
        <h2 className="mt-4 font-display text-xl text-forest-900">{title}</h2>
        <p className="mt-2 text-sm text-bark-600">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="btn-secondary justify-center">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={busy} className="btn-danger justify-center">
            {busy ? "Patientez…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}