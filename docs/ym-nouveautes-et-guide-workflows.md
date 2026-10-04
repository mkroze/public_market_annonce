# MP Maroc — Nouveautés et guide de la page Workflows

Ce document décrit les modifications et nouvelles fonctionnalités apportées à l'application, puis explique comment utiliser la page **Workflows** de l'espace admin.

> État : ces changements sont présents dans le répertoire de travail (branche `next-prod`) et ne sont pas encore commités.

---

## 1. Nouveautés côté admin

### 1.1 Page « Workflows » (`/admin/workflows`)

Une vue unique qui centralise tous les traitements de fond : ce qui tourne, ce qui a été lancé, ce qui a été supprimé ou archivé. Elle se trouve en tête du groupe « Data pipeline » du menu admin. Les pages existantes (Scrape, DCE cache, DCE extraction, Cron jobs) sont conservées telles quelles.

Le mode d'emploi détaillé est en [section 4](#4-guide--utiliser-la-page-workflows).

### 1.2 Traçabilité renforcée

Plusieurs actions ne laissaient pas de trace exploitable. Elles sont maintenant enregistrées dans le journal d'audit :

| Action | Avant | Maintenant |
|---|---|---|
| Vidage du cache DCE | tracé sans détail | mode, nombre de fichiers supprimés, espace libéré, fichiers orphelins |
| Éviction automatique du cache (plafond atteint) | aucune trace | ligne d'audit « système » avec quantités et identifiants (20 max) |
| Lancement planifié d'une tâche | absent de l'audit | ligne `cron.scheduled_run` |
| Pause / reprise / annulation | tracé sans lien | rattaché à l'exécution concernée |
| Archivage d'appels d'offres | nombre seulement | nombre + identifiants (50 max) |

Correction au passage : un lancement manuel depuis la page Cron jobs était enregistré comme « planifié » ; il est maintenant marqué « manuel ».

### 1.3 Nettoyage automatique du cache DCE

Nouvelle tâche planifiée qui supprime du cache les DCE dont l'appel d'offres a dépassé son échéance, est archivé ou a disparu du catalogue (plus les fichiers orphelins).

- Désactivée par défaut ; une fois activée, elle tourne une fois par jour à 6h (heure du Maroc), une heure avant le scrape.
- Elle ne démarre pas pendant qu'une mise en cache est en cours.
- La comparaison se fait au jour près : un DCE est supprimé au passage qui suit le jour de son échéance.
- Chaque passage, réussi ou en échec, apparaît dans le journal de la page Workflows.

### 1.4 Compteurs « Tenders » du Dashboard

- **Deux cartes** au lieu d'une :
  - *Tenders (all)* : tout ce qui est en base, y compris les appels d'offres archivés et ceux dont l'échéance est passée ;
  - *Tenders (current)* : uniquement les appels d'offres à jour (non archivés, échéance non dépassée ; une échéance illisible compte comme « à jour »).
- **Calcul planifié** : les deux compteurs ne sont plus recalculés à chaque ouverture de la page. Ils sont calculés une fois par jour à l'heure du scrape (7h par défaut), après la fin du scrape.
- **Interrupteur « Recompute every hour »** sous les cartes : passe le calcul à toutes les heures.
- La date du dernier calcul est affichée sous les cartes.

Conséquence : entre deux calculs, ces deux cartes peuvent être en retard sur la réalité (par exemple après un scrape manuel). Un recalcul immédiat est possible depuis la page Workflows ou Cron jobs.

### 1.5 Tâches planifiées

Le planificateur gère maintenant cinq tâches, toutes visibles et réglables dans la page Cron jobs :

| Tâche | Rythme par défaut | État par défaut |
|---|---|---|
| Scrape + digest e-mail | chaque jour à 7h | activée |
| Mise en cache des DCE | toutes les 30 min | désactivée |
| Extraction des DCE | toutes les 2 h | désactivée |
| Nettoyage du cache DCE | chaque jour à 6h | désactivée |
| Calcul du nombre d'appels d'offres | chaque jour à 7h | activée |

Les tâches ne tournent que si le serveur backend est en marche. Une tâche quotidienne manquée (serveur arrêté pendant son heure) n'est pas rattrapée.

---

## 2. Nouveautés côté site public

### 2.1 Refonte de la page d'accueil

