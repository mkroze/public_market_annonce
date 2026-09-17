// Sector taxonomy mirroring the backend `config.SECTORS` (décret n° 2.22.431
// classification). The code prefix carries the prestation category —
// 1.x = Travaux, 2.x = Fournitures, 3.x = Services — which is exactly how the
// backend `eligibility.classify` derives categories from sectors. Kept static so
// the onboarding wizard has stable, offline-safe options.

export interface SectorOption {
  code: string;
  name: string;
}

export interface SectorGroup {
  category: string;
  sectors: SectorOption[];
}

export const SECTOR_GROUPS: SectorGroup[] = [
  {
    category: "Travaux",
    sectors: [
      { code: "1.10", name: "Terrassements" },
      { code: "1.11", name: "Fondations, injections, parois moulées, sondages et forages" },
      { code: "1.12", name: "Travaux de voiries, chemins et pistes" },
      { code: "1.13", name: "Assainissement, eau potable et réseaux divers" },
      { code: "1.14", name: "Construction d'ouvrages d'art" },
      { code: "1.15", name: "Travaux de construction et d'aménagement" },
      { code: "1.16", name: "Travaux d'installation" },
      { code: "1.17", name: "Travaux d'électricité" },
      { code: "1.18", name: "Étanchéité, isolation, plomberie et menuiserie" },
      { code: "1.19", name: "Revêtement, plâtrerie et peinture" },
      { code: "1.21", name: "Travaux hydrauliques, maritimes et fluviaux" },
      { code: "1.22", name: "Aménagement de jardins, d'espaces verts" },
      { code: "1.23", name: "Travaux forestiers" },
    ],
  },
  {
    category: "Fournitures",
    sectors: [
      { code: "2.7", name: "Produits alimentaires, élevage, pêche, agriculture" },
      { code: "2.8", name: "Produits pétroliers, carburants, lubrifiants" },
      { code: "2.9", name: "Produits chimiques, nettoyage, insecticides" },
      { code: "2.10", name: "Matières premières, textile, cuir, caoutchouc, plastique" },
      { code: "2.11", name: "Effets d'habillement et accessoires" },
      { code: "2.12", name: "Matériel et articles de sport" },
      { code: "2.13", name: "Objets d'art, articles artistiques" },
      { code: "2.14", name: "Imprimés, produits d'impression, reproduction" },
      { code: "2.15", name: "Équipements et produits médicaux, pharmaceutiques" },
      { code: "2.16", name: "Matériaux de construction, plomberie, quincaillerie" },
      { code: "2.17", name: "Documentation, manuels, fournitures scolaires" },
      { code: "2.18", name: "Matériel informatique, logiciels" },
      { code: "2.19", name: "Matériel, mobilier et fournitures de bureau" },
      { code: "2.20", name: "Matériel et fournitures électriques, électroniques" },
      { code: "2.21", name: "Matériel technique, lutte contre l'incendie" },
      { code: "2.22", name: "Engins de chantier, manutention, levage" },
      { code: "2.23", name: "Matériel de transport, pièces de rechange" },
      { code: "2.24", name: "Matériel de literie, couchage, cuisine, buanderie" },
      { code: "2.25", name: "Location avec option d'achat" },
    ],
  },
  {
    category: "Services",
    sectors: [
      { code: "3.1", name: "Études, maîtrise d'œuvre, ingénierie" },
      { code: "3.2", name: "Informatique, télécommunications" },
      { code: "3.3", name: "Formation, organisation, ressources humaines" },
      { code: "3.4", name: "Restauration, hôtellerie, réception" },
      { code: "3.5", name: "Gardiennage, sécurité, nettoyage" },
      { code: "3.6", name: "Transport, déménagement" },
      { code: "3.7", name: "Location, assurances" },
      { code: "3.8", name: "Maintenance, entretien, réparation" },
      { code: "3.9", name: "Communication, publicité, édition" },
      { code: "3.10", name: "Contrôle, audit, expertise" },
    ],
  },
];

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  SECTOR_GROUPS.flatMap((g) => g.sectors.map((s) => [s.code, s.name])),
);

export function sectorName(code: string): string {
  return CODE_TO_NAME[code] ?? code;
}

/** Prestation category implied by a sector code prefix (mirrors the backend). */
export function sectorCategory(code: string): "Travaux" | "Fournitures" | "Services" | "" {
  const prefix = code.split(".")[0];
  if (prefix === "1") return "Travaux";
  if (prefix === "2") return "Fournitures";
  if (prefix === "3") return "Services";
  return "";
}
