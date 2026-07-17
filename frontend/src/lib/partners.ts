// Données de référence sur l'écosystème du produit.
// Sources : chat/partner_mapping.md (partenaires stratégiques) et
// scraping/source_inventory.jsonl (inventaire des portails publics officiels,
// reconnaissance du 15 juillet 2026). Ce fichier est la projection publique
// de ces sources : les évaluations internes n'y figurent pas.

export interface DataSource {
  id: string;
  name: string;
  operator: string;
  url: string;
  tier: 1 | 2 | 3;
  domains: string[];
  description: string;
  status: "integre" | "reference" | "acces_institutionnel";
}

export interface StrategicPartner {
  name: string;
  role: string;
  tags: string[];
  url: string;
}

export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "Sources principales",
  2: "Portails administratifs",
  3: "Finances & régulation",
};

export const STATUS_LABELS: Record<DataSource["status"], string> = {
  integre: "Intégré",
  reference: "Référencé",
  acces_institutionnel: "Accès institutionnel",
};

export const DATA_SOURCES: DataSource[] = [
  {
    id: "pmmp",
    name: "Portail Marocain des Marchés Publics",
    operator: "Trésorerie Générale du Royaume (TGR)",
    url: "https://www.marchespublics.gov.ma/",
    tier: 1,
    domains: ["Marchés publics"],
    description:
      "Plateforme officielle d'échange entre acheteurs publics et entreprises : consultations en cours, avis d'attribution, extraits de PV, rapports d'achèvement, programmes prévisionnels et entreprises exclues.",
    status: "integre",
  },
  {
    id: "data_gov_ma",
    name: "Portail National des Données Ouvertes",
    operator: "Agence de Développement du Digital (ADD)",
    url: "https://www.data.gov.ma/",
    tier: 1,
    domains: ["Données ouvertes", "Statistiques"],
    description:
      "Catalogue national de données ouvertes : plus de 660 jeux de données publiés par 48 institutions publiques, accessibles via une API documentée.",
    status: "reference",
  },
  {
    id: "sgg_bo",
    name: "Bulletin Officiel (SGG)",
    operator: "Secrétariat Général du Gouvernement",
    url: "https://www.sgg.gov.ma/BulletinOfficiel.aspx",
    tier: 1,
    domains: ["Juridique"],
    description:
      "Le Bulletin Officiel du Royaume : lois, décrets, règlements, conventions et annonces légales, avec recherche et téléchargement des bulletins.",
    status: "reference",
  },
  {
    id: "adala_justice",
    name: "Adala — Portail juridique",
    operator: "Ministère de la Justice",
    url: "https://adala.justice.gov.ma/",
    tier: 1,
    domains: ["Juridique"],
    description:
      "Portail juridique du Ministère de la Justice : textes de loi, dahirs, arrêtés, circulaires et références de jurisprudence.",
    status: "reference",
  },
  {
    id: "directinfo_ompic",
    name: "Directinfo",
    operator: "OMPIC",
    url: "https://www.directinfo.ma/",
    tier: 1,
    domains: ["Entreprises"],
    description:
      "Registre central du commerce : informations légales et financières sur les entreprises marocaines et baromètre de création d'entreprises.",
    status: "acces_institutionnel",
  },
  {
    id: "hcp",
    name: "Haut-Commissariat au Plan",
    operator: "Haut-Commissariat au Plan",
    url: "https://www.hcp.ma/",
    tier: 1,
    domains: ["Statistiques"],
    description:
      "Statistiques nationales de référence : recensements (RGPH), comptes nationaux, bases de données, indicateurs ODD et publications.",
    status: "reference",
  },
  {
    id: "ancfcc",
    name: "ANCFCC",
    operator: "Agence Nationale de la Conservation Foncière, du Cadastre et de la Cartographie",
    url: "https://www.ancfcc.gov.ma/",
    tier: 2,
    domains: ["Foncier", "Procédures"],
    description:
      "Catalogue des services fonciers et cadastraux : certificats de propriété, plans cadastraux, vérification de documents et référentiel des prix.",
    status: "reference",
  },
  {
    id: "chikaya",
    name: "Chikaya",
    operator: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    url: "https://www.chikaya.ma/",
    tier: 2,
    domains: ["Réclamations"],
    description:
      "Portail national des réclamations : statistiques publiques de traitement et taxonomie des administrations et services concernés.",
    status: "reference",
  },
  {
    id: "rokhas",
    name: "Rokhas",
    operator: "Plateforme nationale des autorisations",
    url: "https://rokhas.ma/",
    tier: 2,
    domains: ["Autorisations", "Urbanisme"],
    description:
      "Plateforme des permis et autorisations : urbanisme et autorisations d'activités économiques.",
    status: "acces_institutionnel",
  },
  {
    id: "portnet",
    name: "PortNet",
    operator: "PortNet S.A.",
    url: "https://www.portnet.ma/",
    tier: 2,
    domains: ["Commerce extérieur"],
    description:
      "Guichet unique national des formalités du commerce extérieur : procédures d'import/export, licences et services de la communauté portuaire.",
    status: "reference",
  },
  {
    id: "emploi_public",
    name: "Emploi-public.ma",
    operator: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    url: "https://www.emploi-public.ma/",
    tier: 2,
    domains: ["Emploi public"],
    description:
      "Annonces de recrutement du secteur public : concours, résultats, convocations et guides du candidat.",
    status: "reference",
  },
  {
    id: "lof_budget",
    name: "LOF — Direction du Budget",
    operator: "Ministère de l'Économie et des Finances",
    url: "https://lof.finances.gov.ma/fr",
    tier: 3,
    domains: ["Budget"],
    description:
      "Lois de finances par année, budgets ministériels, budgets citoyens, lois de règlement et statistiques des finances publiques.",
    status: "reference",
  },
  {
    id: "cour_des_comptes",
    name: "Cour des Comptes",
    operator: "Cour des Comptes",
    url: "https://www.courdescomptes.ma/",
    tier: 3,
    domains: ["Audit"],
    description:
      "Rapports annuels, rapports sur l'exécution des lois de finances et rapports thématiques de la juridiction supérieure de contrôle des finances publiques.",
    status: "reference",
  },
  {
    id: "conseil_concurrence",
    name: "Conseil de la Concurrence",
    operator: "Conseil de la Concurrence",
    url: "https://conseil-concurrence.ma/",
    tier: 3,
    domains: ["Concurrence"],
    description:
      "Avis consultatifs, décisions de contrôle des concentrations, études sectorielles et rapports annuels du régulateur de la concurrence.",
    status: "reference",
  },
  {
    id: "dgi_tax",
    name: "Direction Générale des Impôts",
    operator: "Direction Générale des Impôts",
    url: "https://www.tax.gov.ma/",
    tier: 3,
    domains: ["Fiscalité"],
    description:
      "Guides fiscaux, procédures pour les contribuables, formulaires et actualités fiscales.",
    status: "acces_institutionnel",
  },
  {
    id: "adii_douane",
    name: "Administration des Douanes (ADII)",
    operator: "Administration des Douanes et Impôts Indirects",
    url: "https://www.douane.gov.ma/",
    tier: 3,
    domains: ["Douane", "Commerce extérieur"],
    description:
      "Réglementation douanière, tarifs et nomenclature, circulaires et procédures d'import/export.",
    status: "acces_institutionnel",
  },
  {
    id: "office_changes",
    name: "Office des Changes",
    operator: "Office des Changes",
    url: "https://www.oc.gov.ma/",
    tier: 3,
    domains: ["Changes", "Commerce extérieur"],
    description:
      "Réglementation des changes, instructions et circulaires, séries statistiques et base de données des échanges extérieurs.",
    status: "reference",
  },
];

