import type { DisplayValue, Tender, TenderFilters, TenderWithDetails } from "./types";
import { isHighConfidenceDetected } from "./displayValues";
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

function confirmedText(value: DisplayValue | undefined): string | undefined {
  if (!value || !isHighConfidenceDetected(value)) return undefined;
  return typeof value.value === "boolean" ? (value.value ? "Disponible" : undefined) : String(value.value);
}

export function getTenderGuidance(tender: Tender, now = new Date()): TenderGuidance {
  const urgency = getTenderUrgency(tender.deadline, now);
  const reasons: string[] = [];

  if (urgency?.expired) {
    return {
      label: "Expirée",
      tone: "critical",
      reasons: ["La date limite est déjà passée."],
    };
  }

  if (urgency && urgency.days <= 3) {
    reasons.push("Délai très court pour vérifier le dossier.");
    return { label: "Délai court", tone: "critical", reasons };
  }

  if (urgency && urgency.days <= 7) {
    reasons.push("À vérifier rapidement cette semaine.");
    return { label: "À vérifier vite", tone: "warning", reasons };
  }

  if (!urgency) {
    return {
      label: "Date limite à vérifier",
      tone: "warning",
      reasons: ["Vérifier la date limite sur le portail source ou dans le DCE."],
    };
  }

  if (hasValue(tender.estimation)) reasons.push("Estimation disponible pour cadrer l'opportunité.");
  if (hasValue(tender.location)) reasons.push("Localisation indiquée.");
  if (!hasValue(tender.estimation)) reasons.push("Budget à vérifier dans le DCE.");

  return {
    label: hasValue(tender.estimation) ? "Facile à comparer" : "Budget à vérifier",
    tone: hasValue(tender.estimation) ? "positive" : "neutral",
    reasons,
  };
}

export function getTenderDecisionChecklist(tender: TenderWithDetails, now = new Date()): DecisionChecklistItem[] {
  const details = tender.details;
  const deadline = tender.display ? confirmedText(tender.display.deadline) || "" : tender.deadline;
  const urgency = getTenderUrgency(deadline, now);
  const location = tender.display
    ? confirmedText(tender.display.location)
    : hasValue(details?.lieu_execution)
      ? details.lieu_execution
      : hasValue(tender.location)
        ? tender.location
        : "";
  const estimation = tender.signals
    ? confirmedText(tender.signals.estimation)
    : hasValue(details?.estimation)
      ? details.estimation
      : hasValue(tender.estimation)
        ? tender.estimation
        : "";
  const caution = tender.signals
    ? confirmedText(tender.signals.caution)
    : hasValue(details?.caution_provisoire)
      ? details.caution_provisoire
      : "";
  const qualifications = hasValue(details?.qualifications)
    ? details.qualifications
    : hasValue(details?.agrements)
      ? details.agrements
      : "";
  const hasDceUrl = tender.signals
    ? confirmedText(tender.signals.dce_available) === "Disponible"
    : hasValue(details?.dce_url);

  return [
    {
      id: "deadline",
      label: "Délai de réponse",
      value: urgency ? `${deadline} (${urgency.label})` : deadline || "Non indiqué",
      tone: !urgency ? "warning" : urgency.expired || urgency.days <= 3 ? "critical" : urgency.days <= 7 ? "warning" : "positive",
      action: urgency?.expired
        ? "Ne pas poursuivre sans confirmation sur le portail source."
        : urgency && urgency.days <= 3
          ? "Vérifier immédiatement si le dossier est réaliste."
          : !urgency
            ? "Vérifier la date limite sur le portail source ou dans le DCE."
            : "Planifier la lecture du DCE.",
    },
    {
      id: "location",
      label: "Lieu d'exécution",
      value: location || "Non indiqué",
      tone: location ? "neutral" : "warning",
      action: "Confirmer que votre entreprise peut intervenir dans cette zone.",
    },
    {
      id: "budget",
      label: "Estimation ou budget",
      value: estimation || "À vérifier dans le DCE",
      tone: estimation ? "positive" : "warning",
      action: "Comparer ce montant avec votre capacité commerciale et financière.",
    },
    {
      id: "caution",
      label: "Caution provisoire",
      value: caution || "À vérifier dans le DCE",
      tone: caution ? "neutral" : "warning",
      action: "Vérifier si une garantie bancaire est nécessaire avant de préparer l'offre.",
    },
    {
      id: "qualifications",
      label: "Qualifications ou agréments",
      value: qualifications || "À vérifier dans le DCE",
      tone: qualifications ? "warning" : "neutral",
      action: "Contrôler les certificats, agréments ou références demandés.",
    },
    {
      id: "documents",
      label: "Documents",
      value: hasDceUrl ? "DCE disponible" : "DCE à récupérer sur le portail",
      tone: hasDceUrl ? "positive" : "warning",
      action: "Télécharger le DCE et lire le règlement de consultation en premier.",
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
