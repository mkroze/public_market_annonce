import type { Tender, TenderFilters, TenderWithDetails } from "./types";
import { getTenderUrgency } from "./tenderUtils";

export type GuidanceTone = "positive" | "warning" | "critical" | "neutral";

export interface TenderGuidance {
  label: string;
  tone: GuidanceTone;
  reasons: string[];
}

export interface DecisionChecklistItem {
  id: string;
  label: string;
  value: string;
  tone: GuidanceTone;
  action: string;
}

export interface GuidedTenderInput {
  activity: string;
  location: string;
  deadlineWindow: "any" | "7d" | "14d" | "30d";
  budgetRange: "any" | "small" | "medium" | "large";
}

function hasValue(value: string | undefined | null): value is string {
  return Boolean(value && value.trim());
}

export function getTenderGuidance(tender: Tender, now = new Date()): TenderGuidance {
  const urgency = getTenderUrgency(tender.deadline, now);
  const reasons: string[] = [];

  if (urgency?.expired) {
    return {
      label: "Expiree",
      tone: "critical",
      reasons: ["La date limite est deja passee."],
    };
  }

  if (urgency && urgency.days <= 3) {
    reasons.push("Delai tres court pour verifier le dossier.");
    return { label: "Delai court", tone: "critical", reasons };
  }

  if (urgency && urgency.days <= 7) {
    reasons.push("A verifier rapidement cette semaine.");
    return { label: "A verifier vite", tone: "warning", reasons };
  }

  if (hasValue(tender.estimation)) reasons.push("Estimation disponible pour cadrer l'opportunite.");
  if (hasValue(tender.location)) reasons.push("Localisation indiquee.");
  if (!hasValue(tender.estimation)) reasons.push("Budget a verifier dans le DCE.");

  return {
    label: hasValue(tender.estimation) ? "Facile a comparer" : "Budget a verifier",
    tone: hasValue(tender.estimation) ? "positive" : "neutral",
    reasons,
  };
}

export function getTenderDecisionChecklist(tender: TenderWithDetails, now = new Date()): DecisionChecklistItem[] {
  const details = tender.details;
  const urgency = getTenderUrgency(tender.deadline, now);

  return [
    {
      id: "deadline",
      label: "Delai de reponse",
      value: urgency ? `${tender.deadline} (${urgency.label})` : tender.deadline || "Non indique",
      tone: !urgency ? "warning" : urgency.expired || urgency.days <= 3 ? "critical" : urgency.days <= 7 ? "warning" : "positive",
      action: urgency?.expired
        ? "Ne pas poursuivre sans confirmation sur le portail source."
        : urgency && urgency.days <= 3
          ? "Verifier immediatement si le dossier est realiste."
          : !urgency
            ? "Verifier la date limite sur le portail source ou dans le DCE."
            : "Planifier la lecture du DCE.",
    },
    {
      id: "location",
      label: "Lieu d'execution",
      value: details?.lieu_execution || tender.location || "Non indique",
      tone: details?.lieu_execution || tender.location ? "neutral" : "warning",
      action: "Confirmer que votre entreprise peut intervenir dans cette zone.",
    },
    {
      id: "budget",
      label: "Estimation ou budget",
      value: details?.estimation || tender.estimation || "A verifier dans le DCE",
      tone: details?.estimation || tender.estimation ? "positive" : "warning",
      action: "Comparer ce montant avec votre capacite commerciale et financiere.",
    },
    {
      id: "caution",
      label: "Caution provisoire",
      value: details?.caution_provisoire || "A verifier dans le DCE",
      tone: details?.caution_provisoire ? "neutral" : "warning",
      action: "Verifier si une garantie bancaire est necessaire avant de preparer l'offre.",
    },
    {
      id: "qualifications",
      label: "Qualifications ou agrements",
      value: details?.qualifications || details?.agrements || "A verifier dans le DCE",
      tone: details?.qualifications || details?.agrements ? "warning" : "neutral",
      action: "Controler les certificats, agrements ou references demandes.",
    },
    {
      id: "documents",
      label: "Documents",
      value: details?.dce_url ? "DCE disponible" : "DCE a recuperer sur le portail",
      tone: details?.dce_url ? "positive" : "warning",
      action: "Telecharger le DCE et lire le reglement de consultation en premier.",
    },
  ];
}

export function buildGuidedTenderQuery(input: GuidedTenderInput): Partial<TenderFilters> {
  return {
    q: input.activity.trim(),
    location: input.location.trim(),
    status: "en_cours",
    sort: "deadline",
    order: "asc",
    page: 1,
    per_page: input.deadlineWindow === "any" ? 20 : 50,
  };
}
