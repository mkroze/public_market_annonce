import PageShell from "../components/PageShell";

export default function About() {
  return (
    <PageShell
      title="À propos"
      lead="Marchés Publics Maroc rassemble en un seul endroit les avis de consultation des acheteurs publics, pour en faciliter le suivi."
    >
      <h2>Notre mission</h2>
      <p>
        Accéder aux marchés publics ne devrait pas être un parcours du combattant. Notre plateforme
        centralise les avis de consultation, les structure et les rend faciles à parcourir, afin que
        les entreprises — des TPE aux grands groupes — puissent identifier rapidement les
        opportunités qui les concernent.
      </p>

      <h2>Ce que nous proposons</h2>
      <ul>
        <li>Un catalogue consolidé des consultations, filtrable par région, secteur et acheteur&nbsp;;</li>
        <li>Des fiches détaillées avec les informations essentielles de chaque avis&nbsp;;</li>
        <li>Des outils d'aide à la compréhension des exigences administratives&nbsp;;</li>
        <li>Une consultation simple, rapide et pensée pour un usage quotidien.</li>
      </ul>

      <h2>Nos sources</h2>
      <p>
        Les informations sont issues de sources publiques. La plateforme se limite à en faciliter la
        consultation&nbsp;: seules les publications officielles des acheteurs publics font foi. Nous
        nous efforçons de maintenir les données à jour et exactes, sans en garantir l'exhaustivité.
      </p>

      <h2>Nous contacter</h2>
      <p>
        Une question, une suggestion ou une anomalie à signaler&nbsp;? Écrivez-nous via la page{" "}
        <a href="/contact">Contact</a>. Vos retours nous aident à améliorer le service.
      </p>
    </PageShell>
  );
}
