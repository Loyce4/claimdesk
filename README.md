# ClaimDesk

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=Loyce4_claimdesk&metric=alert_status&token=554eb98177968763097b5d7527b47815bcf9d619)](https://sonarcloud.io/summary/new_code?id=Loyce4_claimdesk)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Loyce4_claimdesk&metric=coverage&token=554eb98177968763097b5d7527b47815bcf9d619)](https://sonarcloud.io/summary/new_code?id=Loyce4_claimdesk)
Module de gestion des réclamations client pour **OMNIVIA**, développé sous conduite technique de **RINTIO**.

ClaimDesk permet à un client de déposer une réclamation, la fait qualifier automatiquement selon le droit applicable à son pays, génère les courriers dans sa langue, permet un suivi en temps réel, escalade automatiquement les dossiers en retard, et enregistre le règlement.

**Périmètre** : 7 pays européens — France, Allemagne, Espagne, Italie, Belgique, Pays-Bas, Pologne.

---

## Stack technique

- **Backend** : Node.js + TypeScript, [Fastify](https://fastify.dev/), documentation OpenAPI (Swagger)
- **Base de données** : PostgreSQL
- **Temps réel** : WebSocket
- **Back-office** : Odoo (ERP) — connecteur développé et documenté, voir [`docs/integration-odoo.md`](docs/integration-odoo.md)
- **Qualité** : Docker, GitHub Actions (CI), SonarCloud
- **Frontend de démonstration** : HTML/JS simple (formulaire de dépôt, suivi temps réel)

---

## Démarrer l'application

### Option recommandée — conteneurs Docker

```powershell
docker compose up -d
```

Démarre l'application complète (backend + PostgreSQL avec healthcheck).

### Option développement local

```powershell
# 1. Démarrer uniquement la base de données
docker compose up -d db

# 2. Depuis le dossier backend/
cd backend
npm run dev
```

> ⚠️ Les deux options utilisent le port 8000 — faire `docker compose down` avant de basculer d'une option à l'autre.

---

## Points d'entrée

| Ressource | Emplacement |
|---|---|
| Formulaire de dépôt (démo) | `frontend/depot.html` |
| Suivi temps réel (démo) | `frontend/suivi.html` |
| Documentation API (Swagger) | http://localhost:8000/docs |

---

## Commandes utiles

| Commande | Dossier | Effet |
|---|---|---|
| `npm run dev` | `backend/` | Démarre le serveur en développement |
| `npm run test` | `backend/` | Lance les tests automatisés |
| `npm run test:coverage` | `backend/` | Lance les tests avec rapport de couverture |
| `docker compose up -d` | racine | Démarre l'application complète |
| `docker compose logs -f backend` | racine | Suit les logs du conteneur backend |
| `docker exec -it projet_claimdesck-db-1 psql -U claimdesk -d claimdesk` | racine | Ouvre une console SQL sur la base |

---

## Architecture

---

## Qualité et tests

- Tests automatisés unitaires et d'intégration, exécutés en continu via GitHub Actions
- Base PostgreSQL dédiée pour les tests d'intégration en CI
- Analyse de qualité de code automatique via SonarCloud (badge ci-dessus)
- Documentation d'API générée automatiquement (OpenAPI / Swagger)

---

## Décisions techniques principales

- **Aucune règle juridique n'est codée en dur** : le référentiel juridique est externalisé (`reglesJuridiques.json`) et peut être mis à jour indépendamment du code.
- **Machine à états** pour le cycle de vie d'un dossier : `recu → qualifie → en_traitement → proposition → resolu → cloture`, avec gestion de l'escalade et des dossiers en attente de pièces.
- La langue des courriers est déduite du pays du client, avec possibilité de surcharge (cas belge : choix entre français et néerlandais).
- Les traitements non critiques (synchronisation Odoo, accusé de réception) sont exécutés en tâche de fond et n'affectent jamais le dépôt d'une réclamation.

---

## Hors périmètre (par le cahier des charges)

- Authentification par compte utilisateur (accès par référence de dossier uniquement)
- Intelligence artificielle générative
- Application mobile
- Gestion multidevise