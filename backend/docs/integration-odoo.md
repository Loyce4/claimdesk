# Intégration Odoo — contrat d'interface

## État de l'intégration

Le connecteur Odoo est développé et testé. Il n'a pas pu être exercé contre une
instance réelle : aucune instance Odoo n'a été mise à disposition de l'équipe
dans le cadre du projet.

Le service se comporte de façon dégradée mais sûre en l'absence d'ERP : le dépôt
et le traitement des réclamations fonctionnent normalement, la synchronisation
est simplement ignorée. Ce comportement est couvert par un test automatisé
(`backend/tests/odoo.test.ts`).

## Protocole

JSON-RPC natif d'Odoo, endpoint `/jsonrpc`. Authentification par clé API,
identifiant de session mis en cache et invalidé automatiquement en cas d'erreur.

Implémentation : `backend/src/services/odoo.ts`

## Configuration attendue

| Variable | Description | Exemple |
|---|---|---|
| `ODOO_URL` | URL de l'instance | `https://omnivia.odoo.com` |
| `ODOO_DB` | Nom de la base | `omnivia_prod` |
| `ODOO_USERNAME` | Utilisateur technique | `claimdesk@omnivia.eu` |
| `ODOO_API_KEY` | Clé API | — |
| `ODOO_MODEL` | Modèle cible (défaut : `claimdesk.reclamation`) | |

Tant que les quatre premières variables ne sont pas renseignées, la
synchronisation est désactivée sans erreur.

## Modèle Odoo attendu

Le module Odoo doit exposer un modèle avec les champs suivants :

| Champ | Type | Description |
|---|---|---|
| `numero_dossier` | Char (unique) | Clé de rapprochement |
| `pays` | Char(2) | Code ISO du pays du client |
| `type_reclamation` | Selection | Un des cinq types de la matrice de qualification |
| `description` | Text | Description fournie par le client |
| `nom_client` | Char | |
| `email_client` | Char | |
| `montant_reclame` | Float | Nullable |
| `statut` | Selection | recu, qualifie, en_attente_pieces, en_traitement, proposition, escalade, resolu, cloture |
| `date_echeance` | Date | Nullable |

## Déclenchement de la synchronisation

- à la création du dossier (dépôt d'une réclamation) ;
- à l'escalade automatique pour dépassement de délai ;
- à la validation d'un règlement.

La synchronisation est un *upsert* : recherche par `numero_dossier`, mise à jour
si le dossier existe, création sinon.

## Vérification à la mise en service

1. Renseigner les variables de configuration dans le fichier `.env`.
2. Déposer une réclamation de test via `POST /reclamations`.
3. Vérifier l'apparition du dossier dans Odoo.
4. Valider un règlement et vérifier la mise à jour du statut côté ERP.

## Point ouvert

La fourniture d'une instance Odoo n'est pas couverte à ce jour. Ce point doit
être tranché avant la recette, le cahier des charges imposant Odoo comme
back-office du service juridique.