// Règles de conformité dérivées de l'analyse juridique du décret n° 2.22.431
// (analyse_juridique_commissions_procedure.pdf). Complète lib/procedures.ts :
// ce fichier contient les seuils, délais et pièces sous forme exploitable par
// le moteur de validation de l'assistant candidature. Guide informatif — seul
// le dossier de consultation et le texte réglementaire font foi.

import type { PrestationType } from "./procedures";

// ── Seuils (art. 19, 20, 23) ─────────────────────────────────────────────────

export const THRESHOLDS = {
  /** AO ouvert simplifié : montant estimé ≤ 1 000 000 DH HT (art. 19-I-1) */
  simplifiedMaxDH: 1_000_000,
  /** AO restreint : montant < 5 000 000 DH HT + nombre limité d'opérateurs (art. 20) */
  restrictedMaxDH: 5_000_000,
  /** Publicité portée à 40 jours au-delà des seuils fixés à l'art. 23 */
  extendedPublicityDays: 40,
} as const;

// ── Délais de publicité / procédure (jours minimum) ─────────────────────────

export const PUBLICITY_DAYS: Record<string, { days: number; note: string }> = {
  "appel-offres-ouvert": { days: 21, note: "40 jours au-delà des seuils de l'art. 23" },
  "appel-offres-ouvert-simplifie": { days: 10, note: "Portail + au moins un journal" },
  "appel-offres-restreint": { days: 10, note: "Lettre circulaire à au moins 3 concurrents" },
  "appel-offres-avec-preselection": { days: 15, note: "Avant la séance d'admission" },
  "dialogue-competitif": { days: 15, note: "Candidatures ; 30 jours pour les offres finales" },
  "procedure-negociee": { days: 10, note: "Avec publicité et mise en concurrence" },
};

export const WAITING_PERIOD_DAYS = 15; // délai d'attente avant approbation

// ── Déclaration sur l'honneur (art. 29) ──────────────────────────────────────
// Les mentions et attestations que la déclaration doit contenir.

export interface DeclarationItem {
  id: string;
  label: string;
  detail?: string;
  legalRef: string;
}

export const DECLARATION_HONNEUR_ITEMS: DeclarationItem[] = [
  {
    id: "identite",
    label: "Indications relatives au concurrent",
    detail:
      "Dénomination, forme juridique, capital, adresse, n° de téléphone, n° du registre de commerce, n° de la patente, n° d'affiliation à la CNSS, RIB.",
    legalRef: "Art. 29",
  },
  {
    id: "assurance",
    label: "Engagement de couverture par une police d'assurance",
    detail: "Couvrir les risques découlant de l'activité professionnelle.",
    legalRef: "Art. 29",
  },
  {
    id: "liquidation",
    label: "Attestation de non-liquidation judiciaire",
    legalRef: "Art. 27, 29",
  },
  {
    id: "redressement",
    label: "Attestation de non-redressement judiciaire",
    detail: "Sauf autorisation spéciale de justice.",
    legalRef: "Art. 27, 29",
  },
  {
    id: "fraude",
    label: "Engagement de non-recours à la fraude ou à la corruption",
    detail:
      "Ni par soi-même ni par personne interposée ; pas de dons, promesses ou présents pour influer sur la procédure ou l'exécution du marché.",
    legalRef: "Art. 29",
  },
  {
    id: "conflit",
    label: "Attestation d'absence de conflit d'intérêts",
    detail: "Avec les membres de la commission, du jury ou du maître d'ouvrage.",
    legalRef: "Art. 29, 162",
  },
  {
    id: "exclusion",
    label: "Attestation de non-exclusion des marchés publics",
    detail: "Aucune exclusion temporaire ou définitive prononcée (mesures coercitives).",
    legalRef: "Art. 29, 152",
  },
  {
    id: "preparation",
    label: "Attestation de non-participation à la préparation du dossier",
    detail: "Ne pas avoir participé à l'élaboration du dossier d'appel d'offres en cause.",
    legalRef: "Art. 27, 29",
  },
  {
    id: "exactitude",
    label: "Certification de l'exactitude des renseignements",
    detail: "Des mentions de la déclaration et des pièces fournies.",
    legalRef: "Art. 29",
  },
  {
    id: "sanctions",
    label: "Reconnaissance des sanctions en cas de fausse déclaration",
    detail:
      "Engagement d'actualiser la déclaration en cas de changement et reconnaissance des sanctions encourues (art. 152) en cas d'inexactitude.",
    legalRef: "Art. 29, 152",
  },
];

