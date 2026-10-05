import { Heart } from "lucide-react";

interface Props {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

// Small heart toggle for following a tender. It lives inside cards/rows that are
// themselves links, so it stops the click from bubbling into navigation.
export default function FavoriteButton({ active, onToggle, className = "" }: Props) {
  return (
    <button
      type="button"
      aria-label={active ? "Retirer des consultations suivies" : "Suivre cette consultation"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex items-center justify-center transition-colors motion-reduce:transition-none ${className}`}
    >
      <Heart
        size={16}
        className={
          active
            ? "fill-[var(--color-primary)] text-[var(--color-primary)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        }
      />
    </button>
  );
}
