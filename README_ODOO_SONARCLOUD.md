# ClaimDesk — Intégration Odoo et badge qualité SonarCloud

## Intégration Odoo

Le fichier `backend/src/services/odoo.ts` synchronise chaque réclamation
créée vers Odoo (création ou mise à jour selon le numéro de dossier), via
le protocole JSON-RPC natif d'Odoo.

**Comportement volontaire** : si Odoo n'est pas configuré ou injoignable,
le dépôt de la réclamation n'est jamais bloqué — la synchronisation est
juste ignorée (avec un log d'erreur côté serveur), pour que le service
reste fiable côté client même si l'ERP est indisponible.

### Configuration

Renseigne ces variables dans `.env` (à la racine du projet) :

```
ODOO_URL=https://ton-instance.odoo.com
ODOO_DB=nom_de_la_base
ODOO_USERNAME=utilisateur_technique
ODOO_API_KEY=clé_api_ou_mot_de_passe
ODOO_MODEL=claimdesk.reclamation
```

`ODOO_MODEL` correspond au nom technique du modèle Odoo qui recevra les
dossiers (à créer côté Odoo, ou à adapter si vous utilisez un modèle
existant comme `helpdesk.ticket`).

### Test rapide (sans vrai Odoo)

Les tests dans `backend/tests/odoo.test.ts` vérifient que le service ne
plante jamais, que Odoo soit configuré ou non :
```bash
cd backend
npm test
```

## Badge qualité SonarCloud

Le cahier des charges demande un badge SonarQube. On utilise **SonarCloud**
(version cloud, gratuite pour les dépôts publics ou les petites équipes),
qui génère exactement ce badge automatiquement à chaque push.

### Mise en place (une seule fois)

1. Va sur https://sonarcloud.io et connecte-toi avec ton compte GitHub
2. Clique sur **"+"** → **"Analyze new project"**, sélectionne le dépôt
   `claimdesk`
3. SonarCloud te donne une **clé de projet** (`projectKey`) et une
   **organisation** (`organization`) — remplace-les dans
   `backend/sonar-project.properties`
4. Génère un **token** : va dans *My Account → Security → Generate Token*
5. Sur GitHub, va dans le dépôt → **Settings → Secrets and variables →
   Actions → New repository secret**
   - Nom : `SONAR_TOKEN`
   - Valeur : le token généré à l'étape précédente
6. Commit et push ce dossier — le workflow `.github/workflows/ci.yml` se
   déclenche automatiquement, lance les tests, puis l'analyse SonarCloud

### Ajouter le badge au README principal

Une fois la première analyse terminée sur SonarCloud, va dans les
paramètres du projet SonarCloud pour récupérer le code Markdown du badge
(Project Overview → bouton "..." → "Get project badges"), et colle-le en
haut du `README.md` principal du projet, par exemple :

```markdown
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=TON-COMPTE_claimdesk&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=TON-COMPTE_claimdesk)
```