// ── Annotations juridiques des champs (info-bulles) ─────────────────────────

export interface FieldAnnotation {
  legalRef: string;
  summary: string;
  warning?: string;
}

export const FIELD_ANNOTATIONS: Record<string, FieldAnnotation> = {
  "procedure": {
    legalRef: "Art. 19-20",
    summary:
      "Le mode de passation détermine la publicité minimale, la commission compétente et les pièces exigées. L'AO ouvert est la procédure de droit commun.",
  },
  "montant": {
    legalRef: "Art. 19, 23",
    summary:
      "Le montant estimé HT conditionne l'accès aux procédures allégées (simplifié ≤ 1 000 000 DH, restreint < 5 000 000 DH) et les seuils de publicité étendue.",
  },
  "offre": {
    legalRef: "Décret 2.22.431 — contrôle des prix",
    summary:
      "La commission écarte les offres excessives (> +20 % de l'estimation) et examine les offres anormalement basses (< −20 % travaux, < −25 % fournitures/services) après demande de justifications.",
    warning: "Une offre excessive est écartée d'office ; préparez des justifications si votre prix est très bas.",
  },
  "declaration-honneur": {
    legalRef: "Art. 29",
    summary:
      "Document central du dossier administratif : identité du concurrent et attestations sur l'honneur (assurance, non-liquidation, non-fraude, absence de conflit d'intérêts, non-exclusion…).",
    warning: "Une déclaration inexacte expose à l'exclusion des marchés publics (art. 152).",
  },
  "cps": {
    legalRef: "Art. 28, 30",
    summary:
      "Le Cahier des Prescriptions Spéciales définit les clauses propres au marché. Il doit être paraphé sur toutes les pages et signé à la dernière (« lu et accepté »).",
    warning: "Un CPS non paraphé ou non signé entraîne le rejet du pli.",
  },
  "reglement-consultation": {
    legalRef: "Art. 28, 31",
    summary:
      "Le règlement de consultation fixe les critères d'admissibilité et d'attribution. À parapher et signer comme le CPS. C'est lui qui dit si une offre technique est exigée.",
  },
  "offre-financiere": {
    legalRef: "Art. 30",
    summary:
      "Acte d'engagement + bordereau des prix et détail estimatif (ou décomposition du montant global), établis conformément aux modèles du dossier.",
    warning: "Discordance chiffres/lettres : c'est en général le montant en lettres qui prévaut.",
  },
  "offre-technique": {
    legalRef: "Art. 31",
    summary:
      "Exigée uniquement si le règlement de consultation le prévoit : méthodologie, planning, moyens affectés, etc.",
  },
  "caution-provisoire": {
    legalRef: "Art. 30",
    summary:
      "Récépissé du cautionnement provisoire ou attestation de caution personnelle et solidaire en tenant lieu, lorsque le dossier l'exige (montant fixé dans l'avis).",
    warning: "L'absence de caution exigée entraîne le rejet de l'offre en séance d'ouverture.",
  },
  "attestation-fiscale": {
    legalRef: "Art. 27-28",
    summary:
      "Attestation du percepteur (moins d'un an) certifiant la situation fiscale régulière. Exigée au plus tard au stade de l'attribution envisagée.",
  },
  "cnss": {
    legalRef: "Art. 27-28",
    summary:
      "Attestation CNSS (moins d'un an) certifiant la situation régulière ; régime de prévoyance équivalent pour les concurrents non installés au Maroc.",
  },
  "qualifications": {
    legalRef: "Art. 28",
    summary:
      "Certificats de qualification/classification (travaux) ou agréments (études) exigés le cas échéant ; ils tiennent lieu de certaines pièces du dossier technique.",
  },
  "rib": {
    legalRef: "Art. 29",
    summary: "Le relevé d'identité bancaire figure parmi les indications de la déclaration sur l'honneur.",
  },
  "pouvoirs": {
    legalRef: "Art. 28",
    summary:
      "Justification des pouvoirs de la personne qui signe au nom du concurrent (statuts, PV, délégation…).",
  },
  "references": {
    legalRef: "Art. 28",
    summary:
      "Attestations de référence délivrées par les maîtres d'ouvrage, exigées pour les prestations non courantes (dispensées en AO simplifié).",
  },
};

