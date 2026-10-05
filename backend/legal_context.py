"""Contexte juridique condensé du décret n° 2.22.431 (marchés publics, mars 2023).

Sert de base documentaire au endpoint /api/assistant/ask. Le texte est statique
et placé en tête du prompt système pour bénéficier du prompt caching.
Source : analyse_juridique_commissions_procedure.pdf.
"""

LEGAL_CONTEXT = """\
DÉCRET N° 2.22.431 RELATIF AUX MARCHÉS PUBLICS (8 mars 2023) — SYNTHÈSE DE RÉFÉRENCE

## Modes de passation (art. 19-20)
- Appel d'offres ouvert : procédure de droit commun, ouverte à tout concurrent remplissant
  les conditions de l'art. 27. Publicité : portail des marchés publics + 2 journaux à
  diffusion nationale dont un en arabe, 21 jours minimum avant l'ouverture des plis
  (40 jours au-delà des seuils fixés à l'art. 23).
- Appel d'offres ouvert simplifié (art. 19-I-1) : marchés dont le montant estimé
  est ≤ 1 000 000 DH HT. Publicité 10 jours (portail + au moins un journal), commission
  allégée, dossier technique sans attestations de référence ni plan de charge.
- Appel d'offres restreint : lettre circulaire à au moins 3 concurrents, 10 jours minimum
  avant l'ouverture. Réservé aux marchés < 5 000 000 DH HT dont les prestations ne peuvent
  être exécutées que par un nombre limité d'opérateurs (art. 20, 23-II).
- Appel d'offres avec présélection (art. 19-I-2, 49-65) : phase d'admission sur dossier
  (publicité 15 jours minimum avant la séance d'admission), puis offres des seuls admis.
- Concours (art. 66-86) : mise en compétition de projets ; jury ; notation 80 % projet /
  20 % coût (conception seule) ou 70/20/10 dans les cas de l'art. 66.
- Dialogue compétitif (art. 12) : projets complexes ou innovants. Candidatures : 15 jours
  min après publication ; minimum 2 candidats admis ; offres finales : 30 jours min après
  la lettre d'invitation. Offres finales = CPS paraphé et signé + offre financière.
- Procédure négociée (art. 87-90) : avec ou sans publicité. Avec publicité : avis 10 jours
  min avant réception des candidatures. Négociation possible sur prix, délai, date
  d'achèvement/livraison et conditions d'exécution — jamais sur l'objet ni la consistance.
  Dossier administratif et technique complet exigé dès le début (art. 87).

## Conditions d'éligibilité (art. 27)
Capacité juridique, technique et financière ; activité en rapport avec l'objet du marché ;
situation fiscale et CNSS régulières. Exclusions : liquidation judiciaire ; redressement
judiciaire sauf autorisation de justice ; exclusion temporaire ou définitive (art. 152) ;
conflit d'intérêts (art. 162) ; participation à la préparation du dossier ; représentation
de plus d'un concurrent dans le même marché ou lot.

## Dossiers et offres (art. 28-31)
- Dossier administratif : déclaration sur l'honneur (art. 29), pouvoirs du signataire,
  convention de groupement le cas échéant ; au stade de l'attribution : attestation fiscale
  (moins d'un an), attestation CNSS, certificat d'immatriculation au RC, cautionnement
  provisoire ou caution personnelle et solidaire quand ils sont exigés.
- Déclaration sur l'honneur (art. 29) : indications sur le concurrent (dénomination, forme
  juridique, capital, adresse, RC, patente, n° CNSS, RIB) et attestations/engagements :
  couverture par police d'assurance ; non-liquidation judiciaire ; non-redressement
  judiciaire sauf autorisation de justice ; non-recours à la fraude ou à la corruption et
  absence de dons/promesses pour influer sur la procédure ; absence de conflit d'intérêts
  (art. 162) ; non-exclusion des marchés publics (art. 152) ; non-participation à la
  préparation du dossier ; exactitude des renseignements ; engagement d'actualisation et
  reconnaissance des sanctions (art. 152) en cas d'inexactitude.
- Dossier technique : note sur les moyens humains et techniques ; pour les prestations non
  courantes : attestations de référence et pièces justifiant les capacités financières ;
  certificats de qualification/classification ou agréments en tenant lieu le cas échéant.
- Offre financière (art. 30) : acte d'engagement, bordereau des prix et détail estimatif
  (ou décomposition du montant global) conformes aux modèles ; CPS et règlement de
  consultation paraphés et signés.
- Offre technique (art. 31) : uniquement si le règlement de consultation l'exige.
- Présélection (art. 53-54) : dossier d'admission = pouvoirs, déclaration sur l'honneur,
  demande d'admission, convention de groupement le cas échéant, pièces sur les capacités.

## Commissions
- Commission d'appel d'offres (art. 38) : présidée par le maître d'ouvrage ; État : deux
  représentants de l'administration, un représentant de la TGR, et au-delà de
  50 000 000 DH HT un représentant du ministère chargé des finances. Séance publique
  d'ouverture, examen à huis clos, possibilité d'experts ou de sous-commission.
- AO simplifié : commission allégée (président, un membre désigné, représentant TGR ou
  finances selon le cas).
- Concours : jury = commission de l'art. 38 + représentant du département concerné.
- Procédure négociée : commission de négociation (président, suppléant, deux représentants).
- Dialogue compétitif : commission d'admission (art. 55) ; phase de dialogue conduite par le
  maître d'ouvrage assisté d'au moins deux représentants ; examen des offres finales par la
  commission de l'art. 12.

## Contrôle des prix (offres excessives / anormalement basses)
- Offre excessive : supérieure de plus de 20 % à l'estimation du coût des prestations
  (travaux et fournitures) → écartée par la commission.
- Offre anormalement basse : inférieure de plus de 20 % (travaux) ou de plus de 25 %
  (fournitures et services) à l'estimation → la commission demande des justifications
  écrites avant de statuer.
- Marchés d'études : non soumis à ces seuils (notation technico-financière particulière).

## Délais et approbation
- Validité des offres : 60 jours à compter de l'ouverture des plis.
- Extrait du PV publié sous 24 h et affiché 15 jours minimum.
- Délai d'attente avant approbation : 15 jours (prorogeable de 15 jours en cas de
  réclamation) ; notification de l'approbation dans les 60 jours suivant l'ouverture des
  plis (ou la signature par l'attributaire en procédure négociée).

## Garanties financières
- Cautionnement provisoire : montant fixé dans l'avis, exigible quand le dossier le prévoit ;
  restitution aux concurrents écartés.
- Cautionnement définitif : 3 % du montant du marché, à constituer dans les 20 jours suivant
  la notification de l'approbation.
- Retenue de garantie : 7 % au plus des décomptes, plafonnée à 7 % du montant du marché.

## Recours (art. 163-164 ; CNCP : décret n° 2-14-867)
- Réclamation au maître d'ouvrage : vice de procédure, clauses discriminatoires ou
  disproportionnées, conflit d'intérêts, contestation des motifs d'écartement (à compter de
  la publication du résultat ou de la lettre de notification selon le motif).
- Recours devant la Commission nationale de la commande publique (CNCP) possible ;
  suspension de la procédure envisageable pour certains motifs.
- Mesures coercitives (art. 152) : exclusion temporaire ou définitive en cas de déclaration
  inexacte, pièces falsifiées, fraude, corruption ou manquements graves.

## Régime transitoire
Le décret 2.22.431 s'applique aux procédures lancées après son entrée en vigueur (sept. 2023) ;
les procédures antérieures restent régies par le décret de 2013.
"""

SYSTEM_PROMPT = f"""\
Tu es un assistant expert des marchés publics marocains (décret n° 2.22.431 du 8 mars 2023).
Tu réponds aux questions des entreprises qui préparent un dossier de candidature.

Règles :
- Appuie-toi exclusivement sur le contexte de référence ci-dessous.
- Réponds en français, de façon concise et pratique (5 phrases maximum sauf nécessité).
- Cite toujours le numéro d'article applicable (ex. « art. 29 »).
- Ne donne aucun conseil de stratégie commerciale ou juridique : clarifie uniquement les
  exigences réglementaires.
- Si la question sort du champ du décret ou du contexte fourni, dis-le et recommande de
  consulter le dossier de consultation ou un conseil juridique.

CONTEXTE DE RÉFÉRENCE :

{LEGAL_CONTEXT}
"""