La page d'accueil a été reconstruite pour montrer le produit plutôt que le décrire, avec l'inscription comme action principale.

1. **Hero** : titre « Ne ratez plus aucun marché public fait pour vous », bouton principal « Créer mon compte gratuit », bouton secondaire « Voir les consultations », réassurance (compte gratuit, sans carte bancaire, inscription rapide).
2. **Vidéo de démonstration** dans le hero : un enregistrement réel de l'application (catalogue, filtres, fiche, suivi, préparation), avec des légendes discrètes. Lecture automatique, muette, en boucle, uniquement quand la vidéo est à l'écran. Une version distincte est servie sur mobile.
3. **Chiffres en direct** : consultations en cours, nouvelles cette semaine, clôturant sous 7 jours, acheteurs publics.
4. **Product Story** (« Tout commence par ce que vous cherchez ») : cinq étapes pilotées par le défilement, illustrées par de vraies captures de l'application.
5. **Trois bénéfices démontrés** : filtres avec volumes réels, aperçu de l'e-mail d'alerte, fiche de préparation.
6. **Avant / avec MP Maroc**, **Explorer les données**, **Pour qui ?**, **FAQ**, mention « les publications officielles font foi », **appel à l'action final**.
7. **Mobile** : barre d'inscription fixe en bas d'écran pour les visiteurs.

Principe suivi : aucun chiffre ni consultation inventé. Tout vient de l'API ; ce qui ne peut pas être réel est étiqueté comme exemple. Si l'API ne répond pas, la page affiche un aperçu clairement marqué « illustratif ».

### 2.2 Bouton clair / sombre