// ── Validations intelligentes (feature C) ────────────────────────────────────

export type ComplianceLevel = "info" | "warning" | "error";

export interface ComplianceAlert {
  level: ComplianceLevel;
  legalRef: string;
  message: string;
  /** Slug de procédure proposé en remplacement, le cas échéant */
  suggestProcedure?: string;
}

export function checkProcedureThresholds(montantHT: number, procedureSlug: string): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  if (!montantHT || montantHT <= 0) return alerts;

  if (procedureSlug === "appel-offres-ouvert" && montantHT <= THRESHOLDS.simplifiedMaxDH) {
    alerts.push({
      level: "info",
      legalRef: "Art. 19-I-1",
      message:
        "Ce montant (≤ 1 000 000 DH HT) rend éligible l'appel d'offres ouvert simplifié : publicité réduite à 10 jours et dossier technique allégé.",
      suggestProcedure: "appel-offres-ouvert-simplifie",
    });
  }

  if (procedureSlug === "appel-offres-ouvert-simplifie" && montantHT > THRESHOLDS.simplifiedMaxDH) {
    alerts.push({
      level: "error",
      legalRef: "Art. 19-I-1",
      message:
        "L'appel d'offres ouvert simplifié est réservé aux marchés ≤ 1 000 000 DH HT. Au-delà, la procédure de droit commun s'impose.",
      suggestProcedure: "appel-offres-ouvert",
    });
  }

  if (procedureSlug === "appel-offres-restreint" && montantHT >= THRESHOLDS.restrictedMaxDH) {
    alerts.push({
      level: "error",
      legalRef: "Art. 20",
      message:
        "L'appel d'offres restreint est réservé aux marchés de moins de 5 000 000 DH HT portant sur des prestations exécutables par un nombre limité d'opérateurs.",
      suggestProcedure: "appel-offres-ouvert",
    });
  }

  if (procedureSlug === "appel-offres-ouvert" && montantHT > THRESHOLDS.simplifiedMaxDH) {
    alerts.push({
      level: "info",
      legalRef: "Art. 23",
      message:
        "Publicité minimale de 21 jours ; elle est portée à 40 jours si le marché dépasse les seuils fixés à l'article 23.",
    });
  }

  return alerts;
}

// ── Détection de procédure depuis les libellés du portail ────────────────────

export function guessProcedureSlug(procedureLabel: string | undefined | null): string {
  const label = (procedureLabel || "").toLowerCase();
  if (label.includes("simplifi")) return "appel-offres-ouvert-simplifie";
  if (label.includes("restreint")) return "appel-offres-restreint";
  if (label.includes("présélection") || label.includes("preselection")) return "appel-offres-avec-preselection";
  if (label.includes("concours")) return "concours";
  if (label.includes("dialogue")) return "dialogue-competitif";
  if (label.includes("négoci") || label.includes("negoci")) return "procedure-negociee";
  return "appel-offres-ouvert";
}

export function guessPrestationType(category: string | undefined | null): PrestationType {
  const c = (category || "").toLowerCase();
  if (c.startsWith("fourniture")) return "fournitures";
  if (c.startsWith("service")) return "services";
  return "travaux";
}

/** Parse un montant scrappé du portail ("1 234 567,89 MAD", "1.234.567,89 DH"…) */
export function parseMoney(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // points de milliers
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
