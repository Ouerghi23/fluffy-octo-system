import { useRef, useState, type DragEvent } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import CowAvatar from "./CowAvatar";
import { useToast } from "./Toast";
import { api, type Cow } from "../lib/api";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  cow: Cow;
  onChange: (cow: Cow) => void;
  onRequestRemove: () => void;
};

export default function PhotoUploader({ cow, onChange, onRequestRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function upload(file?: File) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast({ type: "error", message: "Format accepté : JPG, PNG ou WebP" });
    if (file.size > MAX_SIZE) return toast({ type: "error", message: "Image trop lourde (5 Mo maximum)" });

    setUploading(true);
    try {
      onChange(await api.uploadCowPhoto(cow.id, file));
      toast({ type: "success", message: "Photo mise à jour" });
    } catch (err) {
      toast({ type: "error", message: (err as Error).message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files[0]);
  }

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-label={cow.photo_url ? "Changer la photo" : "Ajouter une photo"}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl ring-4 transition ${
          dragging ? "ring-wheat-500" : "ring-white/10 hover:ring-white/25"
        }`}
      >
        <CowAvatar cow={cow} className="h-full w-full transition duration-500 group-hover:scale-105" textClass="text-6xl" />

        <div
          className={`absolute inset-0 grid place-items-center bg-forest-950/60 text-cream-50 transition ${
            uploading || dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {uploading ? (
            <LoaderCircle size={28} className="animate-spin" />
          ) : (
            <div className="px-3 text-center">
              <Camera size={26} className="mx-auto" />
              <p className="mt-2 text-sm font-semibold">
                {dragging ? "Déposez l'image" : cow.photo_url ? "Changer la photo" : "Ajouter une photo"}
              </p>
              <p className="text-[11px] text-cream-100/70">JPG, PNG, WebP · 5 Mo</p>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />

      {cow.photo_url && !uploading && (
        <button
          onClick={onRequestRemove}
          aria-label="Retirer la photo"
          className="absolute right-3 top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-forest-950/70 text-cream-50 backdrop-blur transition hover:bg-clay-500"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}