import LegalPage, { type LegalSection } from "../../components/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    id: "editeur",
    title: "Éditeur du site",
    body: (
      <p>
        Le site <strong>Marchés Publics Maroc</strong> agrège et met à disposition des avis de
        consultation de marchés publics à des fins d'information. Pour toute question relative à
        l'édition du site, veuillez utiliser la page <a href="/contact">Contact</a>.
      </p>
    ),
  },
  {
    id: "publication",
    title: "Directeur de la publication",
    body: (
      <p>
        Le directeur de la publication est le représentant légal de l'éditeur de la plateforme.
      </p>
    ),
  },
  {
    id: "hebergement",
    title: "Hébergement",
    body: (
      <p>
        Le site est hébergé par un prestataire technique assurant la disponibilité et la sécurité
        de l'infrastructure. Les coordonnées de l'hébergeur peuvent être communiquées sur simple
        demande via la page Contact.
      </p>
    ),
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    body: (
      <>
        <p>
          La structure générale du site, ainsi que les textes, la charte graphique et les éléments
          qui la composent, sont la propriété de l'éditeur. Toute reproduction ou représentation,
          totale ou partielle, sans autorisation préalable est interdite.
        </p>
        <p>
          Les avis de consultation et documents des acheteurs publics restent la propriété de leurs
          auteurs respectifs. La plateforme se limite à en faciliter la consultation et n'en
          garantit pas l'exhaustivité ni l'absence d'erreur.
        </p>
      </>
    ),
  },
  {
    id: "responsabilite",
    title: "Responsabilité",
    body: (
      <p>
        Les informations diffusées sont fournies à titre indicatif. Seules les données publiées par
        les portails officiels des acheteurs publics font foi. L'éditeur ne saurait être tenu
        responsable d'un préjudice lié à l'utilisation des informations présentes sur le site.
      </p>
    ),
  },
];

export default function LegalNotice() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="8 août 2026"
      lead="Informations relatives à l'éditeur et à l'hébergement de la plateforme Marchés Publics Maroc."
      sections={SECTIONS}
    />
  );
}
