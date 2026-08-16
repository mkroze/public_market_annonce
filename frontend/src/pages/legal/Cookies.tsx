import PageShell from "../../components/PageShell";

export default function Cookies() {
  return (
    <PageShell
      title="Politique des cookies"
      section="Informations légales"
      updatedAt="8 août 2026"
      lead="Cette page explique comment nous utilisons les cookies et technologies similaires sur la plateforme."
    >
      <h2>Qu'est-ce qu'un cookie&nbsp;?</h2>
      <p>
        Un cookie est un petit fichier déposé sur votre terminal lors de la visite d'un site. Il
        permet de conserver certaines informations afin de faciliter votre navigation et d'assurer
        le bon fonctionnement du service.
      </p>

      <h2>Cookies que nous utilisons</h2>
      <h3>Cookies strictement nécessaires</h3>
      <p>
        Indispensables au fonctionnement du site, ils permettent notamment de maintenir votre
        session de connexion et de mémoriser vos préférences d'affichage (par exemple le thème clair
        ou sombre). Ils ne peuvent pas être désactivés.
      </p>
      <h3>Cookies de mesure d'audience</h3>
      <p>
        Le cas échéant, ils nous aident à comprendre l'utilisation du site de façon agrégée et
        anonyme, afin d'en améliorer l'ergonomie. Ils ne sont déposés qu'avec votre accord.
      </p>

      <h2>Gestion des cookies</h2>
      <p>
        Vous pouvez à tout moment configurer votre navigateur pour accepter ou refuser les cookies,
        ou en supprimer. Le refus des cookies strictement nécessaires peut toutefois altérer le
        fonctionnement du service, notamment l'accès à votre compte.
      </p>

      <h2>Stockage local</h2>
      <p>
        Certaines préférences (thème, jeton de session) sont conservées dans le stockage local de
        votre navigateur plutôt que via des cookies. Ces données restent sur votre terminal et ne
        sont pas transmises à des tiers.
      </p>
    </PageShell>
  );
}
