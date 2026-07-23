# ClaimDesk — SecuriTrade

Application de gestion des réclamations clients (dépôt → qualification →
courrier → suivi → règlement/escalade).

## Structure du dépôt

```
claimdesk/
├── backend/
│   ├── app/
│   │   ├── models/              # Modèle du dossier de réclamation, etc.
│   │   ├── routes/               # Points d'entrée API (dépôt, suivi, ...)
│   │   ├── services/             # Logique métier (notifications, escalade, Odoo)
│   │   ├── rules_engine/         # Moteur de règles juridiques — lit la matrice
│   │   │                         # fournie par Félicite, aucune règle codée en dur
│   │   └── templates_courriers/  # Modèles de courriers, un dossier par langue
│   └── tests/                    # Tests (cas normaux + cas limites)
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/             # Appels à l'API backend
├── infra/                        # Docker, config de déploiement
├── docker-compose.yml
└── .env.example
```

## Ordre de construction recommandé

1. Fondations : structure + modèle de données du dossier de réclamation
2. Formulaire de dépôt (validation + numéro de dossier)
3. Moteur de règles juridiques (à partir de la matrice de Félicite —
   `backend/app/rules_engine/regles_juridiques.json`)
4. Génération de courriers (à partir des modèles de Félicite, par langue)
5. Suivi en temps réel + détection des retards / escalade
6. Connexion Odoo
7. Tests au fur et à mesure de chaque brique
8. Conteneurisation

## Démarrage rapide

```bash
cp .env.example .env
docker compose up --build
```

## Règle importante

Les règles juridiques (base légale, délai, remède, organe d'escalade) ne
doivent **jamais** être codées en dur. Elles vivent dans
`backend/app/rules_engine/regles_juridiques.json` (ou en base de données) et
sont mises à jour par l'équipe Droit international sans toucher au code.
