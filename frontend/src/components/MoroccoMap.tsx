import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CityStats } from "../lib/types";

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
  // Prefecture / province names as returned by the API.
  "Tanger-Assilah": [35.76, -5.83],
  "Oujda-Angad": [34.68, -1.91],
  "Agadir Ida Ou Tanane": [30.42, -9.6],
  Jerada: [34.31, -2.16],
  "Sidi Bennour": [32.65, -8.43],
  "Oued Ed Dahab": [23.68, -15.94],
  Rehamna: [32.24, -7.95],
  Benslimane: [33.61, -7.12],
  Figuig: [32.11, -1.23],
  Taroudannt: [30.47, -8.88],
  Azilal: [31.96, -6.57],
  "Inezgane-Ait Melloul": [30.36, -9.54],
  Zagora: [30.33, -5.84],
  "El Kelaa Des Sraghna": [32.05, -7.41],
  Khenifra: [32.94, -5.67],
  Tinghir: [31.51, -5.53],
  Chichaoua: [31.54, -8.76],
  Taounate: [34.54, -4.64],
  Tata: [29.75, -7.97],
  "Mdiq-Fnideq": [35.68, -5.32],
  "Chtouka-Ait Baha": [30.06, -9.15],
  "Skhirate-Temara": [33.93, -6.91],
  "Al Haouz": [31.29, -7.87],
  Sefrou: [33.83, -4.83],
  Aousserd: [22.55, -14.33],
  Boulemane: [33.36, -4.73],
  "El Hajeb": [33.69, -5.37],
  "Es-Semara": [26.74, -11.67],
  Mediouna: [33.45, -7.51],
  "Moulay Yacoub": [34.09, -5.18],
  Nouaceur: [33.37, -7.58],
  Taourirt: [34.41, -2.89],
  Tarfaya: [27.94, -12.93],
};

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

// Marker palette per effective theme. Navy in light, lighter navy in dark to
// stay legible over the CARTO Dark Matter basemap.
const MARKER_COLORS = {
  light: { fill: "#00236f", stroke: "#001a52" },
  dark: { fill: "#b6c4ff", stroke: "#dce1ff" },
} as const;

const TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

type EffectiveTheme = "light" | "dark";

// Resolve the effective theme: honor an explicit light/dark preference on the
// <html> element, and fall back to the OS setting when the preference is
// "system" (the real-world default) or unset.
function resolveEffectiveTheme(): EffectiveTheme {
  if (typeof document === "undefined") return "light";
  const preference = document.documentElement.dataset.themePreference;
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

// Live effective-theme hook. Re-resolves on OS scheme changes and on
// data-theme-preference mutations of <html> so the basemap follows the app.
function useEffectiveTheme(): EffectiveTheme {
  const [theme, setTheme] = useState<EffectiveTheme>(resolveEffectiveTheme);

  useEffect(() => {
    const update = () => setTheme(resolveEffectiveTheme());
    update();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-preference"],
    });

    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return theme;
}

interface CityDot {
  city: CityStats;
  lat: number;
  lng: number;
  r: number;
}

// Fits the map to the plotted markers whenever the set of coordinates changes.
function FitBounds({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, bounds]);
  return null;
}

export default function MoroccoMap({ cities }: { cities: CityStats[] }) {
  const navigate = useNavigate();
  const theme = useEffectiveTheme();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const dots = useMemo<CityDot[]>(() => {
    const maxTotal = Math.max(...cities.map((city) => city.total), 1);
    return cities
      .flatMap((city) => {
        const coords = COORD_LOOKUP.get(normalizeCityName(city.name));
        if (!coords) return [];
        const r = 4 + 14 * Math.sqrt(city.total / maxTotal);
        return [{ city, lat: coords[0], lng: coords[1], r }];
      })
      // Biggest markers first so smaller dots paint on top and stay clickable
      // even where they overlap a large one.
      .sort((a, b) => b.r - a.r);
  }, [cities]);

  const bounds = useMemo(() => {
    if (dots.length === 0) return null;
    return new LatLngBounds(dots.map((dot) => [dot.lat, dot.lng] as [number, number]));
  }, [dots]);

  const goToCity = (name: string) =>
    navigate(`/tenders?location=${encodeURIComponent(name)}`);

  const colors = MARKER_COLORS[theme];

  if (dots.length === 0 || !bounds) return null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [28, 28] }}
        scrollWheelZoom={false}
        minZoom={4}
        maxZoom={10}
        className="h-[420px] w-full rounded border border-[var(--color-border-subtle)]"
        aria-label="Carte du Maroc : consultations par ville"
      >
        <TileLayer
          key={theme}
          url={TILE_URLS[theme]}
          attribution={TILE_ATTRIBUTION}
          subdomains="abcd"
          maxZoom={20}
        />
        <FitBounds bounds={bounds} />
        {dots.map((dot) => {
          const isActive = hoveredName === dot.city.name;
          return (
            <CircleMarker
              key={dot.city.name}
              center={[dot.lat, dot.lng]}
              radius={isActive ? dot.r * 1.35 : dot.r}
              pathOptions={{
                color: colors.stroke,
                weight: isActive ? 2 : 1,
                fillColor: colors.fill,
                fillOpacity: isActive ? 1 : 0.7,
              }}
              // Leaflet renders each CircleMarker as an SVG element. We promote it
              // to a keyboard-reachable link (tabindex + aria-label) and wire
              // focus/blur/keydown as native DOM listeners, since Leaflet's typed
              // event map only covers mouse/pointer events.
              interactive
              bubblingMouseEvents={false}
              eventHandlers={{
                mouseover: (event) => {
                  setHoveredName(dot.city.name);
                  event.target.openTooltip();
                },
                mouseout: (event) => {
                  setHoveredName(null);
                  event.target.closeTooltip();
                },
                click: () => goToCity(dot.city.name),
                add: (event) => {
                  const marker = event.target;
                  const el = marker.getElement() as SVGElement | null;
                  if (!el) return;
                  el.setAttribute("role", "link");
                  el.setAttribute("tabindex", "0");
                  el.setAttribute(
                    "aria-label",
                    `${dot.city.name} — ${dot.city.total} consultations, ${dot.city.active} actives`,
                  );
                  el.style.cursor = "pointer";
                  el.addEventListener("focus", () => {
                    setHoveredName(dot.city.name);
                    marker.openTooltip();
                  });
                  el.addEventListener("blur", () => {
                    setHoveredName(null);
                    marker.closeTooltip();
                  });
                  el.addEventListener("keydown", (nativeEvent) => {
                    const key = (nativeEvent as KeyboardEvent).key;
                    if (key === "Enter" || key === " ") {
                      nativeEvent.preventDefault();
                      goToCity(dot.city.name);
                    }
                  });
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                <div className="font-sans">
                  <div className="font-semibold">{dot.city.name}</div>
                  <div>
                    {dot.city.total.toLocaleString("fr-FR")} consultations ·{" "}
                    {dot.city.active.toLocaleString("fr-FR")} actives
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
