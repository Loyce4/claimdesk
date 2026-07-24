# ClaimDesk — SecuriTrade (backend Node.js/TypeScript)

Backend conforme au cahier des charges : **Node.js + TypeScript**, framework
**Fastify** avec API REST documentée (**OpenAPI**), suivi de cas en
**WebSocket**, base de données **PostgreSQL**. Pas d'authentification — la
plateforme est à accès public. Redis et les files d'attente ne sont pas
utilisés (exclus du périmètre).

## Structure

```
backend/
├── src/
│   ├── server.ts              # point d'entrée Fastify
│   ├── models/                # types TypeScript du dossier de réclamation
│   ├── schemas/                # schémas Zod (validation + OpenAPI)
│   ├── db/                    # connexion PostgreSQL
│   ├── services/
│   │   ├── numerotation.ts     # génération du numéro de dossier
│   │   └── courriers.ts        # génération des courriers (Handlebars)
│   ├── rulesEngine/
│   │   ├── moteur.ts           # lit la matrice, aucune règle en dur
│   │   └── reglesJuridiques.json  # rempli par Félicite
│   ├── routes/
│   │   └── depot.ts            # dépôt + consultation de réclamation
│   ├── websocket/
│   │   └── suivi.ts            # suivi temps réel par WebSocket
│   └── templatesCourriers/fr/  # modèles de courriers, un dossier par langue
└── tests/                      # tests Vitest (unitaires)
```

## Démarrage rapide

```bash
cp .env.example .env
docker compose up --build
```

- API : http://localhost:8000
- Documentation OpenAPI interactive : **http://localhost:8000/docs**
- Suivi temps réel d'un dossier : `ws://localhost:8000/ws/reclamations/{numeroDossier}`

## Tests

```bash
cd backend
npm install
npm test
```

## Règle importante

Les règles juridiques ne doivent **jamais** être codées en dur. Elles vivent
dans `src/rulesEngine/reglesJuridiques.json`, mis à jour par l'équipe Droit
international sans toucher au code.

## À faire (prochaines étapes du cahier des charges)

- Intégration Odoo (back-office)
- Livraison & qualité : badge SonarQube, pipeline CI GitHub
- Détection automatique des dossiers en retard / escalade
