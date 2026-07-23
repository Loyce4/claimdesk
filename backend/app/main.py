"""
Point d'entrée de l'API ClaimDesk.

Ordre de développement recommandé (voir README.md racine) :
1. models/dossier_reclamation.py   -> format commun du dossier
2. routes/depot.py                 -> formulaire de dépôt
3. rules_engine/                   -> moteur de règles juridiques
4. services/courriers.py           -> génération des courriers
5. routes/suivi.py                 -> suivi temps réel
6. services/escalade.py            -> détection des retards
7. services/odoo.py                -> connexion Odoo
"""

from fastapi import FastAPI

from app.database import Base, engine
from app.routes import depot

# Crée les tables si elles n'existent pas encore.
# À remplacer par des migrations Alembic dès que le modèle se stabilise.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ClaimDesk API", version="0.1.0")


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(depot.router, prefix="/reclamations", tags=["dépôt"])

# Prochaines routes à brancher au fur et à mesure :
# from app.routes import suivi
# app.include_router(suivi.router, prefix="/reclamations", tags=["suivi"])
