import LegalPage, { type LegalSection } from "../../components/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    id: "objet",
    title: "1. Objet",
    body: (
      <p>
        Les présentes conditions générales d'utilisation (CGU) ont pour objet de définir les
        modalités de mise à disposition du service et les conditions d'utilisation par
        l'utilisateur. En accédant au site, vous acceptez sans réserve les présentes CGU.
      </p>
    ),
  },
  {
    id: "acces",
    title: "2. Accès au service",
    body: (
      <p>
        La consultation des avis de marchés publics est réservée aux utilisateurs disposant d'un
        compte. L'inscription est gratuite. Vous êtes responsable de la confidentialité de vos
        identifiants et de toute activité effectuée depuis votre compte.
      </p>
    ),
  },
  {
    id: "usage",
    title: "3. Usage autorisé",
    body: (
      <>
        <p>
          Vous vous engagez à utiliser le service conformément à sa destination et à la
          réglementation en vigueur. Il est notamment interdit&nbsp;:
        </p>
        <ul>
          <li>de perturber le fonctionnement du site ou d'en compromettre la sécurité&nbsp;;</li>
          <li>d'extraire massivement les données par des moyens automatisés non autorisés&nbsp;;</li>
          <li>d'utiliser le service à des fins frauduleuses ou illicites.</li>
        </ul>
      </>
    ),
  },
  {
    id: "donnees",
    title: "4. Disponibilité et exactitude des données",
    body: (
      <p>
        Les informations proviennent de sources publiques et sont fournies à titre indicatif. Seules
        les publications officielles des acheteurs publics font foi. Le service peut être suspendu
        temporairement pour maintenance sans préavis.
      </p>
    ),
  },
  {
    id: "responsabilite",
    title: "5. Responsabilité",
    body: (
      <p>
        L'éditeur met en œuvre les moyens raisonnables pour assurer l'exactitude des informations,
        sans garantie d'exhaustivité. Il ne saurait être tenu responsable des conséquences d'une
        décision prise sur la base des informations consultées.
      </p>
    ),
  },
  {
    id: "modification",
    title: "6. Modification des conditions",
    body: (
      <p>
        L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. La version
        applicable est celle en vigueur à la date de votre utilisation du service.
      </p>
    ),
  },
  {
    id: "droit",
    title: "7. Droit applicable",
    body: (
      <p>
        Les présentes conditions sont régies par le droit marocain. Tout litige relatif à leur
        interprétation ou à leur exécution relève de la compétence des juridictions compétentes.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      updatedAt="8 août 2026"
      lead="Les présentes conditions régissent l'accès et l'utilisation de la plateforme Marchés Publics Maroc."
      sections={SECTIONS}
    />
  );
}
