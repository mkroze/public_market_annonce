import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CityStats } from "../lib/types";

const VIEW_SIZE = 600;
const BOUNDS = { latMin: 20.5, latMax: 36, lngMin: -17, lngMax: -1 };

// Stylized outline of Morocco (including the southern provinces), expressed
// directly in viewBox coordinates produced by the same linear projection below.
const MOROCCO_OUTLINE =
  "M416,4 L555,35 L574,50 L592,156 L499,194 L431,252 L311,310 L312,387 " +
  "L150,565 L2,588 L41,476 L94,383 L135,344 L214,290 L259,252 L278,217 " +
  "L270,174 L289,143 L319,106 L353,93 L383,77 L407,31 Z";

// [lat, lng] for major Moroccan cities. Keys are matched against API city
// names after accent/case normalization, so "Fes" and "Fès" both resolve.
const MOROCCO_CITY_COORDS: Record<string, [number, number]> = {
  Casablanca: [33.57, -7.59],
  Rabat: [34.02, -6.84],
  "Salé": [34.04, -6.8],
  "Fès": [34.03, -5.0],
  Marrakech: [31.63, -8.01],
  Tanger: [35.76, -5.83],
  Agadir: [30.42, -9.6],
  "Meknès": [33.9, -5.55],
  Oujda: [34.68, -1.91],
  "Kénitra": [34.26, -6.58],
  "Tétouan": [35.58, -5.37],
  "Témara": [33.93, -6.91],
  Safi: [32.3, -9.24],
  "Mohammédia": [33.69, -7.38],
  "El Jadida": [33.25, -8.51],
  "Béni Mellal": [32.34, -6.35],
  Nador: [35.17, -2.93],
  Khouribga: [32.88, -6.91],
  Settat: [33.0, -7.62],
  Berrechid: [33.27, -7.58],
  "Khémisset": [33.82, -6.07],
  Taza: [34.21, -4.01],
  Larache: [35.19, -6.16],
  "Ksar El Kébir": [35.0, -5.9],
  Guelmim: [28.99, -10.06],
  Errachidia: [31.93, -4.42],
  Ouarzazate: [30.92, -6.91],
  Essaouira: [31.51, -9.77],
  Tiznit: [29.7, -9.73],
  Taroudant: [30.47, -8.88],
  "Laâyoune": [27.15, -13.2],
  Dakhla: [23.68, -15.94],
  "Al Hoceïma": [35.25, -3.94],
  Berkane: [34.92, -2.32],
  "Fquih Ben Salah": [32.5, -6.68],
  Ouezzane: [34.8, -5.58],
  "Sidi Kacem": [34.22, -5.71],
  "Sidi Slimane": [34.26, -5.93],
  Midelt: [32.68, -4.74],
  Chefchaouen: [35.17, -5.27],
  Ifrane: [33.53, -5.11],
  Azrou: [33.44, -5.22],
  Boujdour: [26.13, -14.48],
  "Tan-Tan": [28.44, -11.1],
  Smara: [26.74, -11.67],
  Guercif: [34.23, -3.35],
  Youssoufia: [32.25, -8.53],
  Benguerir: [32.24, -7.95],
  Skhirat: [33.85, -7.03],
  Bouskoura: [33.45, -7.65],
  Inezgane: [30.36, -9.54],
};

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * VIEW_SIZE;
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * VIEW_SIZE;
  return [x, y];
}

function normalizeCityName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();
}

const COORD_LOOKUP = new Map(
  Object.entries(MOROCCO_CITY_COORDS).map(([name, coords]) => [normalizeCityName(name), coords]),
);

interface CityDot {
  city: CityStats;
  x: number;
  y: number;
  r: number;
}

export default function MoroccoMap({ cities }: { cities: CityStats[] }) {
  const navigate = useNavigate();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const dots = useMemo<CityDot[]>(() => {
    const maxTotal = Math.max(...cities.map((city) => city.total), 1);
    return cities
      .flatMap((city) => {
        const coords = COORD_LOOKUP.get(normalizeCityName(city.name));
        if (!coords) return [];
        const [x, y] = project(coords[0], coords[1]);
        const r = 4 + 14 * Math.sqrt(city.total / maxTotal);
        return [{ city, x, y, r }];
      })
      .sort((a, b) => b.r - a.r);
  }, [cities]);

  // dots is sorted by radius (= total) descending, so the first 6 are the
  // biggest cities; they get permanent labels, the rest are tooltip-only.
  const labeledNames = useMemo(
    () => new Set(dots.slice(0, 6).map((dot) => dot.city.name)),
    [dots],
  );

  const hoveredDot = dots.find((dot) => dot.city.name === hoveredName) ?? null;

  const goToCity = (name: string) =>
    navigate(`/tenders?location=${encodeURIComponent(name)}`);

  if (dots.length === 0) return null;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="block w-full h-auto"
        role="img"
        aria-label="Carte du Maroc : consultations par ville"
      >
        <path
          d={MOROCCO_OUTLINE}
          fill="var(--color-ivory-dim)"
          stroke="var(--color-border-subtle)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {dots.map((dot, index) => (
          <g key={`${dot.city.name}-${index}`}>
            {labeledNames.has(dot.city.name) && (
              <text
                x={dot.x + dot.r + 5}
                y={dot.y + 4}
                fontSize={15}
                fill="var(--color-slate)"
                className="pointer-events-none select-none font-sans"
              >
                {dot.city.name}
              </text>
            )}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="var(--color-crimson)"
              role="link"
              tabIndex={0}
              aria-label={`${dot.city.name} — ${dot.city.total} consultations, ${dot.city.active} actives`}
              className="cursor-pointer focus:outline-none"
              style={{
                opacity: hoveredName === dot.city.name ? 1 : 0.55,
                transform: hoveredName === dot.city.name ? "scale(1.4)" : "scale(1)",
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: "transform 150ms ease, opacity 150ms ease",
              }}
              onMouseEnter={() => setHoveredName(dot.city.name)}
              onMouseLeave={() => setHoveredName(null)}
              onFocus={() => setHoveredName(dot.city.name)}
              onBlur={() => setHoveredName(null)}
              onClick={() => goToCity(dot.city.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToCity(dot.city.name);
                }
              }}
            />
          </g>
        ))}
      </svg>
      {hoveredDot && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 shadow-sm font-sans text-xs"
          style={{
            left: `${(hoveredDot.x / VIEW_SIZE) * 100}%`,
            top: `${(hoveredDot.y / VIEW_SIZE) * 100}%`,
            marginTop: "-3rem",
          }}
        >
          <div className="font-semibold text-[var(--color-charcoal)] whitespace-nowrap">
            {hoveredDot.city.name}
          </div>
          <div className="text-[var(--color-slate)] whitespace-nowrap">
            {hoveredDot.city.total.toLocaleString("fr-FR")} consultations ·{" "}
            {hoveredDot.city.active.toLocaleString("fr-FR")} actives
          </div>
        </div>
      )}
    </div>
  );
}
