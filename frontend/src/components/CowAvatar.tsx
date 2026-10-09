import { Wheat } from "lucide-react";
import { photoUrl, type CowPreview } from "../lib/api";

const GRADIENTS: Record<string, string> = {
  Holstein: "from-forest-700 to-forest-950",
  Montbéliarde: "from-clay-500 to-[#6e2f20]",
  "Brune des Alpes": "from-bark-600 to-bark-900",
  "Pie Rouge": "from-wheat-600 to-[#6f5419]",
};

type Props = { cow: CowPreview; className?: string; textClass?: string };

export default function CowAvatar({ cow, className = "", textClass = "text-lg" }: Props) {
  const src = photoUrl(cow.photo_url);
  const label = `${cow.name ?? "Vache"} #${cow.ear_tag}`;

  if (src) {
    return <img src={src} alt={label} loading="lazy" className={`object-cover ${className}`} />;
  }

  const initials = (cow.name ?? cow.ear_tag).slice(0, 2).toUpperCase();
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative grid place-items-center overflow-hidden bg-linear-to-br text-cream-50 ${
        GRADIENTS[cow.breed] ?? GRADIENTS.Holstein
      } ${className}`}
    >
      <Wheat aria-hidden className="absolute -bottom-[15%] -right-[15%] h-3/4 w-3/4 opacity-10" />
      <span className={`relative font-display ${textClass}`}>{initials}</span>
    </div>
  );
}