import LegalPage, { type LegalSection } from "../../components/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    id: "donnees",
    title: "Données que nous collectons",
    body: (
      <p>
        Lors de la création d'un compte, nous collectons les informations que vous nous fournissez :
        nom, adresse électronique et mot de passe (stocké sous forme chiffrée). Lors de votre
        navigation, des données techniques (adresse IP, type de navigateur, pages consultées)
        peuvent être enregistrées à des fins de sécurité et de mesure d'audience.
      </p>
    ),
  },
  {
    id: "finalites",
    title: "Finalités du traitement",
    body: (
      <ul>
        <li>Gérer votre compte et vous donner accès aux consultations de marchés publics&nbsp;;</li>
        <li>Vous adresser, le cas échéant, des alertes et notifications que vous avez configurées&nbsp;;</li>
        <li>Assurer la sécurité de la plateforme et prévenir les usages abusifs&nbsp;;</li>
        <li>Améliorer le service et en mesurer l'utilisation de façon agrégée.</li>
      </ul>
    ),
  },
  {
    id: "base-legale",
    title: "Base légale",
    body: (
      <p>
        Le traitement de vos données repose sur l'exécution du service auquel vous souscrivez, sur
        votre consentement pour les communications facultatives, et sur notre intérêt légitime à
        sécuriser et améliorer la plateforme.
      </p>
    ),
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    body: (
      <p>
        Vos données de compte sont conservées tant que votre compte est actif. Elles sont supprimées
        ou anonymisées dans un délai raisonnable après la fermeture du compte, sauf obligation
        légale de conservation.
      </p>
    ),
  },
  {
    id: "partage",
    title: "Partage des données",
    body: (
      <p>
        Nous ne vendons pas vos données personnelles. Elles peuvent être communiquées à des
        prestataires techniques agissant pour notre compte (hébergement, envoi d'e-mails), tenus à
        des obligations de confidentialité, ou à une autorité si la loi l'exige.
      </p>
    ),
  },
  {
    id: "droits",
    title: "Vos droits",
    body: (
      <p>
        Conformément à la loi n° 09-08 relative à la protection des personnes physiques à l'égard du
        traitement des données à caractère personnel, vous disposez d'un droit d'accès, de
        rectification, d'opposition et de suppression de vos données. Vous pouvez exercer ces droits
        via la page <a href="/contact">Contact</a>.
      </p>
    ),
  },
  {
    id: "securite",
    title: "Sécurité",
    body: (
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
        vos données contre l'accès, la modification ou la divulgation non autorisés.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="8 août 2026"
      lead="La présente politique décrit les données personnelles que nous collectons, l'usage qui en est fait et les droits dont vous disposez."
      sections={SECTIONS}
    />
  );
}