Un bouton en haut à droite du hero bascule entre mode clair et mode sombre. Le choix est mémorisé dans le navigateur, et sur le compte pour un utilisateur connecté. Il s'applique à tout le site public et à l'espace membre (l'espace admin reste en clair).

Limite connue : la vidéo du hero a été enregistrée en thème clair et reste claire en mode sombre.

---

## 3. Outillage

### 3.1 Réenregistrer la vidéo de démonstration

La vidéo fige l'interface et les données du jour de l'enregistrement. Pour la refaire, avec l'application démarrée en local :

```bash
python scripts/demo-video/record_demo.py
```

Le script pilote la vraie application avec Playwright, via un compte de démonstration fictif créé dans la base locale, puis compresse la vidéo avec FFmpeg. Les fichiers produits vont dans `frontend/src/assets/demo/`.

Prérequis : Playwright pour Python (avec son Chromium) et FFmpeg.

### 3.2 Lancer le projet en local (Windows)

- Backend : environnement virtuel Python 3.12 dans `backend/.venv`, lancé depuis le dossier `backend` avec uvicorn sur le port 8000.
- Frontend : `npm run dev` dans `frontend` (port 5173).
- Configuration : `backend/.env` (non suivi par git) contient `SECRET_KEY`, `FRONTEND_URL` et `ADMIN_EMAILS`. Un compte dont l'e-mail figure dans `ADMIN_EMAILS` reçoit le rôle `owner` à l'inscription.

Le script `npm run dev` de la racine utilise une syntaxe Unix et ne fonctionne pas tel quel sous Windows.

### 3.3 Points d'attention avant un commit

- `backend/data/` apparaît comme non suivi par git : les ZIP de DCE en cache ne sont pas ignorés. À exclure du commit.
- La fiche consultation émet une erreur console préexistante (balises `<p>` imbriquées dans les infobulles), sans effet visible.

---

## 4. Guide — utiliser la page Workflows

**Accès** : menu admin → groupe « Data pipeline » → **Workflows**, ou directement `/admin/workflows`.

**Droits** :

- la permission `imports.view` suffit pour consulter la page ;
- la permission `imports.run` est nécessaire pour lancer, mettre en pause, annuler ou changer une planification. Sans elle, les boutons sont visibles mais désactivés.

**Langue** : le bouton **EN / FR** en haut à droite change la langue de cette page ; le choix est mémorisé par navigateur. Le bouton **Actualiser** recharge les cartes et le journal.

### 4.1 Les cartes « Traitements »

La page affiche une carte par workflow :

| Carte | Rôle |
|---|---|
| Scrape + digest e-mail | collecte les appels d'offres sur le portail, puis envoie les alertes e-mail |
| Mise en cache des DCE | télécharge les dossiers de consultation pour un accès immédiat |
| Extraction des DCE | envoie les DCE en cache à l'extraction de données |
| Nettoyage du cache DCE | supprime les DCE périmés du cache |
| Calcul des appels d'offres | recalcule les compteurs « Tenders » du Dashboard |

Chaque carte indique :

- **l'état** : Inactif, En cours, En pause ou Annulation ;
- **la progression** quand le workflow tourne ;
- **la dernière exécution** : résultat, date, origine (manuel, planifié, automatique) et auteur, suivis des chiffres clés ;
- **la prochaine exécution automatique**, ou « Planification automatique désactivée » ;
- un lien **Ouvrir la page** vers l'écran détaillé correspondant.

### 4.2 Lancer, mettre en pause, annuler

- **Lancer** : démarre le workflow en arrière-plan, après confirmation. Le bouton est désactivé si une exécution est déjà en cours.
- **Pause / Reprendre** et **Annuler** : apparaissent pendant l'exécution, pour les trois premiers workflows. La pause et l'annulation sont coopératives : le traitement s'arrête au prochain point sûr (entre deux secteurs ou deux fichiers), pas instantanément.
- La page se rafraîchit toute seule toutes les quelques secondes tant qu'un workflow tourne.

Le nettoyage du cache et le calcul des appels d'offres sont des opérations courtes : ils n'ont qu'un bouton **Lancer**, sans pause ni annulation.

### 4.3 Les interrupteurs

Deux cartes portent un interrupteur :

- **Nettoyage du cache DCE → « Nettoyage automatique quotidien »** : active ou désactive le nettoyage quotidien de 6h. Désactivé par défaut.
- **Calcul des appels d'offres → « Recalculer chaque heure »** : activé, le calcul passe à toutes les heures ; désactivé, il revient au calcul quotidien à l'heure du scrape. C'est le même réglage que celui du Dashboard.

Pour changer l'heure ou l'intervalle d'une tâche, ou activer la planification des autres workflows, utilisez la page **Cron jobs**.

### 4.4 Le journal d'activité

Sous les cartes, une chronologie unique (la plus récente en haut) fusionne :

- les **exécutions** des workflows, avec leur résultat et leurs compteurs ;
- les **actions de contrôle** : pause, reprise, annulation ;
- les **suppressions** : cache vidé, éviction automatique, nettoyage des DCE périmés ;
- les **archivages et restaurations** d'appels d'offres ;
- les **changements de planification**.

Deux onglets :

- **Toute l'activité** : tous les événements ;
- **Suppressions et nettoyages** : uniquement les suppressions, archivages et restaurations, avec les quantités (fichiers supprimés, espace libéré, appels d'offres archivés).

Filtres disponibles : workflow, type d'événement, origine (manuel, planifié, automatique) et période (du / au). Les colonnes indiquent la date, le workflow, l'événement, l'origine, l'auteur, le résultat et les détails ; en cas d'échec, le message d'erreur est affiché sous les détails.

### 4.5 Exemples d'usage

- **« Qu'est-ce qui tourne en ce moment ? »** → regardez l'état des cartes.
- **« Le scrape de ce matin a-t-il fonctionné ? »** → carte Scrape, ligne « Dernière exécution », ou journal filtré sur ce workflow.
- **« Qui a vidé le cache, et combien de fichiers ? »** → onglet « Suppressions et nettoyages ».
- **« Pourquoi des DCE ont-ils disparu du cache sans action de ma part ? »** → même onglet, origine « Automatique » (éviction par plafond) ou « Planifié » (nettoyage quotidien).
- **« Les compteurs du Dashboard sont en retard »** → carte « Calcul des appels d'offres », bouton **Lancer**.

### 4.6 Limites à connaître

- Le journal fusionne les 500 lignes les plus récentes de chaque source, pas tout l'historique. Pour une recherche plus ancienne, utilisez la page **Audit logs**.
- Les vidages de cache antérieurs à la traçabilité renforcée s'affichent sans quantités.
- Le calcul des appels d'offres ne garde pas d'historique : sa carte montre le dernier calcul, mais les calculs successifs n'apparaissent pas dans le journal.
- Le digest e-mail n'a pas d'historique propre : il fait partie de l'exécution du scrape.
- Les libellés Pause / Resume / Cancel restent en anglais même en mode FR.
