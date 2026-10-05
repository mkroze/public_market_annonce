// Données de référence dérivées de l'analyse juridique du décret n° 2.22.431
// du 8 mars 2023 relatif aux marchés publics (analyse_juridique_commissions_procedure.pdf).
// Ces données sont un guide informatif : le texte applicable dépend de la date
// de lancement de la procédure (régime transitoire du décret de 2013).

export type ChecklistPhase = "soumission" | "attribution" | "reglement";

export interface ChecklistItem {
  label: string;
  phase: ChecklistPhase;
  note?: string;
}

export interface ProcedureStage {
  label: string;
  detail?: string;
}

export interface DeadlineRule {
  label: string;
  days: string;
  detail?: string;
}

export interface LegalRef {
  ref: string;
  topic: string;
}

export interface Procedure {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  seuil?: string;
  publiciteMin?: string;
  commission: string;
  commissionDetail: string[];
  commissionNote?: string;
  stages: ProcedureStage[];
  deadlines: DeadlineRule[];
  checklist: ChecklistItem[];
  checklistNote?: string;
  legalRefs: LegalRef[];
}

// Pièces communes de l'appel d'offres (art. 28 à 31)
const CHECKLIST_AO: ChecklistItem[] = [
  { label: "Pouvoirs du signataire", phase: "soumission" },
  { label: "Déclaration sur l'honneur (art. 29)", phase: "soumission" },
  { label: "Convention de groupement", phase: "soumission", note: "Le cas échéant" },
  { label: "Dossier technique : note sur les moyens humains et techniques", phase: "soumission" },
  { label: "Attestations de référence", phase: "soumission", note: "Prestations non courantes" },
  { label: "Déclaration du plan de charge", phase: "reglement", note: "Si exigée" },
  { label: "Pièces justifiant les capacités financières", phase: "soumission", note: "Prestations non courantes" },
  { label: "Certificats de qualification/classification ou agrément", phase: "soumission", note: "Le cas échéant, tenant lieu de certaines pièces" },
  { label: "CPS paraphé et signé", phase: "soumission" },
  { label: "Règlement de consultation paraphé et signé", phase: "soumission" },
  { label: "Offre financière (acte d'engagement, bordereaux, détails estimatifs)", phase: "soumission" },
  { label: "Offre technique", phase: "reglement", note: "Si le règlement de consultation l'exige (art. 31)" },
  { label: "Attestation fiscale", phase: "attribution" },
  { label: "Attestation CNSS ou régime de prévoyance équivalent", phase: "attribution" },
];

export const STAGES_COMMON = [
  "Publication",
  "Candidature",
  "Ouverture des plis",
  "Évaluation",
  "Proposition d'attribution",
  "Délai d'attente",
  "Approbation",
] as const;

