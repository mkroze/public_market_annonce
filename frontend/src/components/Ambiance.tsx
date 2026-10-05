/**
 * Couche d'ambiance : deux halos colorés, flous, qui dérivent lentement en
 * arrière-plan (z-0, non interactifs). Ils transparaissent derrière les cartes
 * blanches et donnent la profondeur « premium » de la référence. Coupés par le
 * bouton animations et par prefers-reduced-motion (cf. index.css).
 */
export default function Ambiance() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="ambiance-blob"
        style={{
          left: "-8rem",
          top: "-6rem",
          height: "26rem",
          width: "26rem",
          background: "color-mix(in srgb, var(--color-primary) 26%, transparent)",
        }}
      />
      <div
        className="ambiance-blob"
        style={{
          right: "-10rem",
          top: "10%",
          height: "30rem",
          width: "30rem",
          background: "color-mix(in srgb, var(--color-crimson-light) 26%, transparent)",
          animationDuration: "26s",
          animationDirection: "reverse",
        }}
      />
    </div>
  );
}