export const STRATEGIC_PARTNERS: StrategicPartner[] = [
  {
    name: "Trésorerie Générale du Royaume (TGR)",
    role: "Opératrice de l'écosystème du portail des marchés publics et acteur central de l'exécution de la dépense publique.",
    tags: ["Légitimité officielle", "Accès plateforme"],
    url: "https://www.tgr.gov.ma/",
  },
  {
    name: "Portail Marocain des Marchés Publics (PMMP)",
    role: "Plateforme d'échange commune entre acheteurs publics et fournisseurs : le cœur de la donnée marchés publics.",
    tags: ["Données marchés", "Alignement produit"],
    url: "https://www.marchespublics.gov.ma/pmmp/",
  },
  {
    name: "Ministère de l'Économie et des Finances",
    role: "Politique de la commande publique, finances publiques, délais de paiement et transparence budgétaire.",
    tags: ["Finances publiques", "Sponsor institutionnel"],
    url: "https://www.finances.gov.ma/",
  },
  {
    name: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    role: "Administration numérique, simplification administrative et dématérialisation de la commande publique.",
    tags: ["E-gouvernement", "Simplification"],
    url: "https://www.mmsp.gov.ma/",
  },
  {
    name: "Agence de Développement du Digital (ADD)",
    role: "Institution publique en charge de la transformation digitale, de l'interopérabilité et de la stratégie numérique nationale.",
    tags: ["Transformation digitale", "Interopérabilité"],
    url: "https://www.add.gov.ma/",
  },
  {
    name: "Ministère de l'Intérieur / DGCT / INDH",
    role: "Communes, provinces et régions : la commande publique territoriale et les projets de développement local.",
    tags: ["Territorial", "Développement local"],
    url: "https://www.indh.ma/",
  },
  {
    name: "Commission Nationale de la Commande Publique (CNCP)",
    role: "Interprétation du droit des marchés publics, réclamations et voies de recours.",
    tags: ["Confiance juridique", "Recours"],
    url: "https://www.marchespublics.gov.ma/pmmp/textereg.html?lang=fr&rubrique6=",
  },
  {
    name: "Maroc PME",
    role: "Accompagnement des TPE et PME : préparation à la commande publique et programmes de croissance.",
    tags: ["PME", "Formation"],
    url: "https://marocpme.gov.ma/",
  },
  {
    name: "CGEM",
    role: "Principale organisation patronale du Maroc : distribution vers le secteur privé et retours des entreprises.",
    tags: ["Distribution B2B", "Réseau"],
    url: "https://www.cgem.ma/",
  },
  {
    name: "FNBTP",
    role: "Fédération Nationale du Bâtiment et des Travaux Publics : le premier secteur de la commande publique.",
    tags: ["BTP", "Fournisseurs"],
    url: "https://www.fnbtp.ma/",
  },
];