export const PROCEDURES: Procedure[] = [
  {
    slug: "appel-offres-ouvert",
    name: "Appel d'offres ouvert",
    shortName: "AO ouvert",
    description:
      "Procédure de droit commun : tout concurrent remplissant les conditions de l'article 27 peut soumissionner. Publicité sur le portail des marchés publics et dans deux journaux à diffusion nationale, dont un en arabe.",
    publiciteMin: "21 jours",
    commission: "Commission d'appel d'offres",
    commissionDetail: [
      "Présidée par le maître d'ouvrage.",
      "État : deux représentants de l'administration concernée, un représentant de la TGR et, au-delà de 50 000 000 DH HT, un représentant du ministère chargé des finances.",
      "Établissements publics : deux représentants de l'organisme, représentant du ministre chargé des finances selon le contrôle financier applicable, responsable des achats et responsable financier le cas échéant.",
      "Collectivités territoriales : DGS/directeur des services, chef du service des marchés, chef du service concerné et comptable public assignataire.",
      "Possibilité de consulter des experts ou techniciens, ou d'instituer une sous-commission.",
    ],
    stages: [
      { label: "Publication", detail: "Portail + 2 journaux (dont 1 en arabe), 21 jours min avant l'ouverture (40 jours au-delà des seuils de l'art. 23)" },
      { label: "Ouverture des plis", detail: "Séance publique ; report de 48 h possible en cas d'absence de membres obligatoires" },
      { label: "Évaluation", detail: "Examen à huis clos des dossiers, ouverture publique des offres financières, contrôle des prix excessifs / anormalement bas" },
      { label: "Proposition d'attribution", detail: "La commission propose l'offre au maître d'ouvrage ; extrait du PV publié sous 24 h, affiché 15 jours min" },
      { label: "Délai d'attente", detail: "15 jours à compter du jour suivant l'achèvement des travaux de la commission" },
      { label: "Approbation", detail: "Notification dans un délai maximum de 60 jours à compter de l'ouverture des plis" },
    ],
    deadlines: [
      { label: "Publicité minimale", days: "21 jours", detail: "Avant la séance d'ouverture des plis" },
      { label: "Publicité (seuils art. 23)", days: "40 jours", detail: "Pour certains marchés dépassant les seuils fixés à l'article 23" },
      { label: "Validité des offres", days: "60 jours" },
      { label: "Délai d'attente avant approbation", days: "15 jours", detail: "Prorogeable de 15 jours en cas de réclamation" },
      { label: "Notification de l'approbation", days: "60 jours max", detail: "À compter de l'ouverture des plis" },
    ],
    checklist: CHECKLIST_AO,
    legalRefs: [
      { ref: "Art. 19-20", topic: "Modes de passation" },
      { ref: "Art. 23", topic: "Seuils de publicité" },
      { ref: "Art. 27", topic: "Conditions d'éligibilité" },
      { ref: "Art. 28-31", topic: "Dossiers et offres" },
      { ref: "Art. 38-48", topic: "Commission et déroulement" },
      { ref: "Art. 142-143", topic: "Approbation et délais" },
    ],
  },
  {
    slug: "appel-offres-ouvert-simplifie",
    name: "Appel d'offres ouvert simplifié",
    shortName: "AO simplifié",
    description:
      "Variante allégée de l'appel d'offres ouvert pour les marchés dont le montant estimé est inférieur ou égal à 1 000 000 DH HT. Publicité et dossier technique allégés.",
    seuil: "≤ 1 000 000 DH HT",
    publiciteMin: "10 jours",
    commission: "Commission d'appel d'offres ouvert simplifié",
    commissionDetail: [
      "Composition allégée : le président, un membre désigné par le maître d'ouvrage et un représentant de la TGR ou du ministère chargé des finances selon le cas.",
    ],
    stages: [
      { label: "Publication", detail: "Portail + au moins un journal, 10 jours min avant l'ouverture" },
      { label: "Ouverture des plis", detail: "Séance publique" },
      { label: "Évaluation", detail: "Régime de l'appel d'offres ouvert" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours" },
      { label: "Approbation" },
    ],
    deadlines: [
      { label: "Publicité minimale", days: "10 jours", detail: "Portail + au moins un journal" },
      { label: "Seuil de recours à la procédure", days: "≤ 1 000 000 DH HT" },
      { label: "Délai d'attente avant approbation", days: "15 jours" },
    ],
    checklist: CHECKLIST_AO.filter(
      (i) => i.label !== "Attestations de référence" && i.label !== "Déclaration du plan de charge"
    ),
    checklistNote:
      "Le dossier technique ne comprend ni les attestations de référence ni la déclaration du plan de charge.",
    legalRefs: [
      { ref: "Art. 19-I-1", topic: "Définition et seuil" },
      { ref: "Art. 27", topic: "Conditions d'éligibilité" },
      { ref: "Art. 28-31", topic: "Dossiers et offres" },
    ],
  },
  {
    slug: "appel-offres-restreint",
    name: "Appel d'offres restreint",
    shortName: "AO restreint",
    description:
      "Consultation limitée : lettre circulaire adressée à au moins trois concurrents. Réservé aux marchés de moins de 5 000 000 DH HT portant sur des prestations qui ne peuvent être exécutées que par un nombre limité d'opérateurs.",
    seuil: "< 5 000 000 DH HT",
    publiciteMin: "10 jours",
    commission: "Commission d'appel d'offres",
    commissionDetail: [
      "Pas de commission distincte : l'appel d'offres restreint est jugé par la commission d'appel d'offres de droit commun (art. 38).",
    ],
    stages: [
      { label: "Lettre circulaire", detail: "Envoyée à au moins 3 concurrents, 10 jours min avant l'ouverture" },
      { label: "Ouverture des plis", detail: "Séance publique" },
      { label: "Évaluation", detail: "Régime général de l'appel d'offres" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours" },
      { label: "Approbation" },
    ],
    deadlines: [
      { label: "Envoi de la lettre circulaire", days: "10 jours min", detail: "Avant l'ouverture des plis, à au moins 3 concurrents" },
      { label: "Seuil de recours à la procédure", days: "< 5 000 000 DH HT", detail: "Et prestations exécutables par un nombre limité d'opérateurs" },
      { label: "Délai d'attente avant approbation", days: "15 jours" },
    ],
    checklist: CHECKLIST_AO,
    legalRefs: [
      { ref: "Art. 19-I-1", topic: "Définition" },
      { ref: "Art. 20, 23-II", topic: "Conditions de recours" },
      { ref: "Art. 27-31", topic: "Éligibilité et dossiers" },
      { ref: "Art. 38-48", topic: "Commission et déroulement" },
    ],
  },
  {
    slug: "appel-offres-avec-preselection",
    name: "Appel d'offres avec présélection",
    shortName: "AO présélection",
    description:
      "Procédure en deux temps : une phase d'admission des candidats sur dossier, puis une phase d'offres réservée aux candidats admis. Les capacités techniques et financières sont appréciées au stade de l'admission.",
    publiciteMin: "15 jours",
    commission: "Commission d'appel d'offres avec présélection",
    commissionDetail: [
      "Composition identique à celle de la commission d'appel d'offres ordinaire, par renvoi exprès à l'article 38.",
    ],
    stages: [
      { label: "Publication", detail: "15 jours min avant la séance d'admission" },
      { label: "Candidature", detail: "Dossier d'admission : pouvoirs, déclaration sur l'honneur, demande d'admission, convention de groupement le cas échéant" },
      { label: "Admission", detail: "Appréciation des capacités techniques et financières" },
      { label: "Ouverture des plis", detail: "Offres des seuls candidats admis" },
      { label: "Évaluation" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours" },
      { label: "Approbation" },
    ],
    deadlines: [
      { label: "Publicité minimale", days: "15 jours", detail: "Avant la séance d'admission" },
      { label: "Validité des offres", days: "60 jours", detail: "À compter de l'ouverture des plis des admis" },
      { label: "Délai d'attente avant approbation", days: "15 jours" },
    ],
    checklist: [
      { label: "Pouvoirs du signataire", phase: "soumission" },
      { label: "Déclaration sur l'honneur", phase: "soumission" },
      { label: "Demande d'admission", phase: "soumission" },
      { label: "Convention de groupement", phase: "soumission", note: "Le cas échéant" },
      { label: "Texte habilitant à exercer les missions", phase: "soumission", note: "Établissements publics" },
      { label: "Note sur les moyens humains et techniques", phase: "soumission" },
      { label: "Attestations de référence", phase: "soumission" },
      { label: "Plan de charge", phase: "reglement", note: "Si exigé" },
      { label: "Pièces sur les capacités financières", phase: "soumission" },
      { label: "Certificats de qualification/classification/agrément", phase: "soumission", note: "Le cas échéant" },
      { label: "Cautionnement provisoire (original)", phase: "attribution", note: "Peut être exigé au stade d'évaluation des offres, après admission" },
      { label: "Attestations finales (fiscale, CNSS)", phase: "attribution", note: "Au stade de l'attribution envisagée" },
    ],
    legalRefs: [
      { ref: "Art. 19-I-2", topic: "Définition" },
      { ref: "Art. 49-65", topic: "Déroulement" },
      { ref: "Art. 53-54", topic: "Dossiers d'admission" },
    ],
  },
  {
    slug: "concours",
    name: "Concours",
    shortName: "Concours",
    description:
      "Procédure en deux temps mettant en compétition des projets (conception). Le jury évalue les projets à huis clos et les note selon des pondérations fixées par le décret.",
    commission: "Jury du concours",
    commissionDetail: [
      "Composition de la commission d'appel d'offres (art. 38), augmentée d'un représentant du département ministériel concerné par le domaine du concours.",
      "Notation : 80 % pour le projet et 20 % pour le coût hors taxes lorsque le concours porte uniquement sur la conception ; dans les cas de l'article 66, 70 % projet / 20 % coût global / 10 % offre financière (art. 82).",
    ],
    stages: [
      { label: "Publication", detail: "Selon le programme et le règlement du concours" },
      { label: "Candidature", detail: "Dossier d'admission (art. 54, régime de l'art. 53 II)" },
      { label: "Admission", detail: "Les admis reçoivent la lettre d'admission" },
      { label: "Dépôt des projets", detail: "Projets et pièces exigés par la lettre d'admission" },
      { label: "Évaluation", detail: "Huis clos ; écartement des projets dépassant le budget prévisionnel maximum ; classement noté" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours" },
      { label: "Approbation" },
    ],
    deadlines: [
      { label: "Délais de la procédure", days: "Selon programme", detail: "Fixés par le programme et le règlement du concours" },
      { label: "Validité", days: "À compter de l'ouverture des plis" },
      { label: "Délai d'attente avant approbation", days: "15 jours" },
    ],
    checklist: [
      { label: "Dossier d'admission (art. 54)", phase: "soumission" },
      { label: "Projets et pièces exigés par la lettre d'admission", phase: "reglement", note: "Le contenu exact dépend du programme et du règlement du concours" },
    ],
    checklistNote:
      "Le contenu détaillé des projets dépend du programme du concours, du règlement du concours et de la lettre d'admission : il n'existe pas d'inventaire unique comparable à l'article 30.",
    legalRefs: [
      { ref: "Art. 66-86", topic: "Régime du concours" },
      { ref: "Art. 71-82", topic: "Déroulement et notation" },
      { ref: "Art. 53-54", topic: "Admission" },
    ],
  },
  {
    slug: "dialogue-competitif",
    name: "Dialogue compétitif",
    shortName: "Dialogue compétitif",
    description:
      "Procédure autonome pour les projets complexes ou innovants (art. 12). Admission des candidats, phases de dialogue avec le maître d'ouvrage, puis remise et examen des offres finales.",
    publiciteMin: "15 jours",
    commission: "Commission d'admission puis commission d'ouverture et d'examen (art. 12)",
    commissionDetail: [
      "Admission des candidats : commission constituée conformément à l'article 55.",
      "Phase de dialogue : conduite par le maître d'ouvrage assisté d'au moins deux représentants de son administration, dont l'un du service concerné.",
      "Offres finales : ouverture, examen, évaluation et classement par la commission visée au A du II de l'article 12.",
    ],
    commissionNote:
      "Le texte ne crée pas de « commission de dialogue » pour la phase dialoguée : il prévoit une assistance au maître d'ouvrage, pas un jury autonome.",
    stages: [
      { label: "Publication", detail: "15 jours min entre la publication de l'avis et la réception des candidatures" },
      { label: "Candidature", detail: "Dossiers constitués selon la logique de la présélection (art. 53 II) ; minimum 2 candidats admis" },
      { label: "Dialogue", detail: "Maître d'ouvrage assisté d'au moins 2 représentants" },
      { label: "Offres finales", detail: "30 jours min après l'envoi de la lettre d'invitation" },
      { label: "Évaluation", detail: "Ouverture, examen et classement par la commission de l'art. 12" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours" },
      { label: "Approbation" },
    ],
    deadlines: [
      { label: "Réception des candidatures", days: "15 jours min", detail: "Après la publication de l'avis" },
      { label: "Remise des offres finales", days: "30 jours min", detail: "Après l'envoi de la lettre d'invitation" },
      { label: "Candidats admis", days: "2 minimum" },
      { label: "Délai d'attente avant approbation", days: "15 jours" },
    ],
    checklist: [
      { label: "Dossier de candidature (logique présélection, art. 53 II)", phase: "soumission" },
      { label: "CPS paraphé et signé", phase: "soumission", note: "Offre finale" },
      { label: "Offre financière", phase: "soumission", note: "Offre finale" },
      { label: "Éléments supplémentaires", phase: "reglement", note: "Non spécifiés par l'art. 12 ; toute exigence supplémentaire résulte du dossier ou du règlement de consultation" },
    ],
    checklistNote:
      "Les offres finales ne doivent comprendre, selon l'article 12, que le CPS paraphé et signé et l'offre financière.",
    legalRefs: [
      { ref: "Art. 12", topic: "Régime du dialogue compétitif" },
      { ref: "Art. 53-57", topic: "Candidatures et admission" },
      { ref: "Art. 21, 42, 45-48", topic: "Renvois" },
    ],
  },
  {
    slug: "procedure-negociee",
    name: "Procédure négociée",
    shortName: "Négociée",
    description:
      "Procédure plus souple, avec ou sans publicité et mise en concurrence. Les négociations peuvent porter sur le prix, le délai, la date d'achèvement ou de livraison et les conditions d'exécution — jamais sur l'objet ou la consistance du marché.",
    publiciteMin: "10 jours (avec publicité)",
    commission: "Commission de négociation",
    commissionDetail: [
      "Le président, son suppléant et deux représentants de l'organisme concerné.",
      "Possibilité de recourir à des experts et techniciens.",
    ],
    commissionNote:
      "La séance publique d'ouverture n'est pas prévue comme principe général de cette procédure : non spécifiée par le texte.",
    stages: [
      { label: "Publication", detail: "Avec publicité : avis, 10 jours min avant la date limite des candidatures. Sans publicité : négociation directe avec le ou les concurrents consultés" },
      { label: "Candidature", detail: "Dossier administratif et technique complet (art. 28) dès le début de la procédure" },
      { label: "Négociation", detail: "Sur le prix, le délai, la livraison et les conditions d'exécution ; documentée par rapport" },
      { label: "Proposition d'attribution" },
      { label: "Délai d'attente", detail: "15 jours à compter de la signature du marché par l'attributaire" },
      { label: "Approbation", detail: "Notification sous 60 jours à compter de la signature par l'attributaire" },
    ],
    deadlines: [
      { label: "Publicité minimale (avec mise en concurrence)", days: "10 jours", detail: "Avant la date limite de réception des candidatures" },
      { label: "Délais de négociation", days: "Non spécifié" },
      { label: "Délai d'attente avant approbation", days: "15 jours", detail: "À compter de la signature par l'attributaire" },
      { label: "Régularisation (urgence art. 89-II-7)", days: "3 mois", detail: "Si échange de lettres ou convention spéciale pour urgence" },
    ],
    checklist: [
      { label: "Dossier administratif complet (art. 28)", phase: "soumission", note: "Exigé dès le début de la procédure (art. 87)" },
      { label: "Dossier technique complet (art. 28)", phase: "soumission" },
      { label: "Certificat administratif justifiant l'exception", phase: "soumission", note: "Sans publicité, sauf cas expressément dispensés" },
      { label: "Acte d'engagement, offre technique, bordereaux (modèles art. 88)", phase: "reglement", note: "Marché négocié avec publicité" },
      { label: "Attestation fiscale et CNSS", phase: "attribution" },
    ],
    legalRefs: [
      { ref: "Art. 87", topic: "Dossiers de candidature" },
      { ref: "Art. 88", topic: "Dossier du marché négocié avec publicité" },
      { ref: "Art. 89-90", topic: "Cas de recours" },
      { ref: "Art. 142-143", topic: "Approbation et délais" },
    ],
  },
];

export function getProcedure(slug: string): Procedure | undefined {
  return PROCEDURES.find((p) => p.slug === slug);
}

// --- Éligibilité (art. 27) ---

export type EligibilityKind = "capacite" | "regularite" | "exclusion";

export interface EligibilityQuestion {
  id: string;
  question: string;
  kind: EligibilityKind;
  help?: string;
  legalRef: string;
}

export const ELIGIBILITY_QUESTIONS: EligibilityQuestion[] = [
  {
    id: "capacite-juridique",
    question: "Disposez-vous de la capacité juridique requise ?",
    kind: "capacite",
    help: "Personne physique ou morale régulièrement constituée, pouvoirs du signataire en règle.",
    legalRef: "Art. 27",
  },
  {
    id: "capacite-technique",
    question: "Justifiez-vous des capacités techniques requises ?",
    kind: "capacite",
    help: "Moyens humains et techniques, références pour les prestations non courantes.",
    legalRef: "Art. 27-28",
  },
  {
    id: "capacite-financiere",
    question: "Justifiez-vous des capacités financières requises ?",
    kind: "capacite",
    legalRef: "Art. 27-28",
  },
  {
    id: "activite-liee",
    question: "Exercez-vous une activité en rapport avec l'objet du marché ?",
    kind: "capacite",
    legalRef: "Art. 27",
  },
  {
    id: "regularite-fiscale",
    question: "Êtes-vous en situation fiscale régulière ?",
    kind: "regularite",
    help: "L'attestation fiscale est exigée au plus tard lorsque l'attribution est envisagée.",
    legalRef: "Art. 27-28",
  },
  {
    id: "regularite-sociale",
    question: "Êtes-vous affilié et à jour vis-à-vis de la CNSS (ou régime équivalent) ?",
    kind: "regularite",
    help: "Pour les concurrents non installés au Maroc : équivalents du pays d'origine.",
    legalRef: "Art. 27-28",
  },
  {
    id: "liquidation",
    question: "Êtes-vous en liquidation judiciaire ?",
    kind: "exclusion",
    legalRef: "Art. 27",
  },
  {
    id: "redressement",
    question: "Êtes-vous en redressement judiciaire sans autorisation spéciale ?",
    kind: "exclusion",
    legalRef: "Art. 27",
  },
  {
    id: "exclusion-152",
    question: "Faites-vous l'objet d'une exclusion temporaire ou définitive (art. 152) ?",
    kind: "exclusion",
    help: "Mesures coercitives : déclarations inexactes, pièces falsifiées, fraude, corruption, manquements graves.",
    legalRef: "Art. 152",
  },
  {
    id: "conflit-interets",
    question: "Existe-t-il un conflit d'intérêts avec un membre de la commission ou du jury ?",
    kind: "exclusion",
    legalRef: "Art. 162",
  },
  {
    id: "preparation-dossier",
    question: "Avez-vous participé à la préparation du dossier d'appel d'offres ?",
    kind: "exclusion",
    legalRef: "Art. 27",
  },
  {
    id: "multi-representation",
    question: "Représentez-vous plus d'un concurrent dans le même marché ou lot ?",
    kind: "exclusion",
    legalRef: "Art. 27",
  },
];

// --- Recours (art. 163-164, décret n° 2-14-867) ---

export interface RecourseMotif {
  id: string;
  label: string;
  description: string;
  /** Point de départ du délai de réclamation auprès du maître d'ouvrage */
  deadlineFrom: "resultat" | "lettre";
  suspensionPossible: boolean;
}

export const RECOURSE_MOTIFS: RecourseMotif[] = [
  {
    id: "vice-procedure",
    label: "Vice de procédure",
    description: "Irrégularité dans le déroulement de la procédure de passation.",
    deadlineFrom: "resultat",
    suspensionPossible: true,
  },
  {
    id: "clauses-discriminatoires",
    label: "Clauses discriminatoires ou disproportionnées",
    description: "Clauses du dossier restreignant la concurrence sans lien avec l'objet du marché.",
    deadlineFrom: "resultat",
    suspensionPossible: true,
  },
  {
    id: "conflit-interets",
    label: "Conflit d'intérêts",
    description: "Conflit d'intérêts touchant un membre de la commission ou du jury (art. 162).",
    deadlineFrom: "resultat",
    suspensionPossible: true,
  },
  {
    id: "motifs-ecartement",
    label: "Contestation des motifs d'écartement",
    description: "Contestation des motifs de rejet de votre offre notifiés par le maître d'ouvrage.",
    deadlineFrom: "lettre",
    suspensionPossible: false,
  },
];

// --- Risque de prix (offres excessives / anormalement basses) ---

export type PrestationType = "travaux" | "fournitures" | "services" | "etudes";

export interface PriceRiskResult {
  status: "excessive" | "anormalement-basse" | "normale" | "non-applicable";
  ecartPct: number;
}

export function assessPriceRisk(offre: number, estimation: number, type: PrestationType): PriceRiskResult {
  const ecartPct = estimation > 0 ? ((offre - estimation) / estimation) * 100 : 0;
  if (type === "etudes") {
    return { status: "non-applicable", ecartPct };
  }
  if (ecartPct > 20) return { status: "excessive", ecartPct };
  const seuilBas = type === "travaux" ? -20 : -25;
  if (ecartPct < seuilBas) return { status: "anormalement-basse", ecartPct };
  return { status: "normale", ecartPct };
}
